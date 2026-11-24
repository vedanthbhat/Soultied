import type { Seat } from './types';
import { otherSeat } from './types';
import type { LiveDef } from './live/lobby';
import { COUNTDOWN_MS } from './live/lobby';

/**
 * Paper, Scissors, Stone, live: each round you've a few seconds to pick, and
 * neither of you sees the other's pick until you've both chosen (or time's up;
 * no pick loses the round). First to three.
 */

export type Hand = 'paper' | 'scissors' | 'stone';
export const HANDS: Hand[] = ['stone', 'paper', 'scissors'];
export const TO_WIN = 3;
export const PICK_MS = 5000;
const SHOW_MS = 2600;

const BEATS: Record<Hand, Hand> = { paper: 'stone', scissors: 'paper', stone: 'scissors' };

export interface RpsState {
  round: number;
  score: Record<Seat, number>;
  phase: 'pick' | 'show';
  /** picks this round; the other person's stays hidden on screen until the reveal */
  picks: Partial<Record<Seat, Hand>>;
  pickUntil: number;
  showUntil: number;
  last: { hands: Partial<Record<Seat, Hand>>; winner: Seat | null } | null;
  winner: Seat | null;
  /** the house rule (houseRules.ts): 'quick', 'banned' or 'quickest' */
  rule?: string;
  /** Banned hand: the hand that isn't allowed, round by round (round 1 is the first) */
  bans?: Hand[];
  /** Fastest wins ties: who picked first this round */
  first?: Seat | null;
}

/** how long there is to pick */
export const pickMsOf = (s: RpsState | null | undefined) => (s?.rule === 'quick' ? 2000 : PICK_MS);
/** the hand that isn't allowed this round (Banned hand) */
export const bannedHand = (s: RpsState | null | undefined): Hand | null => (s?.bans?.length ? s.bans[(s.round - 1) % s.bans.length] : null);

export interface RpsAct {
  round: number;
  hand: Hand;
}

function reveal(s: RpsState, now: number): RpsState {
  const { a, b } = s.picks;
  let w: Seat | null = null;
  if (a && !b) w = 'a';
  else if (b && !a) w = 'b';
  else if (a && b && a !== b) w = BEATS[a] === b ? 'a' : 'b';
  else if (a && b && s.first) w = s.first;
  const score = { ...s.score };
  if (w) score[w] += 1;
  return { ...s, phase: 'show', score, showUntil: now + SHOW_MS, last: { hands: s.picks, winner: w } };
}

export const beats = (x: Hand, y: Hand) => BEATS[x] === y;

export const RPS: LiveDef<RpsState, RpsAct> = {
  init: (rng, now, rule) => ({
    round: 1,
    score: { a: 0, b: 0 },
    phase: 'pick',
    picks: {},
    pickUntil: now + COUNTDOWN_MS + (rule === 'quick' ? 2000 : PICK_MS),
    showUntil: 0,
    last: null,
    winner: null,
    ...(rule ? { rule } : {}),
    ...(rule === 'banned' ? { bans: [...Array(12).keys()].map(() => HANDS[Math.floor(rng() * 3)]) } : {}),
    ...(rule === 'quickest' ? { first: null } : {}),
  }),
  act: (s, seat, a, now) => {
    if (s.winner || s.phase !== 'pick' || !a || a.round !== s.round || s.picks[seat] || !HANDS.includes(a.hand)) return s;
    if (a.hand === bannedHand(s)) return s;
    const picks = { ...s.picks, [seat]: a.hand };
    const next = { ...s, picks, ...(s.rule === 'quickest' && !s.first ? { first: seat } : {}) };
    return picks[otherSeat(seat)] ? reveal(next, now) : next;
  },
  tick: (s, now) => {
    if (s.winner) return s;
    if (s.phase === 'pick' && now >= s.pickUntil) return reveal(s, now);
    if (s.phase === 'show' && now >= s.showUntil) {
      if (s.score.a >= TO_WIN || s.score.b >= TO_WIN) return { ...s, winner: s.score.a > s.score.b ? 'a' : 'b' };
      return { ...s, phase: 'pick', round: s.round + 1, picks: {}, pickUntil: now + pickMsOf(s), ...(s.rule === 'quickest' ? { first: null } : {}) };
    }
    return s;
  },
  result: (s) =>
    s.winner ? { winner: s.winner, line: `won Paper, Scissors, Stone ${s.score[s.winner]}–${s.score[otherSeat(s.winner)]}`, score: s.score } : null,
  bot: (s, seat, now) => {
    if (s.phase !== 'pick' || s.picks[seat]) return null;
    const left = s.pickUntil - now;
    if (!(left < pickMsOf(s) - 900 && Math.random() < 0.08)) return null;
    const hand = HANDS[Math.floor(Math.random() * 3)];
    // (it knows the banned hand too)
    return hand === bannedHand(s) ? null : { round: s.round, hand };
  },
  botMs: 120,
  tickMs: 100,
};
