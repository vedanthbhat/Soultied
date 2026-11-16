import { addDays, todayKey } from '../letters/engine';

/**
 * The pet you both raise. Whoever sleeps on the cushion by the couch (decor/catalogue.ts) gets looked after: each
 * of you can feed it, play with it and give it a cuddle, once each a day. Every day you BOTH come by counts
 * towards how close it's grown to the two of you (New friend, Settling in, Loyal, Best friend, Family). Missed
 * days never set it back; it just misses you. The room shows it all: the bowl's full once it's been fed, its
 * ball is out once someone's played, a blanket's tucked over it after a cuddle, hearts instead of zzz when you've
 * both been, and a little heart over it when your person's been by and you haven't. The iPhone's Pet.swift.
 *
 * Kept in the place's meta/pet document:
 *   care   day → uid → what you did → when (ms); only the last two weeks are kept
 *   days   every day you both looked after it (day → true), for good
 *
 * Days are each person's own calendar day (like the couch and the fire).
 */

export type PetAct = 'feed' | 'play' | 'cuddle';
export const PET_ACTS: readonly PetAct[] = ['feed', 'play', 'cuddle'];

export const PET_ACT_INFO: Record<PetAct, { label: string; did: string; done: string }> = {
  feed: { label: 'Feed', did: 'fed', done: 'Fed' },
  play: { label: 'Play', did: 'played with', done: 'Played' },
  cuddle: { label: 'Cuddle', did: 'cuddled', done: 'Cuddled' },
};

/** how many days of care are kept (the bond, in `days`, is kept for good) */
export const PET_KEEP_DAYS = 14;

/** how close it's grown, by the days you've both looked after it */
export const PET_LEVELS: readonly { at: number; name: string }[] = [
  { at: 0, name: 'New friend' },
  { at: 3, name: 'Settling in' },
  { at: 7, name: 'Loyal' },
  { at: 14, name: 'Best friend' },
  { at: 30, name: 'Family' },
];

/** what each of you did on a day: the time (ms) of each */
export type PetCare = Partial<Record<PetAct, number>>;

export interface PetDoc {
  care: Record<string, Record<string, PetCare>>;
  days: Record<string, true>;
}

const isKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** a real moment (after 2001), in ms */
const isMs = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 1e12;

export function normalizePet(raw: unknown): PetDoc {
  const r = isMap(raw) ? raw : {};
  const care: PetDoc['care'] = {};
  if (isMap(r.care))
    for (const [day, by] of Object.entries(r.care)) {
      if (!isKey(day) || !isMap(by)) continue;
      const out: Record<string, PetCare> = {};
      for (const [uid, acts] of Object.entries(by)) {
        if (!uid || !isMap(acts)) continue;
        const c: PetCare = {};
        for (const a of PET_ACTS) if (isMs(acts[a])) c[a] = acts[a] as number;
        if (Object.keys(c).length) out[uid] = c;
      }
      if (Object.keys(out).length) care[day] = out;
    }
  const days: PetDoc['days'] = {};
  if (isMap(r.days)) for (const [day, v] of Object.entries(r.days)) if (isKey(day) && v === true) days[day] = true;
  return { care, days };
}

const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

const did = (c: PetCare | undefined) => !!c && PET_ACTS.some((a) => c[a] !== undefined);

/** how many days you've both looked after it */
export const bondOf = (d: PetDoc) => Object.keys(d.days).length;

/** which level it's at (an index into PET_LEVELS), and how many more days to the next (0 at the top) */
export function petLevel(bond: number): { level: number; toNext: number } {
  let level = 0;
  for (let i = 0; i < PET_LEVELS.length; i++) if (bond >= PET_LEVELS[i].at) level = i;
  const next = PET_LEVELS[level + 1];
  return { level, toNext: next ? next.at - bond : 0 };
}

/**
 *   both      you've both been by today
 *   waiting   your person has, and you haven't yet
 *   mine      you have, and your person hasn't yet
 *   resting   neither of you yet today
 *   missing   nobody's been by for three days or more
 */
export type PetMood = 'both' | 'waiting' | 'mine' | 'resting' | 'missing';

export interface PetView {
  /** what you did today, and what your person did */
  mine: PetCare;
  theirs: PetCare;
  /** whether either of you has today */
  fed: boolean;
  played: boolean;
  cuddled: boolean;
  mood: PetMood;
  /** days you've both looked after it, its level, and how many more to the next */
  bond: number;
  level: number;
  toNext: number;
  /** the last seven days, today last */
  week: { day: string; me: boolean; them: boolean; both: boolean }[];
}

export function petView(d: PetDoc, today: string, me: string, them: string | null): PetView {
  const day = d.care[today] || {};
  const mine = { ...(day[me] || {}) };
  const theirs = them ? { ...(day[them] || {}) } : {};
  const any = (a: PetAct) => mine[a] !== undefined || theirs[a] !== undefined;
  const iDid = did(mine);
  const theyDid = did(theirs);
  let mood: PetMood;
  if (iDid && theyDid) mood = 'both';
  else if (theyDid) mood = 'waiting';
  else if (iDid) mood = 'mine';
  else {
    // the last day anyone came by (on or before today)
    let last: string | null = null;
    for (const k of Object.keys(d.care)) if (k <= today && Object.values(d.care[k]).some(did) && (!last || k > last)) last = k;
    for (const k of Object.keys(d.days)) if (k <= today && (!last || k > last)) last = k;
    mood = last && dayNumber(today) - dayNumber(last) >= 3 ? 'missing' : 'resting';
  }
  const bond = bondOf(d);
  const { level, toNext } = petLevel(bond);
  const week: PetView['week'] = [];
  for (let i = 6; i >= 0; i--) {
    const k = addDays(today, -i);
    const m = did(d.care[k]?.[me]);
    const t = !!them && did(d.care[k]?.[them]);
    week.push({ day: k, me: m, them: t, both: !!d.days[k] || (m && t) });
  }
  return { mine, theirs, fed: any('feed'), played: any('play'), cuddled: any('cuddle'), mood, bond, level, toNext, week };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "fed and cuddled", "fed, played with and cuddled" */
function didList(c: PetCare) {
  const v = PET_ACTS.filter((a) => c[a] !== undefined).map((a) => PET_ACT_INFO[a].did);
  return v.length <= 1 ? v.join('') : `${v.slice(0, -1).join(', ')} and ${v[v.length - 1]}`;
}

/** how it's doing, in a line: `name` is its name, or "your ginger cat" while it hasn't got one */
export function petLine(v: PetView, name: string, theirName: string | null): string {
  const N = cap(name);
  switch (v.mood) {
    case 'both':
      return theirName ? `${N} is over the moon: you’ve both been by today.` : `${N} is happy you came by.`;
    case 'waiting':
      return `${theirName || 'Your person'} ${didList(v.theirs)} ${name} today. Your turn.`;
    case 'mine':
      return theirName ? `${N} is happy. ${theirName} hasn’t been by yet today.` : `${N} is happy you came by.`;
    case 'missing':
      return `${N} misses you. Come and say hello.`;
    default:
      return `${N} is curled up, waiting for you.`;
  }
}

/** what it does when you look after it */
export function petReaction(act: PetAct, name: string): string {
  const N = cap(name);
  if (act === 'feed') return `${N} wolfed it down.`;
  if (act === 'play') return `${N} chased the ball round the rug, then flopped back down.`;
  return `${N} snuggled right in.`;
}

const LEVEL_UP = ['is new here', 'is settling in', 'is loyal to you both now', 'is your best friend now', 'is family now'];

/** "Biscuit is loyal to you both now: 7 days of looking after Biscuit together." when a day takes it up a level */
export function petLevelUp(level: number, name: string): string {
  const l = Math.max(0, Math.min(PET_LEVELS.length - 1, level));
  return `${cap(name)} ${LEVEL_UP[l]}: ${PET_LEVELS[l].at} days of looking after ${name} together.`;
}

export type PetPatch = {
  care?: Record<string, Record<string, PetCare> | null>;
  days?: Record<string, true>;
};

/**
 * Looking after it: what to write when `me` does `act` today (null when you already have today). Your person
 * already having been by today makes it a day you both did; care older than two weeks is cleared out.
 */
export function carePatch(d: PetDoc, today: string, me: string, them: string | null, act: PetAct, now: number): PetPatch | null {
  if (d.care[today]?.[me]?.[act] !== undefined) return null;
  const care: NonNullable<PetPatch['care']> = { [today]: { [me]: { [act]: Math.round(now) } } };
  const oldest = addDays(today, -(PET_KEEP_DAYS - 1));
  for (const k of Object.keys(d.care)) if (k < oldest) care[k] = null;
  const out: PetPatch = { care };
  if (them && did(d.care[today]?.[them]) && !d.days[today]) out.days = { [today]: true };
  return out;
}

/** days you both came by that aren't counted yet (you both looked after it at once): null when there are none */
export function missingDays(d: PetDoc, me: string, them: string | null): PetPatch | null {
  if (!them) return null;
  const days: Record<string, true> = {};
  for (const [k, by] of Object.entries(d.care)) if (!d.days[k] && did(by[me]) && did(by[them])) days[k] = true;
  return Object.keys(days).length ? { days } : null;
}

/** what the room shows of it */
export interface PetCareState {
  fed: boolean;
  played: boolean;
  cuddled: boolean;
  both: boolean;
  waiting: boolean;
  level: number;
}

export const petCareState = (v: PetView): PetCareState => ({
  fed: v.fed,
  played: v.played,
  cuddled: v.cuddled,
  both: v.mood === 'both',
  waiting: v.mood === 'waiting',
  level: v.level,
});

/**
 * The demo room: nine days looked after together over the last two weeks (Loyal, five more to Best friend), and
 * Rohan fed Biscuit and played with Biscuit this morning, so it's waiting for you.
 */
export function demoPet(today = todayKey(), now = Date.now(), me = 'user-aanya', them = 'user-rohan'): PetDoc {
  const care: PetDoc['care'] = {};
  const days: PetDoc['days'] = {};
  const hour = 3600e3;
  const at = (back: number, h: number) => Math.round(now - back * 86400e3 - h * hour);
  const both = [1, 2, 3, 5, 6, 8, 9, 10, 12];
  for (const b of both) {
    const k = addDays(today, -b);
    days[k] = true;
    care[k] = {
      [me]: b % 2 ? { feed: at(b, 2), cuddle: at(b, 1) } : { play: at(b, 3) },
      [them]: b % 3 ? { feed: at(b, 5) } : { feed: at(b, 6), play: at(b, 4), cuddle: at(b, 4) },
    };
  }
  care[addDays(today, -4)] = { [them]: { feed: at(4, 2) } };
  care[addDays(today, -7)] = { [me]: { cuddle: at(7, 1) } };
  care[today] = { [them]: { feed: Math.round(now - 3 * hour), play: Math.round(now - 3 * hour + 4 * 60e3) } };
  return { care, days };
}
