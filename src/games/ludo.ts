import type { Seat } from './types';
import { otherSeat } from './types';

/**
 * Ludo for two: roll the die and race your tokens round the board and home. A six brings a token out of
 * your yard (and rolls again); land on one of theirs, anywhere but a star or a start square, and it goes back
 * to their yard (and you roll again); getting a token home rolls again too; three sixes in a row and the
 * turn passes. Every roll is kept in the match, so whoever's next sees exactly what you rolled.
 *
 * Each token is a number: -1 in its yard, 0–50 round the track from its own start square, 51–55 up its own
 * path to the middle, and 56 home. You start on opposite sides of the board.
 */

export const LUDO_TRACK = 52;
/** the last square round the track before your own path to the middle */
export const LUDO_LAST = 50;
export const LUDO_HOME = 56;
/** where each of you comes onto the track */
export const LUDO_START: Record<Seat, number> = { a: 39, b: 13 };
/** the start squares and the stars: nobody can be sent back from these */
export const LUDO_SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
/** a quick game is two tokens each; a full one, four */
export const LUDO_COUNTS = [2, 4];

export interface LudoMoved {
  seat: Seat;
  token: number;
  from: number;
  to: number;
}

export interface LudoState {
  tokens: Record<Seat, number[]>;
  /** roll the die, or move a token with what you rolled */
  phase: 'roll' | 'move';
  /** the last roll (still shown after the move) */
  dice: number | null;
  /** sixes in a row, this turn */
  sixes: number;
  /** the token that moved last, and from where to where */
  moved: LudoMoved | null;
  /** which of the other side's tokens that move sent back to the yard */
  sent: number[] | null;
}

export const emptyLudo = (count = 4): LudoState => {
  const n = LUDO_COUNTS.includes(count) ? count : 4;
  return { tokens: { a: Array(n).fill(-1), b: Array(n).fill(-1) }, phase: 'roll', dice: null, sixes: 0, moved: null, sent: null };
};

/** where a token is round the track (0–51, the same for both of you), or null in the yard, on its path or home */
export const trackSquare = (seat: Seat, pos: number): number | null => (pos >= 0 && pos <= LUDO_LAST ? (pos + LUDO_START[seat]) % LUDO_TRACK : null);

export const isSafe = (square: number) => LUDO_SAFE.includes(square);

export function canMove(pos: number, dice: number): boolean {
  if (pos === LUDO_HOME) return false;
  if (pos === -1) return dice === 6;
  return pos + dice <= LUDO_HOME;
}

/** the tokens you could move with this roll */
export const movable = (st: LudoState, seat: Seat, dice: number): number[] =>
  st.tokens[seat].map((p, i) => (canMove(p, dice) ? i : -1)).filter((i) => i >= 0);

/** where a token ends up with this roll */
export const landing = (pos: number, dice: number) => (pos === -1 ? 0 : pos + dice);

export interface LudoStep {
  state: LudoState;
  /** whose go it is next (null once someone's won) */
  next: Seat | null;
  over: boolean;
  winner: Seat | null;
  line: string;
}

/** Roll the die (what came up is passed in, so it can be checked). With nothing to move, the turn passes. */
export function rollDie(st: LudoState, seat: Seat, dice: number): LudoStep | null {
  if (st.phase !== 'roll' || !Number.isInteger(dice) || dice < 1 || dice > 6) return null;
  const sixes = dice === 6 ? st.sixes + 1 : 0;
  const pass = (line: string): LudoStep => ({ state: { ...st, phase: 'roll', dice, sixes: 0, moved: null, sent: null }, next: otherSeat(seat), over: false, winner: null, line });
  if (sixes >= 3) return pass('rolled three sixes in a row, so the turn passed');
  if (!movable(st, seat, dice).length) return pass(`rolled a ${dice} but couldn’t move`);
  return { state: { ...st, phase: 'move', dice, sixes, moved: null, sent: null }, next: seat, over: false, winner: null, line: `rolled a ${dice}` };
}

/** Move one of your tokens by what you rolled. A six, sending one of theirs back, or getting one home rolls again. */
export function moveToken(st: LudoState, seat: Seat, token: number): LudoStep | null {
  const dice = st.dice;
  if (st.phase !== 'move' || dice === null) return null;
  const from = st.tokens[seat][token];
  if (from === undefined || !canMove(from, dice)) return null;
  const to = landing(from, dice);
  const them = otherSeat(seat);
  const tokens: Record<Seat, number[]> = { a: [...st.tokens.a], b: [...st.tokens.b] };
  tokens[seat][token] = to;
  const square = trackSquare(seat, to);
  const sent: number[] = [];
  if (square !== null && !isSafe(square))
    tokens[them].forEach((p, i) => {
      if (trackSquare(them, p) === square) {
        tokens[them][i] = -1;
        sent.push(i);
      }
    });
  const home = to === LUDO_HOME;
  const won = tokens[seat].every((p) => p === LUDO_HOME);
  const again = !won && (dice === 6 || sent.length > 0 || home);
  const line = won
    ? 'got their last token home'
    : sent.length
      ? sent.length > 1
        ? `sent ${sent.length} of yours back to the start`
        : 'sent one of yours back to the start'
      : home
        ? 'got a token home'
        : from === -1
          ? 'brought a token out'
          : `moved a token ${dice} ${dice === 1 ? 'square' : 'squares'}`;
  return {
    state: { tokens, phase: 'roll', dice, sixes: again && dice === 6 ? st.sixes : 0, moved: { seat, token, from, to }, sent: sent.length ? sent : null },
    next: won ? null : again ? seat : them,
    over: won,
    winner: won ? seat : null,
    line,
  };
}

/** how many of a side's tokens are home */
export const homeCount = (st: LudoState, seat: Seat) => st.tokens[seat].filter((p) => p === LUDO_HOME).length;

/** a fair roll */
export const rollD6 = (rng = Math.random) => 1 + Math.floor(rng() * 6);

/** The demo room's partner: send one of yours back if it can, then get home, come out, keep out of reach, and push on. */
export function botToken(st: LudoState, bot: Seat, rng = Math.random): number {
  const dice = st.dice ?? 1;
  const can = movable(st, bot, dice);
  const you = otherSeat(bot);
  const theirs = st.tokens[you];
  // a square one of yours could reach with a single roll
  const inReach = (square: number) =>
    theirs.some((q) => {
      const t = trackSquare(you, q);
      if (t === null) return false;
      const d = (square - t + LUDO_TRACK) % LUDO_TRACK;
      return d >= 1 && d <= 6 && q + d <= LUDO_LAST;
    });
  const exposed = (square: number | null) => square !== null && !isSafe(square) && inReach(square);
  let best = can[0] ?? 0;
  let bestV = -Infinity;
  for (const i of can) {
    const from = st.tokens[bot][i];
    const to = landing(from, dice);
    const square = trackSquare(bot, to);
    let v = 0;
    if (square !== null && !isSafe(square) && theirs.some((q) => trackSquare(you, q) === square)) v += 100;
    if (to === LUDO_HOME) v += 80;
    if (from === -1) v += 60;
    if (exposed(trackSquare(bot, from)) && !exposed(square)) v += 40;
    if (exposed(square)) v -= 50;
    v += to / 10 + rng() * 5;
    if (v > bestV) {
      bestV = v;
      best = i;
    }
  }
  return best;
}

/* ---------- the board: 15 × 15 squares, your yard in the bottom-left corner ---------- */

/** the track, square by square from the left arm's start, as [row, column] on the board */
export const LUDO_PATH: Array<[number, number]> = (() => {
  const p: Array<[number, number]> = [];
  for (let c = 1; c <= 5; c++) p.push([6, c]);
  for (let r = 5; r >= 0; r--) p.push([r, 6]);
  p.push([0, 7]);
  for (let r = 0; r <= 5; r++) p.push([r, 8]);
  for (let c = 9; c <= 14; c++) p.push([6, c]);
  p.push([7, 14]);
  for (let c = 14; c >= 9; c--) p.push([8, c]);
  for (let r = 9; r <= 14; r++) p.push([r, 8]);
  p.push([14, 7]);
  for (let r = 14; r >= 9; r--) p.push([r, 6]);
  for (let c = 5; c >= 0; c--) p.push([8, c]);
  p.push([7, 0]);
  p.push([6, 0]);
  return p;
})();

/** each side's path up to the middle */
export const LUDO_HOME_PATH: Record<Seat, Array<[number, number]>> = {
  a: [13, 12, 11, 10, 9].map((r) => [r, 7] as [number, number]),
  b: [1, 2, 3, 4, 5].map((r) => [r, 7] as [number, number]),
};

/** the top-left square of each side's yard */
export const LUDO_YARD: Record<Seat, [number, number]> = { a: [9, 0], b: [0, 9] };

/**
 * Where a token sits on the board, as the middle of it in squares from the top-left (so 7.5, 7.5 is the very
 * middle). Tokens in the yard sit on four spots; tokens home sit round the middle.
 */
export function tokenSpot(seat: Seat, token: number, pos: number): [number, number] {
  if (pos === -1) {
    const [r0, c0] = LUDO_YARD[seat];
    return [r0 + 2 + 2 * Math.floor((token % 4) / 2), c0 + 2 + 2 * (token % 2)];
  }
  if (pos === LUDO_HOME) {
    const d = [[-0.45, -0.45], [-0.45, 0.45], [0.45, -0.45], [0.45, 0.45]][token % 4];
    const lean = seat === 'a' ? 0.25 : -0.25;
    return [7.5 + d[0] * 0.8 + lean, 7.5 + d[1] * 0.8];
  }
  if (pos > LUDO_LAST) {
    const [r, c] = LUDO_HOME_PATH[seat][pos - LUDO_LAST - 1];
    return [r + 0.5, c + 0.5];
  }
  const [r, c] = LUDO_PATH[(pos + LUDO_START[seat]) % LUDO_TRACK];
  return [r + 0.5, c + 0.5];
}

/** every square a token passes through on a move, for walking it there one square at a time */
export function walk(from: number, to: number): number[] {
  if (from === -1) return [0];
  const out: number[] = [];
  for (let p = from + 1; p <= to; p++) out.push(p);
  return out;
}

/** what kind of square [row, column] is, for drawing the board */
export type LudoSquare = 'yard-a' | 'yard-b' | 'garden' | 'track' | 'start-a' | 'start-b' | 'start' | 'star' | 'path-a' | 'path-b' | 'middle';

export function squareKind(r: number, c: number): LudoSquare {
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) return 'middle';
  const inYard = (s: Seat) => r >= LUDO_YARD[s][0] && r < LUDO_YARD[s][0] + 6 && c >= LUDO_YARD[s][1] && c < LUDO_YARD[s][1] + 6;
  if (inYard('a')) return 'yard-a';
  if (inYard('b')) return 'yard-b';
  if ((r < 6 || r > 8) && (c < 6 || c > 8)) return 'garden';
  for (const s of ['a', 'b'] as Seat[]) if (LUDO_HOME_PATH[s].some(([pr, pc]) => pr === r && pc === c)) return s === 'a' ? 'path-a' : 'path-b';
  const i = LUDO_PATH.findIndex(([pr, pc]) => pr === r && pc === c);
  if (i === LUDO_START.a) return 'start-a';
  if (i === LUDO_START.b) return 'start-b';
  if (i >= 0 && isSafe(i)) return i % 13 === 0 ? 'start' : 'star';
  return 'track';
}
