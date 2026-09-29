import type { Seat } from './types';

/**
 * Fireflies: connect four in a jar. The board is a 42-character string, top
 * row first; '.' is empty, 'a' and 'b' are each person's fireflies.
 */

export const COLS = 7;
export const ROWS = 6;

export interface FirefliesState {
  board: string;
  /** where the last firefly landed, for the drop animation */
  lastCell: number | null;
  /** the four that won, once there is a winner */
  line: number[] | null;
}

export const emptyFireflies = (): FirefliesState => ({ board: '.'.repeat(COLS * ROWS), lastCell: null, line: null });

export const cell = (row: number, col: number) => row * COLS + col;

/** The row a firefly dropped in this column would land in, or -1 if the column is full. */
export function landingRow(board: string, col: number) {
  for (let r = ROWS - 1; r >= 0; r--) if (board[cell(r, col)] === '.') return r;
  return -1;
}

export function drop(board: string, col: number, seat: Seat): { board: string; cell: number } | null {
  const r = landingRow(board, col);
  if (r < 0) return null;
  const i = cell(r, col);
  return { board: board.slice(0, i) + seat + board.slice(i + 1), cell: i };
}

const DIRS: Array<[number, number]> = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

/** Four in a row anywhere on the board. */
export function findLine(board: string): { seat: Seat; cells: number[] } | null {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const s = board[cell(r, c)];
      if (s === '.') continue;
      for (const [dr, dc] of DIRS) {
        const cells = [cell(r, c)];
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= ROWS || cc < 0 || cc >= COLS || board[cell(rr, cc)] !== s) break;
          cells.push(cell(rr, cc));
        }
        if (cells.length === 4) return { seat: s as Seat, cells };
      }
    }
  return null;
}

export const isFull = (board: string) => !board.includes('.');

const COL_PLACES = ['on the far left', 'on the left', 'just left of the middle', 'in the middle', 'just right of the middle', 'on the right', 'on the far right'];
/** "in the middle", "on the far left"… */
export const columnPlace = (col: number) => COL_PLACES[col] || `in column ${col + 1}`;

/**
 * The demo room's partner: takes a win when it sees one, blocks yours, never
 * hands you a win if it can help it, and otherwise likes the middle.
 */
export function botColumn(board: string, bot: Seat, rng = Math.random): number {
  const you: Seat = bot === 'a' ? 'b' : 'a';
  const open = [...Array(COLS).keys()].filter((c) => landingRow(board, c) >= 0);
  const wins = (b: string, s: Seat, c: number) => {
    const d = drop(b, c, s);
    return !!d && findLine(d.board)?.seat === s;
  };
  for (const c of open) if (wins(board, bot, c)) return c;
  for (const c of open) if (wins(board, you, c)) return c;
  const safe = open.filter((c) => {
    const d = drop(board, c, bot)!;
    return !open.some((c2) => wins(d.board, you, c2));
  });
  const pool = safe.length ? safe : open;
  const scored = pool.map((c) => ({ c, w: 4 - Math.abs(3 - c) + rng() * 2.5 }));
  return scored.reduce((best, s) => (s.w > best.w ? s : best), scored[0]).c;
}
