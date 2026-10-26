import type { Seat } from './types';
import type { LiveDef } from './live/lobby';
import { COUNTDOWN_MS } from './live/lobby';

/**
 * Coasters: air hockey on the coffee table, with two drink coasters for mallets and a bottle cap for a
 * puck. First to 7.
 *
 * The table is TABLE_W x TABLE_H (portrait). Whoever built the place (a) defends the bottom goal and the
 * other seat (b) the top one; each screen turns the table round so your own goal is always at the
 * bottom. Each of you only says where you want your coaster to be; the host's screen moves both coasters
 * there (at most MALLET_SPEED), runs the puck and keeps score.
 */

export const TABLE_W = 100;
export const TABLE_H = 160;
export const MID = TABLE_H / 2;
export const PUCK_R = 4;
export const MALLET_R = 8;
/** the goal mouths, at both ends */
export const GOAL_X0 = 33;
export const GOAL_X1 = 67;
export const TO_WIN = 7;

/** units a second */
const MALLET_SPEED = 330;
const MAX_PUCK = 240;
/** how lively the puck is off the coasters and the rails */
const HIT_E = 0.92;
const RAIL_E = 0.9;
/** the table's drag: the puck keeps this much of its speed after a second */
const GLIDE = 0.72;
/** after a goal, the puck waits this long in the half of whoever let it in */
export const SERVE_MS = 1100;
const STEP = 0.004;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface Coaster extends Body {
  /** where its owner wants it */
  tx: number;
  ty: number;
}

export interface CoastersState {
  puck: Body;
  mal: Record<Seat, Coaster>;
  score: Record<Seat, number>;
  /** the puck stays put until then (the start, and after each goal) */
  serveAt: number;
  /** the host's time when this state was worked out (the other screen moves the puck on from here) */
  t: number;
  /** goes up with every touch of a coaster (for the sound) */
  hits: number;
  lastGoal: Seat | null;
  winner: Seat | null;
}

export interface CoastersAct {
  /** where I want my coaster, on the table (not my screen's turned-round view of it) */
  x: number;
  y: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const r2 = (v: number) => Math.round(v * 100) / 100;

/** the part of the table each of you can reach: your own half */
export function reach(seat: Seat, x: number, y: number) {
  const top = seat === 'a' ? MID + MALLET_R : MALLET_R;
  const bottom = seat === 'a' ? TABLE_H - MALLET_R : MID - MALLET_R;
  return { x: clamp(x, MALLET_R, TABLE_W - MALLET_R), y: clamp(y, top, bottom) };
}

const home = (seat: Seat): Coaster => {
  const y = seat === 'a' ? TABLE_H - 22 : 22;
  return { x: TABLE_W / 2, y, vx: 0, vy: 0, tx: TABLE_W / 2, ty: y };
};
/** the puck, waiting in the half of whoever's to serve */
const served = (to: Seat): Body => ({ x: TABLE_W / 2, y: to === 'a' ? MID + 24 : MID - 24, vx: 0, vy: 0 });

function hit(p: Body, m: Coaster) {
  const dx = p.x - m.x;
  const dy = p.y - m.y;
  const d = Math.hypot(dx, dy);
  const min = PUCK_R + MALLET_R;
  if (d >= min) return false;
  const nx = d > 1e-4 ? dx / d : 0;
  const ny = d > 1e-4 ? dy / d : m.y > MID ? -1 : 1;
  p.x = m.x + nx * min;
  p.y = m.y + ny * min;
  const rv = (p.vx - m.vx) * nx + (p.vy - m.vy) * ny;
  if (rv < 0) {
    p.vx -= (1 + HIT_E) * rv * nx;
    p.vy -= (1 + HIT_E) * rv * ny;
  }
  return true;
}

/** Move everything on by `dt` seconds. Returns who scored, if anyone did. */
function step(s: { puck: Body; mal: Record<Seat, Coaster> }, dt: number, puckLive: boolean) {
  let touches = 0;
  let goal: Seat | null = null;
  const n = Math.max(1, Math.ceil(dt / STEP));
  const h = dt / n;
  const p = s.puck;
  for (let i = 0; i < n && !goal; i++) {
    for (const seat of ['a', 'b'] as Seat[]) {
      const m = s.mal[seat];
      const dx = m.tx - m.x;
      const dy = m.ty - m.y;
      const d = Math.hypot(dx, dy);
      const most = MALLET_SPEED * h;
      const k = d > most ? most / d : 1;
      m.vx = (dx * k) / h;
      m.vy = (dy * k) / h;
      m.x += dx * k;
      m.y += dy * k;
    }
    if (!puckLive) continue;
    p.x += p.vx * h;
    p.y += p.vy * h;
    const drag = Math.pow(GLIDE, h);
    p.vx *= drag;
    p.vy *= drag;
    if (hit(p, s.mal.a)) touches++;
    if (hit(p, s.mal.b)) touches++;
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > MAX_PUCK) {
      p.vx *= MAX_PUCK / sp;
      p.vy *= MAX_PUCK / sp;
    }
    // the side rails
    if (p.x < PUCK_R) {
      p.x = PUCK_R;
      p.vx = Math.abs(p.vx) * RAIL_E;
    } else if (p.x > TABLE_W - PUCK_R) {
      p.x = TABLE_W - PUCK_R;
      p.vx = -Math.abs(p.vx) * RAIL_E;
    }
    // the ends: a rail, except for the goal mouth
    const mouth = p.x > GOAL_X0 + 1 && p.x < GOAL_X1 - 1;
    if (p.y < PUCK_R && !mouth) {
      p.y = PUCK_R;
      p.vy = Math.abs(p.vy) * RAIL_E;
    } else if (p.y > TABLE_H - PUCK_R && !mouth) {
      p.y = TABLE_H - PUCK_R;
      p.vy = -Math.abs(p.vy) * RAIL_E;
    }
    if (p.y < -PUCK_R) goal = 'a';
    else if (p.y > TABLE_H + PUCK_R) goal = 'b';
  }
  return { touches, goal };
}

/**
 * Where the puck will look to be `dt` seconds after a state (for drawing between updates):
 * it slides on, bouncing off the rails, but never into a goal.
 */
export function glide(p: Body, dt: number): Body {
  const q = { ...p };
  const s = { puck: q, mal: { a: { ...home('a'), x: -99, y: -99, tx: -99, ty: -99 }, b: { ...home('b'), x: -99, y: -99, tx: -99, ty: -99 } } };
  step(s, Math.max(0, Math.min(0.15, dt)), true);
  q.y = clamp(q.y, -PUCK_R, TABLE_H + PUCK_R);
  return q;
}

export const COASTERS: LiveDef<CoastersState, CoastersAct> = {
  init: (rng, now) => ({
    puck: served(rng() < 0.5 ? 'a' : 'b'),
    mal: { a: home('a'), b: home('b') },
    score: { a: 0, b: 0 },
    serveAt: now + COUNTDOWN_MS,
    t: now,
    hits: 0,
    lastGoal: null,
    winner: null,
  }),
  act: (s, seat, a) => {
    if (s.winner || !a || !Number.isFinite(a.x) || !Number.isFinite(a.y)) return s;
    const r = reach(seat, a.x, a.y);
    const m = s.mal[seat];
    if (m.tx === r.x && m.ty === r.y) return s;
    return { ...s, mal: { ...s.mal, [seat]: { ...m, tx: r.x, ty: r.y } } };
  },
  tick: (s, now) => {
    if (s.winner) return s;
    const dt = Math.max(0, Math.min(0.05, (now - s.t) / 1000));
    const next = { puck: { ...s.puck }, mal: { a: { ...s.mal.a }, b: { ...s.mal.b } } };
    const { touches, goal } = step(next, dt, now >= s.serveAt);
    const round = (b: Body) => ({ ...b, x: r2(b.x), y: r2(b.y), vx: r2(b.vx), vy: r2(b.vy) });
    const base = {
      ...s,
      t: now,
      hits: s.hits + touches,
      mal: { a: { ...round(next.mal.a), tx: next.mal.a.tx, ty: next.mal.a.ty }, b: { ...round(next.mal.b), tx: next.mal.b.tx, ty: next.mal.b.ty } },
      puck: round(next.puck),
    };
    if (!goal) return base;
    const score = { ...s.score, [goal]: s.score[goal] + 1 };
    const conceded: Seat = goal === 'a' ? 'b' : 'a';
    return {
      ...base,
      score,
      lastGoal: goal,
      puck: served(conceded),
      serveAt: now + SERVE_MS,
      winner: score[goal] >= TO_WIN ? goal : null,
    };
  },
  result: (s) => {
    if (!s.winner) return null;
    const w = s.winner;
    const l: Seat = w === 'a' ? 'b' : 'a';
    return { winner: w, line: `won ${s.score[w]}–${s.score[l]}`, score: { ...s.score } };
  },
  // the demo room's partner: guards its goal, and goes for the puck when it's on their side
  bot: (s, seat, now) => {
    if (s.winner || now < s.serveAt - 300) return null;
    const p = glide(s.puck, 0.08);
    const mine = seat === 'a' ? p.y > MID : p.y < MID;
    const back = seat === 'a' ? 1 : -1;
    const jitter = (Math.sin(now / 370) + Math.sin(now / 910)) * 3;
    if (mine) return { x: p.x + jitter * 0.6, y: p.y + back * (PUCK_R + 2) };
    const homeY = seat === 'a' ? TABLE_H - 20 : 20;
    return { x: TABLE_W / 2 + (p.x - TABLE_W / 2) * 0.55 + jitter, y: homeY };
  },
  botMs: 90,
  tickMs: 16,
  continuous: true,
  phase: (s) => `${s.score.a}-${s.score.b}${s.winner ? '!' : ''}`,
};
