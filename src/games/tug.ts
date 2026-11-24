import type { Seat } from './types';
import type { LiveDef } from './live/lobby';
import { COUNTDOWN_MS } from './live/lobby';

/**
 * Tug of War: tap as fast as you can. Every tap pulls the ribbon a little
 * towards you; get it all the way over (a lead of PULL taps) and you win, or
 * whoever's ahead when the twenty seconds are up does.
 */

export const DURATION_MS = 20_000;
/** a lead of this many taps pulls the ribbon all the way over */
export const PULL = 28;

export interface TugState {
  taps: Record<Seat, number>;
  /** -1 (all the way to b) … 1 (all the way to a) */
  pos: number;
  endsAt: number;
  winner: Seat | 'draw' | null;
  /** the house rule (houseRules.ts): 'final', 'short' or 'sprint' */
  rule?: string;
  /** Final stretch: the extra pull from taps in the last five seconds */
  bonus?: Record<Seat, number>;
}

/** how big a lead pulls the ribbon all the way over */
export const pullOf = (s: TugState) => (s.rule === 'short' ? 14 : PULL);
/** the lead, counting the Final stretch's extra pull */
const lead = (s: TugState) => s.taps.a + (s.bonus?.a || 0) - (s.taps.b + (s.bonus?.b || 0));

export interface TugAct {
  /** how many times you've tapped this game, so a lost message doesn't lose taps */
  taps: number;
}

const settle = (s: TugState, now: number): TugState => {
  if (s.winner) return s;
  const l = lead(s);
  const pos = Math.max(-1, Math.min(1, l / pullOf(s)));
  if (pos >= 1) return { ...s, pos, winner: 'a' };
  if (pos <= -1) return { ...s, pos, winner: 'b' };
  if (now >= s.endsAt) return { ...s, pos, winner: l === 0 ? 'draw' : l > 0 ? 'a' : 'b' };
  return pos === s.pos ? s : { ...s, pos };
};

export const TUG: LiveDef<TugState, TugAct> = {
  init: (_rng, now, rule) => ({
    taps: { a: 0, b: 0 },
    pos: 0,
    endsAt: now + COUNTDOWN_MS + (rule === 'sprint' ? DURATION_MS / 2 : DURATION_MS),
    winner: null,
    ...(rule ? { rule } : {}),
    ...(rule === 'final' ? { bonus: { a: 0, b: 0 } } : {}),
  }),
  act: (s, seat, a, now) => {
    if (s.winner || typeof a?.taps !== 'number') return s;
    // never more than ~16 taps a second, whatever arrives
    const n = Math.min(Math.floor(a.taps), s.taps[seat] + 40);
    if (n <= s.taps[seat]) return s;
    // Final stretch: in the last five seconds every tap counts twice
    const bonus = s.bonus && now >= s.endsAt - 5000 ? { ...s.bonus, [seat]: s.bonus[seat] + (n - s.taps[seat]) } : s.bonus;
    return settle({ ...s, taps: { ...s.taps, [seat]: n }, ...(bonus ? { bonus } : {}) }, now);
  },
  tick: (s, now) => settle(s, now),
  result: (s) => {
    if (!s.winner) return null;
    const score = { a: s.taps.a, b: s.taps.b };
    if (s.winner === 'draw') return { winner: 'draw', line: s.bonus ? 'tied' : `tied at ${s.taps.a} taps each`, score };
    const all = Math.abs(s.pos) >= 1;
    return { winner: s.winner, line: all ? 'pulled the ribbon all the way over' : `won Tug of War by ${Math.abs(lead(s))} taps`, score };
  },
  bot: (s, seat) => (Math.random() < 0.82 ? { taps: s.taps[seat] + 1 } : null),
  botMs: 135,
  tickMs: 80,
  continuous: true,
  phase: (s) => (s.winner ? 'end' : 'play'),
};
