import type { Seat } from './types';
import { otherSeat } from './types';

/**
 * Lanterns: Reversi on a pond at night. Light a lantern so that a straight
 * line of theirs sits between it and one of yours, and the whole line turns
 * your colour. If you can't trap anything you pass; when neither of you can,
 * whoever has more lanterns lit wins.
 *
 * The pond is a 64-character string, top row first: '.', 'a' or 'b'.
 */

export const SIZE = 8;

export interface LanternsState {
  board: string;
  lastCell: number | null;
  /** turned by the last move, for the flip animation */
  flipped: number[];
  /** the person before had nothing to trap and had to pass */
  passed: Seat | null;
}

export const at = (x: number, y: number) => y * SIZE + x;

export function emptyLanterns(starter: Seat): LanternsState {
  const other = otherSeat(starter);
  const b = [...'.'.repeat(64)];
  b[at(3, 3)] = other;
  b[at(4, 4)] = other;
  b[at(4, 3)] = starter;
  b[at(3, 4)] = starter;
  return { board: b.join(''), lastCell: null, flipped: [], passed: null };
}

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

/** the lanterns lighting this cell would turn */
export function flipsFor(board: string, seat: Seat, cell: number): number[] {
  if (board[cell] !== '.') return [];
  const x0 = cell % SIZE;
  const y0 = Math.floor(cell / SIZE);
  const them = otherSeat(seat);
  const out: number[] = [];
  for (const [dx, dy] of DIRS) {
    const run: number[] = [];
    let x = x0 + dx;
    let y = y0 + dy;
    while (x >= 0 && y >= 0 && x < SIZE && y < SIZE && board[at(x, y)] === them) {
      run.push(at(x, y));
      x += dx;
      y += dy;
    }
    if (run.length && x >= 0 && y >= 0 && x < SIZE && y < SIZE && board[at(x, y)] === seat) out.push(...run);
  }
  return out;
}

export const legalCells = (board: string, seat: Seat) => [...Array(64).keys()].filter((i) => flipsFor(board, seat, i).length > 0);

export const lanternCount = (board: string, s: Seat) => [...board].filter((c) => c === s).length;

export interface LanternsMove {
  state: LanternsState;
  next: Seat | null;
  over: boolean;
  winner: Seat | 'draw' | null;
  line: string;
}

export function lightLantern(st: LanternsState, seat: Seat, cell: number): LanternsMove | null {
  const flips = flipsFor(st.board, seat, cell);
  if (!flips.length) return null;
  const b = [...st.board];
  b[cell] = seat;
  flips.forEach((i) => (b[i] = seat));
  const board = b.join('');
  const them = otherSeat(seat);
  const theyCan = legalCells(board, them).length > 0;
  const iCan = legalCells(board, seat).length > 0;
  const over = !theyCan && !iCan;
  const a = lanternCount(board, 'a');
  const bb = lanternCount(board, 'b');
  const winner: Seat | 'draw' | null = over ? (a === bb ? 'draw' : a > bb ? 'a' : 'b') : null;
  const turned = flips.length === 1 ? 'turned one lantern' : `turned ${flips.length} lanterns`;
  return {
    state: { board, lastCell: cell, flipped: flips, passed: !over && !theyCan ? them : null },
    next: over ? null : theyCan ? them : seat,
    over,
    winner,
    line: over ? `lit the last lantern (${Math.max(a, bb)}–${Math.min(a, bb)})` : `${turned}`,
  };
}

/** corners are gold, the squares next to them are traps; edges are good */
const WEIGHT = [
  120, -20, 20, 5, 5, 20, -20, 120, -20, -40, -5, -5, -5, -5, -40, -20, 20, -5, 15, 3, 3, 15, -5, 20, 5, -5, 3, 3, 3, 3, -5, 5, 5, -5, 3, 3, 3, 3, -5, 5, 20,
  -5, 15, 3, 3, 15, -5, 20, -20, -40, -5, -5, -5, -5, -40, -20, 120, -20, 20, 5, 5, 20, -20, 120,
];

export function botLantern(board: string, bot: Seat, rng = Math.random): number {
  const moves = legalCells(board, bot);
  const them = otherSeat(bot);
  const score = (cell: number) => {
    const flips = flipsFor(board, bot, cell);
    const b = [...board];
    b[cell] = bot;
    flips.forEach((i) => (b[i] = bot));
    const after = b.join('');
    // fewer replies for them is better
    return WEIGHT[cell] + flips.length * 1.5 - legalCells(after, them).length * 2 + rng() * 6;
  };
  const scored = moves.map((c) => ({ c, v: score(c) }));
  return scored.reduce((best, s) => (s.v > best.v ? s : best), scored[0]).c;
}
