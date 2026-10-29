import { JOURNEY, JOURNEY_DAYS } from './deckJourney';

/**
 * Daily letters: five cards a day (This or That, Know Me, Who's more likely,
 * Daily Connect or Far apart, and one In your words), plus an opt-in After
 * dark set of three (flirty, or hot when you've both chosen it).
 *
 * Which cards a couple gets on a date is worked out from the couple's id and
 * the date, so both phones agree without asking a server. Each person's
 * "today" is their own local date, so partners in different time zones each
 * get the letter at their own midnight; a letter opens once both have sealed
 * that date's letter.
 *
 * 30 days of knowing each other: one question a day for a couple's first
 * month (or whenever they start it), a little deeper each week. Its "days"
 * are keyed j01 to j30 instead of by date, and they work like letters: each of
 * you answers in secret, guesses the other's answer, and it opens when you've
 * both sealed.
 */

export type CardKind = 'tot' | 'know' | 'connect' | 'spicy' | 'journey' | 'open' | 'likely' | 'distance' | 'hot';
export type LetterKind = 'daily' | 'afterDark' | 'journey';

/**
 * choice: pick one of the options · open: answer in your own words · likely: pick one of you two
 * ("Who's more likely to…"; option 0 is whoever's answering, 1 is their person)
 */
export type CardStyle = 'choice' | 'open' | 'likely';

export interface Card {
  id: string;
  kind: CardKind;
  style: CardStyle;
  prompt: string;
  options: string[];
  /** also guess what your partner picked */
  guess: boolean;
  /** optional one-line note to your partner */
  note: boolean;
  /** a different label (and length) for the note */
  noteLabel?: string;
  noteMax?: number;
}

export interface CardAnswer {
  /** the option picked (0 on an open card) */
  pick: number;
  guess?: number;
  note?: string;
  /** an open card's answer, in your own words */
  text?: string;
}

/** how long an answer in your own words can be */
export const OPEN_MAX = 400;

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
  /** the 30 days, keyed j01 … j30 */
  journey: Record<string, LetterDay>;
  /** the date (YYYY-MM-DD) the two of you started the 30 days */
  journeyStart?: string;
  /** each person's own switch; After dark opens only when both are on */
  afterDarkOn: Record<string, boolean>;
  /** how hot each of you wants it: 1 flirty, 2 hot (the cards follow whichever of you is lower) */
  afterDarkHeat: Record<string, number>;
  /** dates saved by the once-a-week streak mend */
  repairs: string[];
}

export const emptyLetters = (): LettersState => ({
  daily: {},
  afterDark: {},
  journey: {},
  afterDarkOn: {},
  afterDarkHeat: {},
  repairs: [],
});

export const KIND_LABEL: Record<CardKind, string> = {
  tot: 'This or that',
  know: 'Know me',
  connect: 'Daily connect',
  spicy: 'After dark',
  journey: '30 days',
  open: 'In your words',
  likely: 'Who’s more likely',
  distance: 'Far apart',
  hot: 'After dark · hot',
};

/* ---------- dates (YYYY-MM-DD, each person's local calendar) ---------- */

export const pad = (n: number) => String(n).padStart(2, '0');

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

/**
 * How many cards each deck has, so working out today's cards doesn't need the decks themselves
 * (they load with the letters; see cards.ts, which checks these). Append to a deck, bump its number.
 */
export const DECK_SIZES: Record<Exclude<CardKind, 'journey'>, number> = {
  tot: 220,
  know: 220,
  connect: 120,
  spicy: 160,
  hot: 100,
  distance: 120,
  open: 200,
  likely: 149,
};

/** card ids are the deck's prefix and the card's place in it ("tot-12") */
export const ID_PREFIX: Record<CardKind, string> = {
  tot: 'tot',
  know: 'know',
  connect: 'con',
  spicy: 'ad',
  hot: 'hot',
  distance: 'far',
  open: 'open',
  likely: 'lk',
  journey: 'jr',
};

const ID_LISTS = new Map<CardKind, string[]>();
function idsOf(kind: Exclude<CardKind, 'journey'>) {
  let ids = ID_LISTS.get(kind);
  if (!ids) {
    ids = Array.from({ length: DECK_SIZES[kind] }, (_, i) => `${ID_PREFIX[kind]}-${i}`);
    ID_LISTS.set(kind, ids);
  }
  return ids;
}

export function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: number) {
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
 * Counting from it means a couple's first months never repeat a card.
 * `heat` is After dark's: 1 flirty, 2 hot (two hot cards and a flirty one).
 */
export function cardsFor(kind: LetterKind, coupleId: string, dateKey: string, startKey: string, heat = 1) {
  if (kind === 'journey') {
    const n = journeyDayOf(dateKey);
    return n ? [`jr-${n - 1}`] : [];
  }
  const day = dayNumber(dateKey) - dayNumber(startKey);
  if (kind === 'afterDark') {
    if (heat >= 2) return [...pick(idsOf('hot'), 2, `${coupleId}:hot`, day), ...pick(idsOf('spicy'), 1, `${coupleId}:ad`, day)];
    return pick(idsOf('spicy'), 3, `${coupleId}:ad`, day);
  }
  // the fourth card takes turns: Daily connect one day, Far apart the next
  const half = Math.floor(day / 2);
  const fourth = ((day % 2) + 2) % 2 === 0 ? pick(idsOf('connect'), 1, `${coupleId}:con`, half) : pick(idsOf('distance'), 1, `${coupleId}:far`, half);
  return [
    ...pick(idsOf('tot'), 1, `${coupleId}:tot`, day),
    ...pick(idsOf('know'), 1, `${coupleId}:know`, day),
    ...pick(idsOf('likely'), 1, `${coupleId}:lk`, day),
    ...fourth,
    ...pick(idsOf('open'), 1, `${coupleId}:open`, day),
  ];
}

/* ---------- 30 days of knowing each other ---------- */

export { JOURNEY, JOURNEY_DAYS };

/** j01 … j30 */
export const journeyKey = (n: number) => `j${pad(n)}`;
export const journeyDayOf = (key: string) => {
  const m = /^j(\d{2})$/.exec(key);
  const n = m ? Number(m[1]) : 0;
  return n >= 1 && n <= JOURNEY_DAYS ? n : 0;
};

/** How many days are open: one a day from the day you started (by your own calendar). */
export function journeyUnlocked(start: string | undefined, today: string) {
  if (!start) return 0;
  return Math.max(1, Math.min(JOURNEY_DAYS, dayNumber(today) - dayNumber(start) + 1));
}

/** Which chapter a day is in (0-based), and its place in the chapter (1-based). */
export function journeyChapter(n: number) {
  let left = n;
  for (let i = 0; i < JOURNEY.length; i++) {
    const len = JOURNEY[i].questions.length;
    if (left <= len) return { index: i, chapter: JOURNEY[i], dayInChapter: left, last: left === len };
    left -= len;
  }
  const i = JOURNEY.length - 1;
  return { index: i, chapter: JOURNEY[i], dayInChapter: JOURNEY[i].questions.length, last: true };
}

export interface JourneyInfo {
  started: boolean;
  start?: string;
  /** days open so far */
  unlocked: number;
  /** the first open day you haven't answered yet */
  next: number | null;
  /** a day that's opened since you last looked */
  unseen: number | null;
  /** days you've both answered */
  done: number;
  /** all 30 opened together */
  finished: boolean;
}

export function journeyInfo(state: LettersState, me: string, today: string): JourneyInfo {
  const start = state.journeyStart;
  const unlocked = journeyUnlocked(start, today);
  let next: number | null = null;
  let unseen: number | null = null;
  let done = 0;
  for (let n = 1; n <= JOURNEY_DAYS; n++) {
    const d = state.journey[journeyKey(n)];
    if (d?.revealedAt) {
      done++;
      if (unseen === null && !d.by[me]?.seenAt) unseen = n;
    }
    if (next === null && n <= unlocked && !d?.by[me]?.sealedAt) next = n;
  }
  return { started: !!start, start, unlocked, next, unseen, done, finished: done >= JOURNEY_DAYS };
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

