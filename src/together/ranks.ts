import type { AvatarConfig } from '../types';
import type { Match } from '../games/types';
import type { LiveLobby } from '../games/live/lobby';
import { seeded } from '../games/live/lobby';
import type { DoodleState } from '../games/doodle';
import type { RoomId } from '../escape/types';
import { formatTime } from '../escape/sync';
import { addDays } from '../letters/engine';
import { fireOf, type CouchState } from '../couch';
import { normalizeAvatar, randomAvatar } from '../pixel/character';

/**
 * The couples board: how your fire and your best games together stack up against other couples. Nobody's on it
 * unless both of you say yes, and all it shows is your two characters, a couple name made of two words Soultied
 * picks (so there's nothing anyone typed to read), and the numbers.
 *
 *   spaces/{sid}/meta/ranks   who's said yes, and your name on the board
 *   spaces/{sid}/meta/bests   your best Kitchen Rush shift and Doodle Guess game (ever, and this week), and your
 *                             fastest way out of each escape room
 *   leaderboard/{sid}         your line on the board, while you're both on it (anyone signed in can read it)
 *
 * Weeks are ISO weeks by UTC (Monday to Sunday), written as one number: 2026, week 47 is 202647. A week's best is
 * kept on the board as week × 100 + the score, so one field sorts this week's best first.
 */

/* ---------- your name on the board ---------- */

export const RANK_FIRST = [
  'Sleepy', 'Cosy', 'Midnight', 'Starlit', 'Faraway', 'Velvet', 'Honey', 'Moonlit', 'Gentle', 'Golden',
  'Rainy', 'Sunday', 'Quiet', 'Lucky', 'Little', 'Wandering', 'Warm', 'Dreamy', 'Snug', 'Ember',
  'Pixel', 'Cinnamon', 'Maple', 'Misty', 'Mellow', 'Twilight', 'Brave', 'Silly', 'Sunny', 'Kindred',
  'Cloudy', 'Hazy', 'Rosy', 'Toasty', 'Woolly', 'Northern', 'Faithful', 'Whistling', 'Glowing', 'Tiny',
];

export const RANK_SECOND = [
  'Owls', 'Foxes', 'Lanterns', 'Fireflies', 'Otters', 'Sparrows', 'Comets', 'Teacups', 'Penguins', 'Pebbles',
  'Moons', 'Embers', 'Postcards', 'Pandas', 'Robins', 'Hedgehogs', 'Kites', 'Paper Boats', 'Snails', 'Bears',
  'Wrens', 'Stars', 'Clouds', 'Pine Cones', 'Marshmallows', 'Socks', 'Puffins', 'Koalas', 'Doves', 'Swallows',
  'Seals', 'Dumplings', 'Biscuits', 'Mittens', 'Acorns', 'Turtles', 'Raccoons', 'Bunnies', 'Ducklings', 'Daisies',
];

/** a name on the board: a word from each list */
export type RankName = [number, number];

export const nameOk = (n: unknown): n is RankName =>
  Array.isArray(n) &&
  n.length === 2 &&
  Number.isInteger(n[0]) &&
  Number.isInteger(n[1]) &&
  n[0] >= 0 &&
  n[0] < RANK_FIRST.length &&
  n[1] >= 0 &&
  n[1] < RANK_SECOND.length;

/** "The Sleepy Lanterns" */
export const rankName = (n: RankName) => `The ${RANK_FIRST[n[0]]} ${RANK_SECOND[n[1]]}`;

/** a few names to pick from: no two share a word, and none is one of `avoid` */
export function suggestNames(rng: () => number, count = 3, avoid: RankName[] = []): RankName[] {
  const out: RankName[] = [];
  const key = (n: RankName) => n[0] * 1000 + n[1];
  const used = new Set(avoid.map(key));
  const n = Math.min(count, RANK_FIRST.length, RANK_SECOND.length);
  while (out.length < n) {
    const c: RankName = [Math.floor(rng() * RANK_FIRST.length), Math.floor(rng() * RANK_SECOND.length)];
    if (used.has(key(c)) || out.some((o) => o[0] === c[0] || o[1] === c[1])) continue;
    used.add(key(c));
    out.push(c);
  }
  return out;
}

/* ---------- saying yes (meta/ranks) ---------- */

export interface RanksDoc {
  /** when each of you said yes (ms) */
  yes: Record<string, number>;
  name: RankName | null;
}

export function normalizeRanks(raw: unknown): RanksDoc {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const yes: Record<string, number> = {};
  if (r.yes && typeof r.yes === 'object')
    for (const [uid, v] of Object.entries(r.yes as Record<string, unknown>)) if (typeof v === 'number' && Number.isFinite(v) && v > 0) yes[uid] = v;
  return { yes, name: nameOk(r.name) ? [r.name[0], r.name[1]] : null };
}

/** off · you asked (waiting on them) · they asked (waiting on you) · on the board */
export type RankStage = 'off' | 'asked' | 'askedMe' | 'on';

export function rankStage(d: RanksDoc, me: string, them: string | null): RankStage {
  if (!d.name) return 'off';
  const mine = !!d.yes[me];
  const theirs = !!them && !!d.yes[them];
  return mine && theirs ? 'on' : mine ? 'asked' : theirs ? 'askedMe' : 'off';
}

/* ---------- your bests (meta/bests) ---------- */

export const ESCAPE_ROOMS: RoomId[] = ['attic', 'cellar', 'office', 'library'];
export const DOODLE_MAX = 6;
export const KITCHEN_MAX = 99;
/** escapes faster than this, or slower, aren't real */
const ESCAPE_MIN_MS = 10_000;
const ESCAPE_MAX_MS = 36_000_000;

export interface BestsDoc {
  /** most orders served in one Kitchen Rush shift, ever */
  kitchen: number;
  /** most drawings guessed in one Doodle Guess game, ever */
  doodle: number;
  /** the same, this week (`w` is the week: 202647) */
  week: { w: number; kitchen: number; doodle: number };
  /** fastest way out of each escape room (ms) */
  escape: Partial<Record<RoomId, number>>;
}

const int = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);

export function normalizeBests(raw: unknown): BestsDoc {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const wk = r.week && typeof r.week === 'object' ? (r.week as Record<string, unknown>) : {};
  const esc = r.escape && typeof r.escape === 'object' ? (r.escape as Record<string, unknown>) : {};
  const escape: BestsDoc['escape'] = {};
  for (const room of ESCAPE_ROOMS) {
    const v = esc[room];
    if (typeof v === 'number' && Number.isFinite(v) && v >= ESCAPE_MIN_MS && v <= ESCAPE_MAX_MS) escape[room] = Math.round(v);
  }
  return {
    kitchen: int(r.kitchen, KITCHEN_MAX),
    doodle: int(r.doodle, DOODLE_MAX),
    week: { w: int(wk.w, 999999), kitchen: int(wk.kitchen, KITCHEN_MAX), doodle: int(wk.doodle, DOODLE_MAX) },
    escape,
  };
}

/** the ISO week (by UTC) a moment falls in, as one number: 202647 */
export function weekOf(ms: number): number {
  const day = Math.floor(ms / 86400000);
  // 1970-01-01 was a Thursday; Monday is 0
  const weekday = (((day + 3) % 7) + 7) % 7;
  const thursday = day - weekday + 3;
  const year = new Date(thursday * 86400000).getUTCFullYear();
  const ordinal = thursday - Math.round(Date.UTC(year, 0, 1) / 86400000) + 1;
  return year * 100 + Math.floor((ordinal - 1) / 7) + 1;
}

/** how many of the six drawings a Doodle Guess game got */
const doodleGot = (st: DoodleState) => (Array.isArray(st?.rounds) ? st.rounds.filter((r) => r && r.secs !== null && r.secs !== undefined).length : 0);

/**
 * What a finished Kitchen Rush shift or Doodle Guess game changes in your bests (null when nothing does). Safe to
 * call as often as you like: it only ever keeps the better score.
 */
export function bestsPatch(b: BestsDoc, games: { kitchen?: Match | null; doodle?: Match | null }, now: number): Partial<BestsDoc> | null {
  const thisWeek = weekOf(now);
  const week = b.week.w === thisWeek ? { ...b.week } : { w: thisWeek, kitchen: 0, doodle: 0 };
  let kitchen = b.kitchen;
  let doodle = b.doodle;
  const k = games.kitchen;
  if (k && k.status === 'over') {
    const served = int((k.state as LiveLobby | undefined)?.result?.score?.a, KITCHEN_MAX);
    kitchen = Math.max(kitchen, served);
    if (weekOf(k.updatedAt) === thisWeek) week.kitchen = Math.max(week.kitchen, served);
  }
  const d = games.doodle;
  if (d) {
    const st = d.state as DoodleState;
    doodle = Math.max(doodle, int(st?.best, DOODLE_MAX));
    if (d.status === 'over') {
      const got = Math.min(DOODLE_MAX, doodleGot(st));
      doodle = Math.max(doodle, got);
      if (weekOf(d.updatedAt) === thisWeek) week.doodle = Math.max(week.doodle, got);
    }
  }
  const weekNews = week.kitchen !== (b.week.w === thisWeek ? b.week.kitchen : 0) || week.doodle !== (b.week.w === thisWeek ? b.week.doodle : 0);
  if (kitchen === b.kitchen && doodle === b.doodle && !weekNews) return null;
  return { kitchen, doodle, week };
}

/** a faster way out of an escape room (null when it isn't one) */
export function escapePatch(b: BestsDoc, room: RoomId, ms: number): Partial<BestsDoc> | null {
  if (!ESCAPE_ROOMS.includes(room) || !Number.isFinite(ms) || ms < ESCAPE_MIN_MS || ms > ESCAPE_MAX_MS) return null;
  const t = Math.round(ms);
  const was = b.escape[room];
  return was && was <= t ? null : { escape: { [room]: t } };
}

/* ---------- your line on the board (leaderboard/{sid}) ---------- */

export interface RankEntry {
  name: RankName;
  /** the two of you, whoever made the place first */
  looks: [AvatarConfig, AvatarConfig];
  /** the fire: days in a row you've both shown up, up to `fireDay` */
  fire: number;
  fireDay: string;
  kitchen?: number;
  doodle?: number;
  /** this week's bests: week × 100 + the score */
  kw?: number;
  dw?: number;
  esc: Partial<Record<RoomId, number>>;
  at: number;
}

export function rankEntry(i: { name: RankName; looks: [AvatarConfig, AvatarConfig]; couch: CouchState; today: string; bests: BestsDoc; now: number }): RankEntry {
  const fire = fireOf(i.couch, i.today).streak;
  const e: RankEntry = {
    name: [i.name[0], i.name[1]],
    looks: i.looks,
    fire,
    fireDay: i.couch.together.includes(i.today) ? i.today : addDays(i.today, -1),
    esc: { ...i.bests.escape },
    at: Math.round(i.now),
  };
  if (i.bests.kitchen > 0) e.kitchen = i.bests.kitchen;
  if (i.bests.doodle > 0) e.doodle = i.bests.doodle;
  const w = weekOf(i.now);
  if (i.bests.week.w === w && i.bests.week.kitchen > 0) e.kw = w * 100 + i.bests.week.kitchen;
  if (i.bests.week.w === w && i.bests.week.doodle > 0) e.dw = w * 100 + i.bests.week.doodle;
  return e;
}

/** what's on the line apart from when it was written (to tell whether it needs writing again) */
export function entryKey(e: RankEntry): string {
  const esc = ESCAPE_ROOMS.filter((r) => e.esc[r]).map((r) => `${r}:${e.esc[r]}`);
  return JSON.stringify([e.name, e.looks.map(lookKey), e.fire, e.fireDay, e.kitchen ?? 0, e.doodle ?? 0, e.kw ?? 0, e.dw ?? 0, esc]);
}

const LOOK_KEYS = ['height', 'skin', 'hairStyle', 'hairColor', 'facialHair', 'top', 'topColor', 'bottom', 'bottomColor', 'shoes', 'shoesColor', 'glasses', 'hat', 'extra'] as const;
const lookKey = (a: AvatarConfig) => LOOK_KEYS.map((k) => a[k]).join('|');

/* ---------- the boards ---------- */

export type BoardId = 'fire' | 'kitchen-week' | 'kitchen-all' | 'doodle-week' | 'doodle-all' | 'esc-attic' | 'esc-cellar' | 'esc-office' | 'esc-library';

export const BOARD_IDS: BoardId[] = ['fire', 'kitchen-week', 'kitchen-all', 'doodle-week', 'doodle-all', 'esc-attic', 'esc-cellar', 'esc-office', 'esc-library'];

/** how many couples each board shows */
export const BOARD_LIMIT = 50;

/** what to ask the database for: the field to sort by, and which way */
export function boardQuery(id: BoardId): { field: string; desc: boolean } {
  if (id.startsWith('esc-')) return { field: `esc.${id.slice(4)}`, desc: false };
  const field = id === 'kitchen-week' ? 'kw' : id === 'doodle-week' ? 'dw' : id === 'kitchen-all' ? 'kitchen' : id === 'doodle-all' ? 'doodle' : 'fire';
  return { field, desc: true };
}

/** a board's score, in words: "12 days", "9 served", "4 of 6", "14:32" */
export function valueText(id: BoardId, v: number): string {
  if (id === 'fire') return `${v} ${v === 1 ? 'day' : 'days'}`;
  if (id.startsWith('kitchen')) return `${v} served`;
  if (id.startsWith('doodle')) return `${v} of ${DOODLE_MAX}`;
  return formatTime(v);
}

export interface BoardRow {
  id: string;
  /** 1 for the best (couples with the same score share a place) */
  rank: number;
  name: string;
  looks: [AvatarConfig, AvatarConfig];
  value: number;
  text: string;
  mine: boolean;
}

/** a line's score on a board (null when it isn't on that board, or it's out of date) */
export function boardValue(id: BoardId, data: Record<string, unknown>, today: string, now: number): number | null {
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.floor(v) : 0);
  if (id === 'fire') {
    const day = typeof data.fireDay === 'string' ? data.fireDay : '';
    // a fire that hasn't been fed since the day before yesterday has gone out (a day's slack for time zones)
    const v = n(data.fire);
    return v > 0 && day >= addDays(today, -2) ? v : null;
  }
  if (id === 'kitchen-week' || id === 'doodle-week') {
    const v = n(data[id === 'kitchen-week' ? 'kw' : 'dw']);
    const s = v % 100;
    return Math.floor(v / 100) === weekOf(now) && s > 0 ? s : null;
  }
  if (id === 'kitchen-all' || id === 'doodle-all') {
    const v = n(data[id === 'kitchen-all' ? 'kitchen' : 'doodle']);
    return v > 0 ? v : null;
  }
  const esc = data.esc && typeof data.esc === 'object' ? (data.esc as Record<string, unknown>) : {};
  const v = n(esc[id.slice(4)]);
  return v >= ESCAPE_MIN_MS && v <= ESCAPE_MAX_MS ? v : null;
}

/** the board as it shows: lines sorted best first, with their places (`mine` is your place's id) */
export function boardRows(id: BoardId, rows: Array<{ id: string; data: unknown }>, mine: string, today: string, now: number): BoardRow[] {
  const asc = id.startsWith('esc-');
  const out: Array<Omit<BoardRow, 'rank'>> = [];
  for (const r of rows) {
    const d = r.data && typeof r.data === 'object' ? (r.data as Record<string, unknown>) : null;
    if (!d || !nameOk(d.name) || !Array.isArray(d.looks) || d.looks.length !== 2) continue;
    const value = boardValue(id, d, today, now);
    if (value === null) continue;
    out.push({
      id: r.id,
      name: rankName(d.name),
      looks: [normalizeAvatar(d.looks[0]), normalizeAvatar(d.looks[1])],
      value,
      text: valueText(id, value),
      mine: r.id === mine,
    });
  }
  out.sort((a, b) => (asc ? a.value - b.value : b.value - a.value) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out.slice(0, BOARD_LIMIT).map((r, i, all) => {
    let rank = i + 1;
    while (rank > 1 && all[rank - 2].value === r.value) rank--;
    return { ...r, rank };
  });
}

/* ---------- the demo room ---------- */

/** the other couples on the demo room's boards (made up, and the same every time) */
export function demoBoards(today: string, now: number): Array<{ id: string; data: Record<string, unknown> }> {
  const r = seeded(4711);
  const w = weekOf(now);
  const names = suggestNames(r, 11, [DEMO_NAME]);
  return names.map((name, i) => {
    const looks = [randomAvatar(r), randomAvatar(r)];
    const fire = 1 + Math.floor(r() * 60);
    const kitchen = 4 + Math.floor(r() * 14);
    const kw = Math.max(1, kitchen - Math.floor(r() * 5));
    const doodle = 2 + Math.floor(r() * 5);
    const dw = Math.max(1, doodle - Math.floor(r() * 3));
    const esc: Record<string, number> = {};
    for (const room of ESCAPE_ROOMS) if (r() < 0.7) esc[room] = Math.round((6 + r() * 30) * 60) * 1000;
    return { id: `demo-couple-${i}`, data: { name, looks, fire, fireDay: today, kitchen, doodle, kw: w * 100 + kw, dw: w * 100 + dw, esc, at: now } };
  });
}

/** the demo room's own name, the one Rohan asks to go on the board with */
export const DEMO_NAME: RankName = [0, 2];

/** the demo room: Rohan has asked to go on the board */
export const demoRanks = (them: string): RanksDoc => ({ yes: { [them]: 1 }, name: [DEMO_NAME[0], DEMO_NAME[1]] });

/** the demo room's bests (this week's are this week, whenever you look) */
export const demoBests = (now: number): BestsDoc => ({
  kitchen: 12,
  doodle: 4,
  week: { w: weekOf(now), kitchen: 9, doodle: 4 },
  escape: { attic: 872_000 },
});
