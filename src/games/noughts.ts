import type { Seat } from './types';
import { otherSeat } from './types';

/**
 * Noughts & Hearts: three in a row on a 3x3 board, best of five. The board is
 * a 9-character string, top row first: '.' empty, 'a' / 'b' each person's mark.
 * Whoever went second in one round goes first in the next.
 */

export const ROUNDS_TO_WIN = 3;
export const MAX_ROUNDS = 5;

export interface NoughtsState {
  board: string;
  round: number;
  /** who went first this round */
  opener: Seat;
  score: Record<Seat, number>;
  /** each finished round: who won it (or 'draw') */
  history: Array<Seat | 'draw'>;
  lastCell: number | null;
  /** the three that won the round just finished (shown until the next move) */
  line: number[] | null;
  /** how the last round's board ended, shown until the next round's first move */
  lastBoard: string | null;
}

export const emptyNoughts = (opener: Seat): NoughtsState => ({
  board: '.........',
  round: 1,
  opener,
  score: { a: 0, b: 0 },
  history: [],
  lastCell: null,
  line: null,
  lastBoard: null,
});

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export function threeInRow(board: string): { seat: Seat; cells: number[] } | null {
  for (const l of LINES) {
    const s = board[l[0]];
    if (s !== '.' && s === board[l[1]] && s === board[l[2]]) return { seat: s as Seat, cells: l };
  }
  return null;
}

const PLACES = ['the top left', 'the top', 'the top right', 'the left', 'the middle', 'the right', 'the bottom left', 'the bottom', 'the bottom right'];
export const placeName = (i: number) => PLACES[i] || 'a square';

export interface NoughtsMove {
  state: NoughtsState;
  /** whose move it is next (null once the series is over) */
  next: Seat | null;
  /** the series is decided */
  over: boolean;
  winner: Seat | 'draw' | null;
  line: string;
}

/** Put a mark down. Ends the round (and maybe the series) when someone gets three or the board fills. */
export function placeMark(st: NoughtsState, seat: Seat, cell: number): NoughtsMove | null {
  if (cell < 0 || cell > 8 || st.board[cell] !== '.') return null;
  const board = st.board.slice(0, cell) + seat + st.board.slice(cell + 1);
  const three = threeInRow(board);
  const full = !board.includes('.');
  if (!three && !full) {
    return { state: { ...st, board, lastCell: cell, line: null, lastBoard: null }, next: otherSeat(seat), over: false, winner: null, line: `put a mark in ${placeName(cell)}` };
  }
  const roundWinner: Seat | 'draw' = three ? three.seat : 'draw';
  const score = { ...st.score };
  if (roundWinner !== 'draw') score[roundWinner] += 1;
  const history = [...st.history, roundWinner];
  const decided = score.a >= ROUNDS_TO_WIN || score.b >= ROUNDS_TO_WIN || history.length >= MAX_ROUNDS;
  if (decided) {
    const winner: Seat | 'draw' = score.a === score.b ? 'draw' : score.a > score.b ? 'a' : 'b';
    return {
      state: { ...st, board, score, history, lastCell: cell, line: three ? three.cells : null, lastBoard: null },
      next: null,
      over: true,
      winner,
      line: winner === 'draw' ? `finished level at ${score.a}–${score.b}` : `won the series ${Math.max(score.a, score.b)}–${Math.min(score.a, score.b)}`,
    };
  }
  // next round: the other person opens
  const opener = otherSeat(st.opener);
  return {
    state: { board: '.........', round: st.round + 1, opener, score, history, lastCell: null, line: three ? three.cells : null, lastBoard: board },
    next: opener,
    over: false,
    winner: null,
    line: roundWinner === 'draw' ? `filled the board, so round ${st.round} is a draw` : `got three in a row and took round ${st.round}`,
  };
}

/** Perfect play for the demo partner, with a little forgetfulness so it can be beaten. */
export function botCell(board: string, bot: Seat, rng = Math.random): number {
  const open = [...board].map((c, i) => (c === '.' ? i : -1)).filter((i) => i >= 0);
  if (rng() < 0.18) return open[Math.floor(rng() * open.length)];
  const you = otherSeat(bot);
  const score = (b: string, turn: Seat, depth: number): number => {
    const t = threeInRow(b);
    if (t) return t.seat === bot ? 10 - depth : depth - 10;
    if (!b.includes('.')) return 0;
    const vals: number[] = [];
    for (let i = 0; i < 9; i++) if (b[i] === '.') vals.push(score(b.slice(0, i) + turn + b.slice(i + 1), turn === bot ? you : bot, depth + 1));
    return turn === bot ? Math.max(...vals) : Math.min(...vals);
  };
  let best = open[0];
  let bestV = -Infinity;
  for (const i of open) {
    const v = score(board.slice(0, i) + bot + board.slice(i + 1), you, 1) + rng() * 0.5;
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  }
  return best;
}
