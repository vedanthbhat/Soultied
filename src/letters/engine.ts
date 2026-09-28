import { THIS_OR_THAT } from './deckThisOrThat';
import { KNOW_ME } from './deckKnowMe';
import { CONNECT } from './deckConnect';
import { AFTER_DARK } from './deckAfterDark';

/**
 * Daily letters: five quick cards a day (This or That ×2, Know Me ×2,
 * Daily Connect ×1), plus an opt-in After dark set of three.
 *
 * Which cards a couple gets on a date is worked out from the couple's id and
 * the date, so both phones agree without asking a server. Each person's
 * "today" is their own local date, so partners in different time zones each
 * get the letter at their own midnight; a letter opens once both have sealed
 * that date's letter.
 */

export type CardKind = 'tot' | 'know' | 'connect' | 'spicy';
export type LetterKind = 'daily' | 'afterDark';

export interface Card {
  id: string;
  kind: CardKind;
  prompt: string;
  options: string[];
  /** also guess what your partner picked */
  guess: boolean;
  /** optional one-line note to your partner */
  note: boolean;
}

export interface CardAnswer {
  pick: number;
  guess?: number;
  note?: string;
}

export interface UserLetter {
  cards: Record<string, CardAnswer>;
  sealedAt?: string;
  /** when this person first saw the opened letter */
  seenAt?: string;
}

export interface LetterDay {
  dateKey: string;
  cardIds: string[];
  by: Record<string, UserLetter>;
  revealedAt?: string;
}

export interface LettersState {
  daily: Record<string, LetterDay>;
  afterDark: Record<string, LetterDay>;
  /** each person's own switch; After dark opens only when both are on */
  afterDarkOn: Record<string, boolean>;
  /** dates saved by the once-a-week streak mend */
  repairs: string[];
}

export const emptyLetters = (): LettersState => ({
  daily: {},
  afterDark: {},
  afterDarkOn: {},
  repairs: [],
});

/* ---------- the card registry ---------- */

const CARDS = new Map<string, Card>();
const IDS: Record<CardKind, string[]> = {
  tot: [],
  know: [],
  connect: [],
  spicy: [],
};
const add = (c: Card) => {
  CARDS.set(c.id, c);
  IDS[c.kind].push(c.id);
};

THIS_OR_THAT.forEach((x, i) =>
  add({
    id: `tot-${i}`,
    kind: 'tot',
    prompt: x[2] || 'This or that?',
    options: [x[0], x[1]],
    guess: false,
    note: false,
  }),
);
KNOW_ME.forEach(([p, a, b, c, d], i) =>
  add({
    id: `know-${i}`,
    kind: 'know',
    prompt: p,
    options: [a, b, c, d],
    guess: true,
    note: false,
  }),
);
CONNECT.forEach(([p, a, b, c, d], i) =>
  add({
    id: `con-${i}`,
    kind: 'connect',
    prompt: p,
    options: [a, b, c, d],
    guess: false,
    note: true,
  }),
);
AFTER_DARK.forEach((x, i) =>
  add(
    x.length === 5
      ? {
          id: `ad-${i}`,
          kind: 'spicy',
          prompt: x[0],
          options: x.slice(1),
          guess: false,
          note: false,
        }
      : {
          id: `ad-${i}`,
          kind: 'spicy',
          prompt: x[2] || 'This or that?',
          options: [x[0], x[1]],
          guess: false,
          note: false,
        },
  ),
);

export const cardById = (id: string) => CARDS.get(id);
export const cardsOf = (ids: string[]) => ids.map((id) => CARDS.get(id)).filter((c): c is Card => !!c);

/** "Chai or coffee?" reads better than a generic "This or that?" once answered. */
export const cardTitle = (c: Card) =>
  c.options.length === 2 && c.prompt === 'This or that?' ? `${c.options[0]} or ${c.options[1]}?` : c.prompt;

export const KIND_LABEL: Record<CardKind, string> = {
  tot: 'This or that',
  know: 'Know me',
  connect: 'Daily connect',
  spicy: 'After dark',
};

/* ---------- dates (YYYY-MM-DD, each person's local calendar) ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

export function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const parts = (key: string) => key.split('-').map(Number) as [number, number, number];

export function addDays(key: string, n: number) {
  const [y, m, d] = parts(key);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const dayNumber = (key: string) => {
  const [y, m, d] = parts(key);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** Monday = 0 … Sunday = 6 */
export function weekday(key: string) {
  const [y, m, d] = parts(key);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const weekStart = (key: string) => addDays(key, -weekday(key));

export function prettyDate(key: string, long = false) {
  const [y, m, d] = parts(key);
  return new Date(y, m - 1, d).toLocaleDateString(
    undefined,
    long ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short' },
  );
}

/* ---------- which cards on which day ---------- */

function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PERMS = new Map<string, number[]>();
function permutation(n: number, seed: string) {
  const key = `${n}:${seed}`;
  let p = PERMS.get(key);
  if (!p) {
    const r = rng(hashStr(seed));
    p = Array.from({ length: n }, (_, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    PERMS.set(key, p);
  }
  return p;
}

/** Walks a fresh shuffle of the deck each cycle, so nothing repeats until the deck runs out. */
function pick(ids: string[], perDay: number, seed: string, day: number) {
  const n = ids.length;
  const out: string[] = [];
  for (let k = 0; k < perDay; k++) {
    const slot = day * perDay + k;
    const cycle = Math.floor(slot / n);
    out.push(ids[permutation(n, `${seed}:${cycle}`)[((slot % n) + n) % n]]);
  }
  return out;
}

/**
 * `startKey` is the couple's first day (a fixed date both phones agree on).
 * Counting from it means a couple's first two months never repeat a card.
 */
export function cardsFor(kind: LetterKind, coupleId: string, dateKey: string, startKey: string) {
  const day = dayNumber(dateKey) - dayNumber(startKey);
  if (kind === 'afterDark') return pick(IDS.spicy, 3, `${coupleId}:ad`, day);
  return [
    ...pick(IDS.tot, 2, `${coupleId}:tot`, day),
    ...pick(IDS.know, 2, `${coupleId}:know`, day),
    ...pick(IDS.connect, 1, `${coupleId}:con`, day),
  ];
}

export function isAnswered(card: Card, a?: CardAnswer) {
  if (!a || a.pick == null) return false;
  if (card.guess && a.guess == null) return false;
  return true;
}

/* ---------- scoring ---------- */

export interface Score {
  same: number;
  total: number;
  myGuesses: { right: number; total: number };
  theirGuesses: { right: number; total: number };
  /** the card worth talking about tonight (first one you split on, deepest first) */
  talkAbout: string | null;
}

export function scoreDay(day: LetterDay, me: string, them: string): Score {
  const cards = cardsOf(day.cardIds);
  const mine = day.by[me]?.cards || {};
  const theirs = day.by[them]?.cards || {};
  const s: Score = {
    same: 0,
    total: cards.length,
    myGuesses: { right: 0, total: 0 },
    theirGuesses: { right: 0, total: 0 },
    talkAbout: null,
  };
  const splits: Card[] = [];
  for (const c of cards) {
    const a = mine[c.id];
    const b = theirs[c.id];
    if (!a || !b) continue;
    if (a.pick === b.pick) s.same++;
    else splits.push(c);
    if (c.guess) {
      s.myGuesses.total++;
      s.theirGuesses.total++;
      if (a.guess === b.pick) s.myGuesses.right++;
      if (b.guess === a.pick) s.theirGuesses.right++;
    }
  }
  const depth: Record<CardKind, number> = {
    connect: 0,
    spicy: 1,
    know: 2,
    tot: 3,
  };
  splits.sort((x, y) => depth[x.kind] - depth[y.kind] || y.options.length - x.options.length);
  s.talkAbout = splits[0]?.id || null;
  return s;
}

/* ---------- streaks ---------- */

export type DayState = 'done' | 'mended' | 'missed' | 'today' | 'upcoming' | 'before';

export interface StreakInfo {
  current: number;
  best: number;
  /** letters opened together, ever */
  together: number;
  week: Array<{ key: string; label: string; state: DayState }>;
  /** a missed yesterday that can still be mended (once a week) */
  mendable: string | null;
}

export function streakInfo(state: LettersState, today: string, sinceKey?: string): StreakInfo {
  const done = new Set(
    Object.values(state.daily)
      .filter((d) => d.revealedAt)
      .map((d) => d.dateKey),
  );
  const mended = new Set(state.repairs);
  const ok = (k: string) => done.has(k) || mended.has(k);

  let current = 0;
  for (let k = ok(today) ? today : addDays(today, -1); ok(k); k = addDays(k, -1)) current++;

  let best = current;
  const keys = [...new Set([...done, ...mended])].sort();
  let run = 0;
  keys.forEach((k, i) => {
    run = i > 0 && addDays(keys[i - 1], 1) === k ? run + 1 : 1;
    best = Math.max(best, run);
  });

  const mon = weekStart(today);
  const week = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => {
    const key = addDays(mon, i);
    let st: DayState;
    if (key > today) st = 'upcoming';
    else if (done.has(key)) st = 'done';
    else if (mended.has(key)) st = 'mended';
    else if (key === today) st = 'today';
    else if (sinceKey && key < sinceKey) st = 'before';
    else st = 'missed';
    return { key, label, state: st };
  });

  const y = addDays(today, -1);
  const usedThisWeek = state.repairs.some((r) => weekStart(r) === weekStart(y));
  const mendable = !ok(y) && ok(addDays(y, -1)) && !usedThisWeek && (!sinceKey || y >= sinceKey) ? y : null;

  return { current, best, together: done.size, week, mendable };
}

/* ---------- demo room history ---------- */

const NOTES = [
  'Can’t wait for December.',
  'You make the distance feel smaller.',
  'Call me tonight?',
  'Still thinking about our last trip.',
  'Proud of you, always.',
  'Save me a seat on the couch.',
];

export function demoLetters(coupleId: string, startKey: string, a: string, b: string, today: string): LettersState {
  const r = rng(hashStr(coupleId + today));
  const st = emptyLetters();
  const answer = (c: Card, other?: CardAnswer): CardAnswer => {
    const n = c.options.length;
    const pick = other && r() < 0.6 ? other.pick : Math.floor(r() * n);
    return { pick };
  };
  const build = (key: string, who: 'both' | 'a' | 'b', note?: string) => {
    const cardIds = cardsFor('daily', coupleId, key, startKey);
    const cards = cardsOf(cardIds);
    const A: UserLetter = { cards: {} };
    const B: UserLetter = { cards: {} };
    for (const c of cards) {
      const x = answer(c);
      const y = answer(c, x);
      if (c.guess) {
        x.guess = r() < 0.55 ? y.pick : Math.floor(r() * c.options.length);
        y.guess = r() < 0.65 ? x.pick : Math.floor(r() * c.options.length);
      }
      if (c.note) {
        if (r() < 0.5) x.note = NOTES[Math.floor(r() * NOTES.length)];
        y.note = note || (r() < 0.6 ? NOTES[Math.floor(r() * NOTES.length)] : undefined);
      }
      A.cards[c.id] = x;
      B.cards[c.id] = y;
    }
    const at = `${key}T21:${pad(10 + Math.floor(r() * 40))}:00`;
    const day: LetterDay = { dateKey: key, cardIds, by: {} };
    if (who !== 'b')
      day.by[a] = {
        ...A,
        sealedAt: at,
        seenAt: who === 'both' ? at : undefined,
      };
    if (who !== 'a')
      day.by[b] = {
        ...B,
        sealedAt: at,
        seenAt: who === 'both' ? at : undefined,
      };
    if (who === 'both') day.revealedAt = at;
    st.daily[key] = day;
  };
  for (const back of [1, 2, 3, 4, 6, 7, 8, 9, 10, 11, 12, 14, 16, 17]) build(addDays(today, -back), 'both');
  build(addDays(today, -5), 'a');
  build(today, 'b', 'Miss your laugh. Call tonight?');
  st.afterDarkOn[b] = true;
  return st;
}
