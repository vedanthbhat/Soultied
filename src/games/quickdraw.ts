import type { Seat } from './types';
import type { LiveDef } from './live/lobby';
import { COUNTDOWN_MS } from './live/lobby';

/**
 * Quick Draw: a lantern lights at a random moment; whoever taps first after
 * it lights wins the round. Tap while it's still dark and you lose the round.
 * First to three.
 *
 * Fair across two screens: the moment it lights is decided in advance and each
 * screen times its own person's reaction from when it lit *on that screen*, so
 * the line between you doesn't slow anyone down.
 */

export const TO_WIN = 3;
/** after the lantern lights, how long before the round's called */
const WINDOW_MS = 2600;
const SHOW_MS = 2400;

export type QuickTap = { ms: number } | { early: true };

export interface QuickState {
  round: number;
  score: Record<Seat, number>;
  phase: 'play' | 'show';
  /** when the lantern lights (host's clock) */
  litAt: number;
  taps: Partial<Record<Seat, QuickTap>>;
  showUntil: number;
  /** what happened last round */
  last: { winner: Seat | null; taps: Partial<Record<Seat, QuickTap>> } | null;
  winner: Seat | null;
}

export type QuickAct = QuickTap & { round: number };

const nextLit = (now: number) => now + 1400 + Math.random() * 2800;

function resolve(s: QuickState, now: number): QuickState {
  const t = s.taps;
  const early = (x?: QuickTap) => !!x && 'early' in x;
  const ms = (x?: QuickTap) => (x && 'ms' in x ? x.ms : Infinity);
  let w: Seat | null = null;
  if (early(t.a) && !early(t.b)) w = 'b';
  else if (early(t.b) && !early(t.a)) w = 'a';
  else if (!early(t.a) && !early(t.b)) {
    const ma = ms(t.a);
    const mb = ms(t.b);
    if (ma < mb) w = 'a';
    else if (mb < ma) w = 'b';
  }
  const score = { ...s.score };
  if (w) score[w] += 1;
  return { ...s, phase: 'show', score, showUntil: now + SHOW_MS, last: { winner: w, taps: t } };
}

export const QUICK: LiveDef<QuickState, QuickAct> = {
  init: (_rng, now) => ({
    round: 1,
    score: { a: 0, b: 0 },
    phase: 'play',
    litAt: nextLit(now + COUNTDOWN_MS),
    taps: {},
    showUntil: 0,
    last: null,
    winner: null,
  }),
  act: (s, seat, a, now) => {
    if (s.winner || s.phase !== 'play' || !a || a.round !== s.round || s.taps[seat]) return s;
    const tap: QuickTap = 'early' in a ? { early: true } : { ms: Math.max(80, Math.min(5000, Math.round(a.ms))) };
    const taps = { ...s.taps, [seat]: tap };
    const next = { ...s, taps };
    // a tap in the dark ends the round straight away; otherwise wait for both (or the window)
    if ('early' in tap || (taps.a && taps.b)) return resolve(next, now);
    return next;
  },
  tick: (s, now) => {
    if (s.winner) return s;
    if (s.phase === 'play' && now > s.litAt + WINDOW_MS) return resolve(s, now);
    if (s.phase === 'show' && now >= s.showUntil) {
      if (s.score.a >= TO_WIN || s.score.b >= TO_WIN) return { ...s, winner: s.score.a > s.score.b ? 'a' : 'b' };
      return { ...s, phase: 'play', round: s.round + 1, taps: {}, litAt: nextLit(now) };
    }
    return s;
  },
  result: (s) =>
    s.winner ? { winner: s.winner, line: `won Quick Draw ${s.score[s.winner]}–${s.score[s.winner === 'a' ? 'b' : 'a']}`, score: s.score } : null,
  bot: (s, seat, now) => {
    if (s.phase !== 'play' || s.taps[seat]) return null;
    // now and then it jumps the gun; otherwise it's quick but beatable
    if (now < s.litAt) return now > s.litAt - 300 && Math.random() < 0.012 ? { early: true, round: s.round } : null;
    const react = 255 + ((s.round * 131) % 170);
    return now >= s.litAt + react ? { ms: react, round: s.round } : null;
  },
  botMs: 40,
  tickMs: 60,
};
