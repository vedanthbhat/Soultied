import type { Seat } from './types';
import { otherSeat } from './types';

/**
 * Carrom for two, a shot at a time: slide your striker along your baseline, pull back, and flick. Sink one of
 * yours (or the red queen) and you go again. Sink the striker and one of yours comes back to the middle. Sink
 * the queen and then one of yours (the same go or your next) to cover her, or she goes back. Nobody can sink
 * their last coin before the queen's been covered: it comes back. First to sink all nine of theirs wins.
 *
 * The board is 100 × 100. The first seat shoots from the bottom baseline, the second from the top. Whoever starts
 * plays white. Coins are kept as two flat lists of numbers (x, then y, -1 once sunk), 0 the queen, 1–9 white, 10–18 black.
 * The physics is plain arithmetic in a fixed order, so the website and the iPhone play a shot out the same way.
 */

export const BOARD = 100;
export const R_COIN = 2.15;
export const R_STRIKER = 2.75;
export const M_COIN = 1;
export const M_STRIKER = 2;
export const POCKET_R = 3.3;
export const POCKETS: Array<[number, number]> = [
  [2.4, 2.4],
  [97.6, 2.4],
  [2.4, 97.6],
  [97.6, 97.6],
];
/** where each seat's striker sits (y), and how far along it can go */
export const BASELINE: Record<Seat, number> = { a: 86.2, b: 13.8 };
export const BASE_MIN = 19;
export const BASE_MAX = 81;
export const FRICTION = 55;
export const DT = 1 / 240;
export const MAX_STEPS = 240 * 14;
export const WALL_E = 0.72;
export const COIN_E = 0.9;
export const MIN_SPEED = 60;
export const MAX_SPEED = 330;
export const COINS = 19;

export type CoinKind = 'q' | 'w' | 'b';
export const coinKind = (i: number): CoinKind => (i === 0 ? 'q' : i <= 9 ? 'w' : 'b');

export interface CarromShot {
  by: Seat;
  /** the striker's place along the baseline */
  x: number;
  /** the way it was flicked (a unit vector) */
  dx: number;
  dy: number;
  /** 0–1 */
  power: number;
  /** where everything was before (to play the shot out again) */
  xs: number[];
  ys: number[];
}

export interface CarromState {
  xs: number[];
  ys: number[];
  /** who plays white (and went first) */
  white: Seat;
  /** the queen: on the board, sunk and waiting to be covered by a seat, or covered by a seat */
  queen: 'board' | `pending-${Seat}` | Seat;
  shot: CarromShot | null;
  /** the coins the last shot sank */
  sunk: number[] | null;
  foul: boolean;
  /** shots so far */
  shots: number;
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
const SQ3 = 0.8660254037844386;

/** the starting cluster: the queen in the middle, six round her, twelve round them */
export function startCoins(): { xs: number[]; ys: number[] } {
  const g = R_COIN * 2 + 0.06;
  const inner: Array<[number, number]> = [
    [1, 0],
    [0.5, SQ3],
    [-0.5, SQ3],
    [-1, 0],
    [-0.5, -SQ3],
    [0.5, -SQ3],
  ];
  const outer: Array<[number, number]> = [
    [2, 0],
    [1.5, SQ3],
    [1, 2 * SQ3],
    [0, 2 * SQ3],
    [-1, 2 * SQ3],
    [-1.5, SQ3],
    [-2, 0],
    [-1.5, -SQ3],
    [-1, -2 * SQ3],
    [0, -2 * SQ3],
    [1, -2 * SQ3],
    [1.5, -SQ3],
  ];
  // white and black alternate round each ring
  const spots: Array<[number, number]> = [[0, 0]];
  const white: Array<[number, number]> = [];
  const black: Array<[number, number]> = [];
  inner.forEach((p, i) => (i % 2 ? black : white).push(p));
  outer.forEach((p, i) => (i % 2 ? black : white).push(p));
  spots.push(...white, ...black);
  return { xs: spots.map(([x]) => round3(50 + x * g)), ys: spots.map(([, y]) => round3(50 + y * g)) };
}

export function emptyCarrom(white: Seat): CarromState {
  const { xs, ys } = startCoins();
  return { xs, ys, white, queen: 'board', shot: null, sunk: null, foul: false, shots: 0 };
}

export const seatKind = (st: CarromState, seat: Seat): CoinKind => (st.white === seat ? 'w' : 'b');
export const onBoard = (st: Pick<CarromState, 'xs'>, i: number) => st.xs[i] >= 0;
/** how many of a seat's coins are sunk */
export const sunkCount = (st: CarromState, seat: Seat) => {
  const k = seatKind(st, seat);
  let n = 0;
  for (let i = 1; i < COINS; i++) if (coinKind(i) === k && !onBoard(st, i)) n++;
  return n;
};

/** whether the striker can sit at x on this seat's baseline (not on a coin) */
export function strikerFits(st: Pick<CarromState, 'xs' | 'ys'>, seat: Seat, x: number): boolean {
  if (x < BASE_MIN || x > BASE_MAX) return false;
  const y = BASELINE[seat];
  for (let i = 0; i < COINS; i++) {
    if (st.xs[i] < 0) continue;
    const dx = st.xs[i] - x;
    const dy = st.ys[i] - y;
    if (dx * dx + dy * dy < (R_COIN + R_STRIKER) * (R_COIN + R_STRIKER)) return false;
  }
  return true;
}

/** whether a flick goes the right way (away from your own side of the board) */
export const forward = (seat: Seat, dy: number) => (seat === 'a' ? dy < -0.05 : dy > 0.05);

export interface SimResult {
  xs: number[];
  ys: number[];
  /** the coins sunk, in the order they went in */
  sunk: number[];
  striker: boolean;
  /** every few steps, where everything was (striker first), for playing it back */
  frames: number[][];
  steps: number;
}

/**
 * Play a shot out: the striker (body 0) and the coins (bodies 1–19) slide, slow down, bounce off the cushions and
 * each other, and drop into pockets. `every` records a frame every so many steps (0 for none).
 */
export function simulate(xs0: number[], ys0: number[], seat: Seat, x: number, dx: number, dy: number, power: number, every = 0): SimResult {
  const n = COINS + 1;
  const px: number[] = [x, ...xs0];
  const py: number[] = [BASELINE[seat], ...ys0];
  const vx: number[] = new Array(n).fill(0);
  const vy: number[] = new Array(n).fill(0);
  const on: boolean[] = [true, ...xs0.map((v) => v >= 0)];
  const r: number[] = [R_STRIKER, ...xs0.map(() => R_COIN)];
  const m: number[] = [M_STRIKER, ...xs0.map(() => M_COIN)];
  const speed = MIN_SPEED + (MAX_SPEED - MIN_SPEED) * Math.min(1, Math.max(0, power));
  vx[0] = dx * speed;
  vy[0] = dy * speed;
  const sunk: number[] = [];
  let striker = false;
  const frames: number[][] = [];
  const dec = FRICTION * DT;
  let steps = 0;
  for (; steps < MAX_STEPS; steps++) {
    let moving = false;
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      const s2 = vx[i] * vx[i] + vy[i] * vy[i];
      if (s2 === 0) continue;
      const s = Math.sqrt(s2);
      if (s <= dec) {
        vx[i] = 0;
        vy[i] = 0;
        continue;
      }
      moving = true;
      const f = (s - dec) / s;
      vx[i] = vx[i] * f;
      vy[i] = vy[i] * f;
      px[i] = px[i] + vx[i] * DT;
      py[i] = py[i] + vy[i] * DT;
      if (px[i] < r[i]) {
        px[i] = r[i];
        vx[i] = -vx[i] * WALL_E;
      } else if (px[i] > BOARD - r[i]) {
        px[i] = BOARD - r[i];
        vx[i] = -vx[i] * WALL_E;
      }
      if (py[i] < r[i]) {
        py[i] = r[i];
        vy[i] = -vy[i] * WALL_E;
      } else if (py[i] > BOARD - r[i]) {
        py[i] = BOARD - r[i];
        vy[i] = -vy[i] * WALL_E;
      }
    }
    if (!moving) break;
    // into the pockets
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      for (const [qx, qy] of POCKETS) {
        const ex = px[i] - qx;
        const ey = py[i] - qy;
        if (ex * ex + ey * ey < POCKET_R * POCKET_R) {
          on[i] = false;
          vx[i] = 0;
          vy[i] = 0;
          if (i === 0) striker = true;
          else sunk.push(i - 1);
          break;
        }
      }
    }
    // knocking into each other
    for (let i = 0; i < n; i++) {
      if (!on[i]) continue;
      for (let j = i + 1; j < n; j++) {
        if (!on[j]) continue;
        const ex = px[j] - px[i];
        const ey = py[j] - py[i];
        const d2 = ex * ex + ey * ey;
        const rr = r[i] + r[j];
        if (d2 >= rr * rr || d2 === 0) continue;
        const d = Math.sqrt(d2);
        const nx = ex / d;
        const ny = ey / d;
        const over = rr - d;
        const mt = m[i] + m[j];
        px[i] = px[i] - nx * over * (m[j] / mt);
        py[i] = py[i] - ny * over * (m[j] / mt);
        px[j] = px[j] + nx * over * (m[i] / mt);
        py[j] = py[j] + ny * over * (m[i] / mt);
        const rel = (vx[i] - vx[j]) * nx + (vy[i] - vy[j]) * ny;
        if (rel <= 0) continue;
        const k = ((1 + COIN_E) * rel) / (1 / m[i] + 1 / m[j]);
        vx[i] = vx[i] - (k * nx) / m[i];
        vy[i] = vy[i] - (k * ny) / m[i];
        vx[j] = vx[j] + (k * nx) / m[j];
        vy[j] = vy[j] + (k * ny) / m[j];
      }
    }
    if (every && steps % every === 0) {
      const fr: number[] = [];
      for (let i = 0; i < n; i++) fr.push(on[i] ? px[i] : -1, on[i] ? py[i] : -1);
      frames.push(fr);
    }
  }
  return {
    xs: px.slice(1).map((v, i) => (on[i + 1] ? round3(v) : -1)),
    ys: py.slice(1).map((v, i) => (on[i + 1] ? round3(v) : -1)),
    sunk,
    striker,
    frames,
    steps,
  };
}

/** the nearest free spot to the middle, for a coin that comes back */
export function freeSpot(xs: number[], ys: number[]): [number, number] {
  const dirs: Array<[number, number]> = [
    [0, 0],
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [0.7071067811865476, 0.7071067811865476],
    [-0.7071067811865476, 0.7071067811865476],
    [-0.7071067811865476, -0.7071067811865476],
    [0.7071067811865476, -0.7071067811865476],
  ];
  for (let ring = 0; ring < 12; ring++) {
    for (const [ux, uy] of dirs) {
      if (ring === 0 && (ux !== 0 || uy !== 0)) continue;
      if (ring > 0 && ux === 0 && uy === 0) continue;
      const x = round3(50 + ux * ring * (R_COIN * 2 + 0.2));
      const y = round3(50 + uy * ring * (R_COIN * 2 + 0.2));
      let free = true;
      for (let i = 0; i < xs.length; i++) {
        if (xs[i] < 0) continue;
        const ex = xs[i] - x;
        const ey = ys[i] - y;
        if (ex * ex + ey * ey < R_COIN * 2 * (R_COIN * 2)) {
          free = false;
          break;
        }
      }
      if (free) return [x, y];
    }
  }
  return [50, 50];
}

export interface CarromStep {
  state: CarromState;
  next: Seat | null;
  over: boolean;
  winner: Seat | null;
  line: string;
}

const words = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Take a shot as `seat`, and work out what it means: who goes next, what comes back, who's won. */
export function shoot(st: CarromState, seat: Seat, x: number, dx: number, dy: number, power: number): CarromStep | null {
  if (!strikerFits(st, seat, x) || !forward(seat, dy)) return null;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (!(len > 0.99 && len < 1.01) || !(power >= 0 && power <= 1)) return null;
  const sim = simulate(st.xs, st.ys, seat, x, dx, dy, power);
  const xs = [...sim.xs];
  const ys = [...sim.ys];
  const mine = seatKind(st, seat);
  const them = otherSeat(seat);
  const minesSunk = sim.sunk.filter((i) => coinKind(i) === mine);
  const theirsSunk = sim.sunk.filter((i) => coinKind(i) !== mine && coinKind(i) !== 'q');
  const queenSunk = sim.sunk.includes(0);
  const back = (i: number) => {
    const [fx, fy] = freeSpot(xs, ys);
    xs[i] = fx;
    ys[i] = fy;
  };
  const parts: string[] = [];
  let queen = st.queen;
  let again = false;
  const foul = sim.striker;
  if (foul) {
    // the striker went in: what you sank this go comes back, and one more of yours as a forfeit
    for (const i of [...minesSunk, ...(queenSunk ? [0] : [])]) back(i);
    let fine = -1;
    for (let i = 1; i < COINS; i++) if (coinKind(i) === mine && xs[i] < 0 && !sim.sunk.includes(i)) fine = i;
    if (fine >= 0) back(fine);
    if (queen === `pending-${seat}`) {
      queen = 'board';
      if (xs[0] < 0) back(0);
    }
    parts.push(fine >= 0 || minesSunk.length ? 'sank the striker, so a coin of theirs came back' : 'sank the striker');
    if (theirsSunk.length) parts.push(`sank ${theirsSunk.length > 1 ? `${words[theirsSunk.length]} of yours` : 'one of yours'}`);
  } else {
    if (minesSunk.length) parts.push(`sank ${words[minesSunk.length] || minesSunk.length} of their own`);
    if (theirsSunk.length) parts.push(`sank ${theirsSunk.length > 1 ? `${words[theirsSunk.length]} of yours` : 'one of yours'}`);
    if (queenSunk) {
      if (minesSunk.length) {
        queen = seat;
        parts.push('sank the queen and covered her');
      } else {
        queen = `pending-${seat}`;
        parts.push('sank the queen');
      }
      again = true;
    } else if (st.queen === `pending-${seat}`) {
      if (minesSunk.length) {
        queen = seat;
        parts.push('covered the queen');
      } else {
        queen = 'board';
        back(0);
        parts.push('couldn’t cover the queen, so she went back');
      }
    }
    if (minesSunk.length) again = true;
  }
  if (!parts.length) parts.push('took a shot');
  // nobody sinks their last coin before the queen's covered
  const covered = queen === 'a' || queen === 'b';
  const left = (k: CoinKind) => {
    let n = 0;
    for (let i = 1; i < COINS; i++) if (coinKind(i) === k && xs[i] >= 0) n++;
    return n;
  };
  for (const k of [mine, mine === 'w' ? 'b' : 'w'] as CoinKind[]) {
    if (left(k) === 0 && !covered) {
      const last = [...sim.sunk].reverse().find((i) => coinKind(i) === k);
      if (last !== undefined) {
        back(last);
        parts.push(k === mine ? 'their last coin came back (the queen comes first)' : 'your last coin came back (the queen comes first)');
        if (k === mine) again = false;
      }
    }
  }
  // a queen still waiting to be covered goes back when the turn passes
  if (queen === `pending-${seat}` && !(again && !foul)) {
    queen = 'board';
    if (xs[0] < 0) back(0);
  }
  let winner: Seat | null = null;
  if (left(mine) === 0) winner = seat;
  else if (left(mine === 'w' ? 'b' : 'w') === 0) winner = them;
  const line = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
  return {
    state: {
      ...st,
      xs,
      ys,
      queen,
      shot: { by: seat, x, dx, dy, power, xs: st.xs, ys: st.ys },
      sunk: sim.sunk.length ? sim.sunk : null,
      foul,
      shots: st.shots + 1,
    },
    next: winner ? null : again && !foul ? seat : them,
    over: !!winner,
    winner,
    line: winner ? (winner === seat ? `${line}, and that’s all of theirs: they win` : `${line}, and that’s all of yours: you win`) : line,
  };
}

/** a flick that sends the striker at `tx, ty` from `x` on this seat's baseline */
export function aimAt(seat: Seat, x: number, tx: number, ty: number): [number, number] {
  const ex = tx - x;
  const ey = ty - BASELINE[seat];
  const d = Math.sqrt(ex * ex + ey * ey);
  return d > 0 ? [ex / d, ey / d] : [0, seat === 'a' ? -1 : 1];
}

/**
 * The demo room's partner: for some of its coins and some pockets, the place to hit the coin so it heads for the
 * pocket, from a few spots on the baseline; it plays the most promising out, and keeps the best.
 */
export function botShot(st: CarromState, bot: Seat, rng = Math.random): { x: number; dx: number; dy: number; power: number } {
  const mine = seatKind(st, bot);
  const tries: Array<{ x: number; dx: number; dy: number; power: number }> = [];
  const spots = [26, 34, 42, 50, 58, 66, 74];
  let left = 0;
  for (let i = 1; i < COINS; i++) if (coinKind(i) === mine && st.xs[i] >= 0) left++;
  for (let i = 0; i < COINS; i++) {
    if (st.xs[i] < 0 || (i > 0 && coinKind(i) !== mine)) continue;
    for (const [qx, qy] of POCKETS) {
      const ex = qx - st.xs[i];
      const ey = qy - st.ys[i];
      const d = Math.sqrt(ex * ex + ey * ey);
      // where the striker should touch the coin
      const tx = st.xs[i] - (ex / d) * (R_COIN + R_STRIKER);
      const ty = st.ys[i] - (ey / d) * (R_COIN + R_STRIKER);
      for (const x of spots) {
        if (!strikerFits(st, bot, x)) continue;
        const [dx, dy] = aimAt(bot, x, tx, ty);
        if (!forward(bot, dy)) continue;
        // a cut that's too fine rarely works
        if ((dx * ex + dy * ey) / d < 0.55) continue;
        tries.push({ x, dx, dy, power: Math.min(1, 0.35 + d / 160) });
      }
    }
  }
  if (!tries.length) {
    let x = 50;
    for (const s of spots) if (strikerFits(st, bot, s)) { x = s; break; }
    const [dx, dy] = aimAt(bot, x, 50, 50);
    return { x, dx, dy, power: 0.7 };
  }
  // play a handful out, chosen at random, and keep the best
  let best = tries[0];
  let bestV = -Infinity;
  for (let k = 0; k < Math.min(6, tries.length); k++) {
    const t = tries[Math.floor(rng() * tries.length)];
    const sim = simulate(st.xs, st.ys, bot, t.x, t.dx, t.dy, t.power);
    let v = 0;
    for (const i of sim.sunk) v += coinKind(i) === mine ? 10 : i === 0 ? (left <= 2 ? 14 : 6) : -6;
    if (sim.striker) v -= 15;
    v += rng() * 3;
    if (v > bestV) {
      bestV = v;
      best = t;
    }
  }
  // and a steady hand, but not a perfect one
  const e = (rng() - 0.5) * 0.05;
  let dx = best.dx - best.dy * e;
  let dy = best.dy + best.dx * e;
  const d = Math.sqrt(dx * dx + dy * dy);
  dx = dx / d;
  dy = dy / d;
  if (!forward(bot, dy)) return best;
  return { x: best.x, dx, dy, power: best.power };
}
