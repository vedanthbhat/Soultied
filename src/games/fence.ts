import type { Seat } from './types';
import { otherSeat } from './types';

/**
 * Fence the Garden: dots and boxes. A 5x5 garden of beds, 6x6 posts. Each turn
 * you add one piece of fence; close a bed's fourth side and it's yours (a
 * flower grows in it) and you go again.
 *
 * Fences are a 60-character string: the 30 across (6 rows of 5) first, then the
 * 30 down (5 rows of 6). '.' not built yet, 'a' / 'b' who built it.
 * Beds are a 25-character string, '.' or whose it is.
 */

export const N = 5;
export const H_COUNT = (N + 1) * N;
export const EDGES = H_COUNT * 2;

export interface FenceState {
  fences: string;
  beds: string;
  lastEdge: number | null;
  /** beds closed by the last move, for a little bloom */
  lastBeds: number[];
}

export const emptyFence = (): FenceState => ({ fences: '.'.repeat(EDGES), beds: '.'.repeat(N * N), lastEdge: null, lastBeds: [] });

/** the fence along the top of row r (r = 0..N), between posts c and c+1 */
export const hEdge = (r: number, c: number) => r * N + c;
/** the fence down the left of column c (c = 0..N), between posts r and r+1 */
export const vEdge = (r: number, c: number) => H_COUNT + r * (N + 1) + c;

export const bedEdges = (r: number, c: number) => [hEdge(r, c), hEdge(r + 1, c), vEdge(r, c), vEdge(r, c + 1)];

/** the one or two beds a piece of fence borders */
export function bedsBeside(e: number): number[] {
  const out: number[] = [];
  if (e < H_COUNT) {
    const r = Math.floor(e / N);
    const c = e % N;
    if (r > 0) out.push((r - 1) * N + c);
    if (r < N) out.push(r * N + c);
  } else {
    const k = e - H_COUNT;
    const r = Math.floor(k / (N + 1));
    const c = k % (N + 1);
    if (c > 0) out.push(r * N + c - 1);
    if (c < N) out.push(r * N + c);
  }
  return out;
}

const sidesBuilt = (fences: string, bed: number) => bedEdges(Math.floor(bed / N), bed % N).filter((e) => fences[e] !== '.').length;

export const fenceCount = (st: FenceState, s: Seat) => [...st.beds].filter((b) => b === s).length;

export interface FenceMove {
  state: FenceState;
  /** closed at least one bed: same person goes again */
  again: boolean;
  over: boolean;
  winner: Seat | 'draw' | null;
  line: string;
}

export function buildFence(st: FenceState, seat: Seat, e: number): FenceMove | null {
  if (e < 0 || e >= EDGES || st.fences[e] !== '.') return null;
  const fences = st.fences.slice(0, e) + seat + st.fences.slice(e + 1);
  let beds = st.beds;
  const closed: number[] = [];
  for (const b of bedsBeside(e))
    if (beds[b] === '.' && sidesBuilt(fences, b) === 4) {
      beds = beds.slice(0, b) + seat + beds.slice(b + 1);
      closed.push(b);
    }
  const state: FenceState = { fences, beds, lastEdge: e, lastBeds: closed };
  const over = !fences.includes('.');
  const a = fenceCount(state, 'a');
  const b = fenceCount(state, 'b');
  const winner: Seat | 'draw' | null = over ? (a === b ? 'draw' : a > b ? 'a' : 'b') : null;
  return {
    state,
    again: closed.length > 0 && !over,
    over,
    winner,
    line: over
      ? `closed the last bed (${Math.max(a, b)}–${Math.min(a, b)})`
      : closed.length > 1
        ? `closed ${closed.length} beds at once`
        : closed.length
          ? 'closed a bed and went again'
          : 'added a bit of fence',
  };
}

/**
 * The demo partner: takes any bed it can close, otherwise builds where it
 * won't hand you one, and when it has to, gives away as few as it can.
 */
export function botEdge(st: FenceState, bot: Seat, rng = Math.random): number {
  void bot;
  const open = [...st.fences].map((f, i) => (f === '.' ? i : -1)).filter((i) => i >= 0);
  const closes = open.filter((e) => bedsBeside(e).some((b) => st.beds[b] === '.' && sidesBuilt(st.fences, b) === 3));
  if (closes.length) return closes[Math.floor(rng() * closes.length)];
  const givesAway = (e: number) => {
    const f = st.fences.slice(0, e) + 'x' + st.fences.slice(e + 1);
    return bedsBeside(e).filter((b) => st.beds[b] === '.' && sidesBuilt(f, b) === 3).length;
  };
  const safe = open.filter((e) => givesAway(e) === 0);
  if (safe.length) return safe[Math.floor(rng() * safe.length)];
  // count how long a run of beds each choice would hand over, and pick the shortest
  const chain = (e: number) => {
    let f = st.fences.slice(0, e) + 'x' + st.fences.slice(e + 1);
    let beds = st.beds;
    let n = 0;
    for (let guard = 0; guard < 30; guard++) {
      const free = [...f].map((x, i) => (x === '.' ? i : -1)).filter((i) => i >= 0);
      const take = free.find((ed) => bedsBeside(ed).some((b) => beds[b] === '.' && sidesBuilt(f, b) === 3));
      if (take === undefined) break;
      f = f.slice(0, take) + 'x' + f.slice(take + 1);
      for (const b of bedsBeside(take))
        if (beds[b] === '.' && sidesBuilt(f, b) === 4) {
          beds = beds.slice(0, b) + 'x' + beds.slice(b + 1);
          n++;
        }
    }
    return n + rng() * 0.3;
  };
  const scored = open.map((e) => ({ e, n: chain(e) }));
  return scored.reduce((best, s) => (s.n < best.n ? s : best), scored[0]).e;
}

export const fenceNext = (seat: Seat, mv: FenceMove): Seat | null => (mv.over ? null : mv.again ? seat : otherSeat(seat));
