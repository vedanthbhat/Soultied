import { THIS_OR_THAT } from './deckThisOrThat';
import { KNOW_ME } from './deckKnowMe';
import { CONNECT } from './deckConnect';
import { AFTER_DARK } from './deckAfterDark';
import { JOURNEY, JOURNEY_DAYS } from './deckJourney';
import { OPEN } from './deckOpen';
import { LIKELY } from './deckLikely';
import { DISTANCE } from './deckDistance';
import { HOT } from './deckHot';
import {
  type Card,
  type CardAnswer,
  type CardKind,
  type CardStyle,
  type LetterDay,
  type LettersState,
  type UserLetter,
  DECK_SIZES,
  addDays,
  cardsFor,
  emptyLetters,
  hashStr,
  journeyKey,
  pad,
  rng,
} from './engine';

/**
 * The questions themselves: every deck, as cards. Loaded with the letters (not at the front door),
 * since it's most of the text in Soultied. engine.ts knows only how many cards each deck has.
 */

/* ---------- the card registry ---------- */

const CARDS = new Map<string, Card>();
const IDS: Record<CardKind, string[]> = {
  tot: [],
  know: [],
  connect: [],
  spicy: [],
  journey: [],
  open: [],
  likely: [],
  distance: [],
  hot: [],
};
const add = (c: Omit<Card, 'style'> & { style?: CardStyle }) => {
  const card: Card = { style: 'choice', ...c };
  CARDS.set(card.id, card);
  IDS[card.kind].push(card.id);
};

/**
 * One line of a deck as a card: [prompt] is answered in your own words, [a, b] or [a, b, prompt]
 * is this or that, [prompt, a, b, c, d] has four options.
 */
type Tuple = [string] | [string, string] | [string, string, string] | [string, string, string, string, string];
function fromTuple(x: Tuple, id: string, kind: CardKind, four: { guess: boolean; note: boolean }) {
  if (x.length === 1) return add({ id, kind, style: 'open', prompt: x[0], options: [], guess: false, note: false });
  if (x.length === 5) return add({ id, kind, prompt: x[0], options: x.slice(1), ...four });
  return add({ id, kind, prompt: x[2] || 'This or that?', options: [x[0], x[1]], guess: false, note: false });
}

THIS_OR_THAT.forEach((x, i) => fromTuple(x, `tot-${i}`, 'tot', { guess: false, note: false }));
KNOW_ME.forEach((x, i) => fromTuple(x, `know-${i}`, 'know', { guess: true, note: false }));
CONNECT.forEach((x, i) => fromTuple(x, `con-${i}`, 'connect', { guess: false, note: true }));
AFTER_DARK.forEach((x, i) => fromTuple(x, `ad-${i}`, 'spicy', { guess: false, note: false }));
HOT.forEach((x, i) => fromTuple(x, `hot-${i}`, 'hot', { guess: false, note: false }));
DISTANCE.forEach((x, i) => fromTuple(x, `far-${i}`, 'distance', { guess: true, note: false }));
OPEN.forEach((x, i) => fromTuple(x, `open-${i}`, 'open', { guess: false, note: false }));
LIKELY.forEach((ending, i) =>
  add({ id: `lk-${i}`, kind: 'likely', style: 'likely', prompt: `Who’s more likely to ${ending}?`, options: ['Me', 'You'], guess: false, note: false }),
);

JOURNEY.flatMap((ch) => ch.questions).forEach(([p, a, b, c, d], i) =>
  add({
    id: `jr-${i}`,
    kind: 'journey',
    prompt: p,
    options: [a, b, c, d],
    guess: true,
    note: true,
    // the last day: a letter to each other
    ...(i === JOURNEY_DAYS - 1 ? { noteLabel: 'Write them a letter about this month', noteMax: 600 } : {}),
  }),
);

/** how many questions there are, all told */
export const CARD_COUNT = CARDS.size;

// engine.ts picks each day's cards from its own count of each deck: they have to agree
for (const [kind, n] of Object.entries(DECK_SIZES)) {
  if (IDS[kind as CardKind].length !== n) console.error(`[soultied] the ${kind} deck has ${IDS[kind as CardKind].length} cards, engine.ts says ${n}`);
}

export const cardById = (id: string) => CARDS.get(id);
export const cardsOf = (ids: string[]) => ids.map((id) => CARDS.get(id)).filter((c): c is Card => !!c);

/** "Chai or coffee?" reads better than a generic "This or that?" once answered. */
export const cardTitle = (c: Card) =>
  c.options.length === 2 && c.prompt === 'This or that?' ? `${c.options[0]} or ${c.options[1]}?` : c.prompt;


export function isAnswered(card: Card, a?: CardAnswer) {
  if (!a || a.pick == null) return false;
  if (card.style === 'open') return !!a.text?.trim();
  if (card.guess && a.guess == null) return false;
  return true;
}

/** On a "who's more likely" card, which of you an answer points at: true for whoever answered. */
export const likelyIsSelf = (a: CardAnswer) => a.pick === 0;

/** Did you two give the same answer? (Open cards can't match, so they're left out.) */
export function sameAnswer(card: Card, a: CardAnswer, b: CardAnswer) {
  if (card.style === 'open') return false;
  // "me" from one of you and "you" from the other point at the same person
  if (card.style === 'likely') return a.pick !== b.pick;
  return a.pick === b.pick;
}

/** cards you can be "in sync" on (everything but answers in your own words) */
export const comparable = (card: Card) => card.style !== 'open';

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
    total: cards.filter(comparable).length,
    myGuesses: { right: 0, total: 0 },
    theirGuesses: { right: 0, total: 0 },
    talkAbout: null,
  };
  const splits: Card[] = [];
  for (const c of cards) {
    const a = mine[c.id];
    const b = theirs[c.id];
    if (!a || !b || !comparable(c)) continue;
    if (sameAnswer(c, a, b)) s.same++;
    else splits.push(c);
    if (c.guess) {
      s.myGuesses.total++;
      s.theirGuesses.total++;
      if (a.guess === b.pick) s.myGuesses.right++;
      if (b.guess === a.pick) s.theirGuesses.right++;
    }
  }
  const depth: Record<CardKind, number> = {
    journey: -1,
    connect: 0,
    distance: 0,
    open: 0,
    spicy: 1,
    hot: 1,
    know: 2,
    likely: 2,
    tot: 3,
  };
  splits.sort((x, y) => depth[x.kind] - depth[y.kind] || y.options.length - x.options.length);
  s.talkAbout = splits[0]?.id || null;
  return s;
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

/** made-up answers in your own words, for the demo room */
const WORDS = [
  'Honestly? The way you laugh at your own jokes before you finish them.',
  'A slow Sunday: pancakes, a long walk, and a film we both fall asleep to.',
  'When you stayed on the call until I fell asleep, even though it was 3 am for you.',
  'Probably something about whose turn it is to do the dishes.',
  'That you’re braver than you think. I see it every week.',
  'Fairy lights, a big sofa, and too many plants.',
  'The first time we met, I couldn’t stop smiling for the whole train home.',
  'Our next visit. I’ve already planned the first day.',
];

export function demoLetters(coupleId: string, startKey: string, a: string, b: string, today: string): LettersState {
  const r = rng(hashStr(coupleId + today));
  const st = emptyLetters();
  const answer = (c: Card, other?: CardAnswer): CardAnswer => {
    if (c.style === 'open') return { pick: 0, text: WORDS[Math.floor(r() * WORDS.length)] };
    const n = c.options.length;
    // agreeing on "who's more likely" means picking the opposite side
    if (c.style === 'likely') return { pick: other && r() < 0.6 ? 1 - other.pick : Math.floor(r() * 2) };
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

  // three days into the 30 days; Rohan has already answered day 4
  st.journeyStart = addDays(today, -3);
  const JNOTES = ['Same, always.', 'Okay this one made me smile.', 'Tell you the story on our call.'];
  for (let n = 1; n <= 4; n++) {
    const key = journeyKey(n);
    const card = cardById(`jr-${n - 1}`)!;
    const x = answer(card);
    const y = answer(card, x);
    x.guess = r() < 0.6 ? y.pick : Math.floor(r() * 4);
    y.guess = r() < 0.6 ? x.pick : Math.floor(r() * 4);
    if (n % 2) y.note = JNOTES[(n - 1) / 2];
    const at = `${addDays(today, n - 4)}T22:${pad(10 + n)}:00`;
    const day: LetterDay = { dateKey: key, cardIds: [card.id], by: { [b]: { cards: { [card.id]: y }, sealedAt: at, seenAt: n < 4 ? at : undefined } } };
    if (n < 4) {
      day.by[a] = { cards: { [card.id]: x }, sealedAt: at, seenAt: at };
      day.revealedAt = at;
    }
    st.journey[key] = day;
  }
  return st;
}
