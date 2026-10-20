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
}

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
  const score = { ...s.score };
  if (w) score[w] += 1;
  return { ...s, phase: 'show', score, showUntil: now + SHOW_MS, last: { hands: s.picks, winner: w } };
}

export const beats = (x: Hand, y: Hand) => BEATS[x] === y;

export const RPS: LiveDef<RpsState, RpsAct> = {
  init: (_rng, now) => ({
    round: 1,
    score: { a: 0, b: 0 },
    phase: 'pick',
    picks: {},
    pickUntil: now + COUNTDOWN_MS + PICK_MS,
    showUntil: 0,
    last: null,
    winner: null,
  }),
  act: (s, seat, a, now) => {
    if (s.winner || s.phase !== 'pick' || !a || a.round !== s.round || s.picks[seat] || !HANDS.includes(a.hand)) return s;
    const picks = { ...s.picks, [seat]: a.hand };
    const next = { ...s, picks };
    return picks[otherSeat(seat)] ? reveal(next, now) : next;
  },
  tick: (s, now) => {
    if (s.winner) return s;
    if (s.phase === 'pick' && now >= s.pickUntil) return reveal(s, now);
    if (s.phase === 'show' && now >= s.showUntil) {
      if (s.score.a >= TO_WIN || s.score.b >= TO_WIN) return { ...s, winner: s.score.a > s.score.b ? 'a' : 'b' };
      return { ...s, phase: 'pick', round: s.round + 1, picks: {}, pickUntil: now + PICK_MS };
    }
    return s;
  },
  result: (s) =>
    s.winner ? { winner: s.winner, line: `won Paper, Scissors, Stone ${s.score[s.winner]}–${s.score[otherSeat(s.winner)]}`, score: s.score } : null,
  bot: (s, seat, now) => {
    if (s.phase !== 'pick' || s.picks[seat]) return null;
    const left = s.pickUntil - now;
    return left < PICK_MS - 900 && Math.random() < 0.08 ? { round: s.round, hand: HANDS[Math.floor(Math.random() * 3)] } : null;
  },
  botMs: 120,
  tickMs: 100,
};
