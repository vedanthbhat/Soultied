import type { Seat } from './types';
import { otherSeat } from './types';

/**
 * Chess for two, the whole game: castling, taking in passing, a pawn made into anything at the far side, check,
 * checkmate, stalemate, the same position three times, fifty moves without a capture or a pawn moving, and
 * nobody able to checkmate any more. Either of you can offer a draw or resign. Whoever starts plays white.
 *
 * The board is 64 characters, a8 first and h1 last: '.' empty, 'KQRBNP' white, 'kqrbnp' black.
 */

export type ChessColor = 'w' | 'b';
export type Promo = 'q' | 'r' | 'b' | 'n';
export type ChessEnd = 'checkmate' | 'stalemate' | 'repetition' | 'fifty' | 'material' | 'resigned' | 'agreed';

export interface ChessMove {
  from: number;
  to: number;
  promo?: Promo;
}

export interface ChessState {
  board: string;
  /** who plays white (and went first) */
  white: Seat;
  /** whose move it is, by colour */
  side: ChessColor;
  /** which ways each side can still castle: some of 'KQkq' */
  castling: string;
  /** the square a pawn just skipped over, which the other side can take in passing */
  ep: number | null;
  /** moves since a capture or a pawn moved */
  half: number;
  /** the move number (it goes up after black moves) */
  full: number;
  last: { from: number; to: number } | null;
  /** the positions since a capture or a pawn moved, for the same position three times */
  seen: string[];
  /** the side to move is in check */
  check: boolean;
  end: ChessEnd | null;
  /** a draw offered by this seat, waiting for an answer */
  offer: Seat | null;
}

export const START_BOARD = 'rnbqkbnr' + 'pppppppp' + '.'.repeat(32) + 'PPPPPPPP' + 'RNBQKBNR';

export const emptyChess = (white: Seat): ChessState => ({
  board: START_BOARD,
  white,
  side: 'w',
  castling: 'KQkq',
  ep: null,
  half: 0,
  full: 1,
  last: null,
  seen: [positionKey(START_BOARD, 'w', 'KQkq', null)],
  check: false,
  end: null,
  offer: null,
});

export const colorOf = (p: string): ChessColor | null => (p === '.' ? null : p === p.toUpperCase() ? 'w' : 'b');
export const otherColor = (c: ChessColor): ChessColor => (c === 'w' ? 'b' : 'w');
export const seatColor = (st: ChessState, seat: Seat): ChessColor => (st.white === seat ? 'w' : 'b');
export const colorSeat = (st: ChessState, c: ChessColor): Seat => (c === 'w' ? st.white : otherSeat(st.white));

const FILES = 'abcdefgh';
export const squareName = (i: number) => `${FILES[i % 8]}${8 - Math.floor(i / 8)}`;
const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
export const pieceName = (p: string) => NAMES[p.toLowerCase()] || 'piece';
export const VALUE: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const STRAIGHT = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const ALL = [...DIAG, ...STRAIGHT];

const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function positionKey(board: string, side: ChessColor, castling: string, ep: number | null) {
  return `${board} ${side} ${castling || '-'} ${ep === null ? '-' : ep}`;
}

/** whether `by` attacks square `sq` */
export function attacked(board: string, sq: number, by: ChessColor): boolean {
  const r = Math.floor(sq / 8);
  const c = sq % 8;
  const mine = (p: string) => p !== '.' && colorOf(p) === by;
  const is = (p: string, kind: string) => mine(p) && p.toLowerCase() === kind;
  // pawns: white pawns attack upwards, so they sit one row below
  const pr = by === 'w' ? r + 1 : r - 1;
  for (const dc of [-1, 1]) if (on(pr, c + dc) && is(board[pr * 8 + c + dc], 'p')) return true;
  for (const [dr, dc] of KNIGHT) if (on(r + dr, c + dc) && is(board[(r + dr) * 8 + c + dc], 'n')) return true;
  for (const [dr, dc] of ALL) if (on(r + dr, c + dc) && is(board[(r + dr) * 8 + c + dc], 'k')) return true;
  for (const [dr, dc] of DIAG) {
    let rr = r + dr;
    let cc = c + dc;
    while (on(rr, cc)) {
      const p = board[rr * 8 + cc];
      if (p !== '.') {
        if (is(p, 'b') || is(p, 'q')) return true;
        break;
      }
      rr += dr;
      cc += dc;
    }
  }
  for (const [dr, dc] of STRAIGHT) {
    let rr = r + dr;
    let cc = c + dc;
    while (on(rr, cc)) {
      const p = board[rr * 8 + cc];
      if (p !== '.') {
        if (is(p, 'r') || is(p, 'q')) return true;
        break;
      }
      rr += dr;
      cc += dc;
    }
  }
  return false;
}

export const kingSquare = (board: string, c: ChessColor) => board.indexOf(c === 'w' ? 'K' : 'k');
export const inCheck = (board: string, c: ChessColor) => {
  const k = kingSquare(board, c);
  return k >= 0 && attacked(board, k, otherColor(c));
};

/** every move by `side`, before checking it doesn't leave its own king in check (castling is checked fully) */
export function pseudoMoves(board: string, side: ChessColor, castling: string, ep: number | null): ChessMove[] {
  const out: ChessMove[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (p === '.' || colorOf(p) !== side) continue;
    const r = Math.floor(sq / 8);
    const c = sq % 8;
    const kind = p.toLowerCase();
    const target = (t: number) => {
      const q = board[t];
      return q === '.' ? 'empty' : colorOf(q) === side ? 'own' : 'theirs';
    };
    if (kind === 'p') {
      const dir = side === 'w' ? -1 : 1;
      const home = side === 'w' ? 6 : 1;
      const last = side === 'w' ? 0 : 7;
      const push = (to: number) => {
        if (Math.floor(to / 8) === last) for (const promo of ['q', 'r', 'b', 'n'] as Promo[]) out.push({ from: sq, to, promo });
        else out.push({ from: sq, to });
      };
      const one = (r + dir) * 8 + c;
      if (on(r + dir, c) && board[one] === '.') {
        push(one);
        const two = (r + 2 * dir) * 8 + c;
        if (r === home && board[two] === '.') out.push({ from: sq, to: two });
      }
      for (const dc of [-1, 1]) {
        if (!on(r + dir, c + dc)) continue;
        const t = (r + dir) * 8 + c + dc;
        if (target(t) === 'theirs' || t === ep) push(t);
      }
      continue;
    }
    if (kind === 'n' || kind === 'k') {
      for (const [dr, dc] of kind === 'n' ? KNIGHT : ALL) {
        if (!on(r + dr, c + dc)) continue;
        const t = (r + dr) * 8 + c + dc;
        if (target(t) !== 'own') out.push({ from: sq, to: t });
      }
      if (kind === 'k') {
        const them = otherColor(side);
        const row = side === 'w' ? 7 : 0;
        const [kc, qc] = side === 'w' ? ['K', 'Q'] : ['k', 'q'];
        if (sq === row * 8 + 4 && !attacked(board, sq, them)) {
          if (castling.includes(kc) && board[row * 8 + 5] === '.' && board[row * 8 + 6] === '.' && board[row * 8 + 7] === (side === 'w' ? 'R' : 'r') && !attacked(board, row * 8 + 5, them) && !attacked(board, row * 8 + 6, them))
            out.push({ from: sq, to: row * 8 + 6 });
          if (castling.includes(qc) && board[row * 8 + 3] === '.' && board[row * 8 + 2] === '.' && board[row * 8 + 1] === '.' && board[row * 8] === (side === 'w' ? 'R' : 'r') && !attacked(board, row * 8 + 3, them) && !attacked(board, row * 8 + 2, them))
            out.push({ from: sq, to: row * 8 + 2 });
        }
      }
      continue;
    }
    const dirs = kind === 'b' ? DIAG : kind === 'r' ? STRAIGHT : ALL;
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (on(rr, cc)) {
        const t = rr * 8 + cc;
        const k = target(t);
        if (k === 'own') break;
        out.push({ from: sq, to: t });
        if (k === 'theirs') break;
        rr += dr;
        cc += dc;
      }
    }
  }
  return out;
}

/** the board after a move (castling moves the rook, taking in passing removes the pawn behind) */
export function boardAfter(board: string, mv: ChessMove, ep: number | null): string {
  const b = board.split('');
  const p = b[mv.from];
  const kind = p.toLowerCase();
  const side = colorOf(p) as ChessColor;
  b[mv.to] = mv.promo ? (side === 'w' ? mv.promo.toUpperCase() : mv.promo) : p;
  b[mv.from] = '.';
  if (kind === 'p' && mv.to === ep && board[mv.to] === '.') b[mv.to + (side === 'w' ? 8 : -8)] = '.';
  if (kind === 'k' && Math.abs(mv.to - mv.from) === 2) {
    const row = Math.floor(mv.from / 8) * 8;
    if (mv.to % 8 === 6) {
      b[row + 5] = b[row + 7];
      b[row + 7] = '.';
    } else {
      b[row + 3] = b[row];
      b[row] = '.';
    }
  }
  return b.join('');
}

/** the moves the side to move can really make */
export function legalMoves(st: Pick<ChessState, 'board' | 'side' | 'castling' | 'ep'>): ChessMove[] {
  return pseudoMoves(st.board, st.side, st.castling, st.ep).filter((mv) => !inCheck(boardAfter(st.board, mv, st.ep), st.side));
}

/** nobody can checkmate with what's left: kings alone, or a king with one bishop or knight against a bare king, or bishops all on one colour */
export function deadPosition(board: string): boolean {
  const pieces: Array<{ p: string; sq: number }> = [];
  for (let i = 0; i < 64; i++) if (board[i] !== '.' && board[i].toLowerCase() !== 'k') pieces.push({ p: board[i], sq: i });
  if (pieces.some((x) => 'pqrPQR'.includes(x.p))) return false;
  if (pieces.length <= 1) return true;
  if (pieces.every((x) => x.p.toLowerCase() === 'b')) {
    const shade = (sq: number) => (Math.floor(sq / 8) + (sq % 8)) % 2;
    return pieces.every((x) => shade(x.sq) === shade(pieces[0].sq));
  }
  return false;
}

export interface ChessStep {
  state: ChessState;
  next: Seat | null;
  over: boolean;
  winner: Seat | 'draw' | null;
  line: string;
}

const sameMove = (a: ChessMove, b: ChessMove) => a.from === b.from && a.to === b.to && (a.promo || null) === (b.promo || null);

/** Make a move as `seat`. Returns null if it isn't theirs to make. */
export function playMove(st: ChessState, seat: Seat, mv: ChessMove): ChessStep | null {
  if (st.end || seatColor(st, seat) !== st.side) return null;
  const legal = legalMoves(st);
  const m = legal.find((x) => sameMove(x, mv));
  if (!m) return null;
  const p = st.board[m.from];
  const kind = p.toLowerCase();
  const took = st.board[m.to] !== '.' ? st.board[m.to] : kind === 'p' && m.to === st.ep ? (st.side === 'w' ? 'p' : 'P') : null;
  const board = boardAfter(st.board, m, st.ep);
  const them = otherColor(st.side);
  // castling rights go when a king or rook moves, or a rook is taken at home
  let castling = st.castling;
  const drop = (chars: string) => {
    for (const ch of chars) castling = castling.replace(ch, '');
  };
  if (p === 'K') drop('KQ');
  if (p === 'k') drop('kq');
  for (const sq of [m.from, m.to]) {
    if (sq === 63) drop('K');
    if (sq === 56) drop('Q');
    if (sq === 7) drop('k');
    if (sq === 0) drop('q');
  }
  const ep = kind === 'p' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null;
  const half = kind === 'p' || took ? 0 : st.half + 1;
  const full = st.side === 'b' ? st.full + 1 : st.full;
  const key = positionKey(board, them, castling, ep);
  const seen = kind === 'p' || took || castling !== st.castling ? [key] : [...st.seen, key];
  const check = inCheck(board, them);
  const replies = legalMoves({ board, side: them, castling, ep });

  const castled = kind === 'k' && Math.abs(m.to - m.from) === 2;
  let line = castled
    ? `castled on the ${m.to % 8 === 6 ? 'king’s' : 'queen’s'} side`
    : m.promo
      ? `${took ? `took your ${pieceName(took)} and ` : ''}made a pawn a ${pieceName(m.promo)} on ${squareName(m.to)}`
      : took
        ? `took your ${pieceName(took)} on ${squareName(kind === 'p' && m.to === st.ep && st.board[m.to] === '.' ? m.to + (st.side === 'w' ? 8 : -8) : m.to)}${kind === 'p' && st.board[m.to] === '.' ? ' in passing' : ''}`
        : `moved a ${pieceName(p)} to ${squareName(m.to)}`;

  let end: ChessEnd | null = null;
  let winner: Seat | 'draw' | null = null;
  if (!replies.length) {
    end = check ? 'checkmate' : 'stalemate';
    winner = check ? seat : 'draw';
  } else if (seen.filter((k) => k === key).length >= 3) {
    end = 'repetition';
    winner = 'draw';
  } else if (half >= 100) {
    end = 'fifty';
    winner = 'draw';
  } else if (deadPosition(board)) {
    end = 'material';
    winner = 'draw';
  }
  if (end === 'checkmate') line += ': checkmate';
  else if (check) line += ' and put you in check';
  if (end === 'stalemate') line += '. It’s stalemate, so a draw';
  if (end === 'repetition') line += '. The same position three times: a draw';
  if (end === 'fifty') line += '. Fifty moves without a capture: a draw';
  if (end === 'material') line += '. Nobody can checkmate now: a draw';

  return {
    state: { ...st, board, side: them, castling, ep, half, full, last: { from: m.from, to: m.to }, seen, check, end, offer: null },
    next: end ? null : otherSeat(seat),
    over: !!end,
    winner,
    line,
  };
}

/** what's been taken from each colour, by what's missing from the starting set */
export function capturedFrom(board: string, c: ChessColor): string[] {
  const out: string[] = [];
  for (const kind of ['q', 'r', 'b', 'n', 'p']) {
    const p = c === 'w' ? kind.toUpperCase() : kind;
    const have = [...board].filter((x) => x === p).length;
    const start = [...START_BOARD].filter((x) => x === p).length;
    for (let i = have; i < start; i++) out.push(p);
  }
  return out;
}

/** a simple sense of who's ahead, for `c`: what's on the board, knights and bishops nearer the middle, pawns further up */
export function evaluate(board: string, c: ChessColor): number {
  let v = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = board[sq];
    if (p === '.') continue;
    const kind = p.toLowerCase();
    const r = Math.floor(sq / 8);
    const col = sq % 8;
    let s = VALUE[kind];
    if (kind === 'n' || kind === 'b') s += (7 - Math.max(Math.abs(2 * r - 7), Math.abs(2 * col - 7))) * 4;
    if (kind === 'p') s += (colorOf(p) === 'w' ? 6 - r : r - 1) * 6;
    v += colorOf(p) === c ? s : -s;
  }
  return v;
}

/**
 * The demo room's partner: for each move, how things stand after it, less the most the other side could win
 * straight back with one capture; checkmate if it can, and now and then a move without much thought.
 */
export function botMove(st: ChessState, rng = Math.random): ChessMove {
  const moves = legalMoves(st);
  if (rng() < 0.08) return moves[Math.floor(rng() * moves.length)];
  const me = st.side;
  const them = otherColor(me);
  let best = moves[0];
  let bestV = -Infinity;
  for (const mv of moves) {
    const board = boardAfter(st.board, mv, st.ep);
    const castling = st.castling;
    const ep = st.board[mv.from].toLowerCase() === 'p' && Math.abs(mv.to - mv.from) === 16 ? (mv.from + mv.to) / 2 : null;
    let v = evaluate(board, me);
    const replies = pseudoMoves(board, them, castling, ep);
    let loss = 0;
    for (const r of replies) {
      const q = board[r.to];
      if (q === '.') continue;
      const after = boardAfter(board, r, ep);
      const gain = VALUE[q.toLowerCase()] - (attacked(after, r.to, me) ? VALUE[board[r.from].toLowerCase()] : 0);
      if (gain > loss) loss = gain;
    }
    v -= loss;
    if (inCheck(board, them)) {
      if (!legalMoves({ board, side: them, castling, ep }).length) v = 100000;
      else v += 15;
    } else if (replies.length <= 6 && !legalMoves({ board, side: them, castling, ep }).length) v = -500;
    v += rng() * 15;
    if (v > bestV) {
      bestV = v;
      best = mv;
    }
  }
  return best;
}
