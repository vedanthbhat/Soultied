import type { Seat } from './types';

/**
 * Paper Boats: battleship on a pond. Each of you hides four boats on an 8x8
 * pond (they never touch, not even at the corners), then you take turns
 * guessing where the other's are. One guess per turn.
 */

export const SIZE = 8;
export const FLEET = [4, 3, 3, 2];
export const CELLS = SIZE * SIZE;

export interface Boat {
  x: number;
  y: number;
  len: number;
  /** true: runs downwards; false: runs across */
  down: boolean;
}

export interface BoatsState {
  /** each person's boats, set during setup */
  fleets: Partial<Record<Seat, Boat[]>>;
  /** the guesses each person has made at the other's pond: '.' not tried, 'o' splash, 'x' hit */
  shots: Record<Seat, string>;
  /** the last guess, for the ripple */
  lastShot: { by: Seat; cell: number } | null;
}

export const emptyBoats = (): BoatsState => ({ fleets: {}, shots: { a: '.'.repeat(CELLS), b: '.'.repeat(CELLS) }, lastShot: null });

export const idx = (x: number, y: number) => y * SIZE + x;
export const coordName = (i: number) => `${'ABCDEFGH'[i % SIZE]}${Math.floor(i / SIZE) + 1}`;

export function boatCells(b: Boat): number[] {
  return [...Array(b.len).keys()].map((k) => idx(b.x + (b.down ? 0 : k), b.y + (b.down ? k : 0)));
}

/** Cells a boat takes up plus the ring around it (where no other boat may go). */
function footprint(b: Boat): Set<number> {
  const out = new Set<number>();
  const w = b.down ? 1 : b.len;
  const h = b.down ? b.len : 1;
  for (let y = b.y - 1; y <= b.y + h; y++)
    for (let x = b.x - 1; x <= b.x + w; x++) if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) out.add(idx(x, y));
  return out;
}

const fits = (b: Boat) => b.x >= 0 && b.y >= 0 && (b.down ? b.y + b.len : b.x + b.len) <= SIZE && (b.down ? b.x : b.y) < SIZE;

export function canPlace(fleet: Boat[], b: Boat) {
  if (!fits(b)) return false;
  const cells = boatCells(b);
  return fleet.every((o) => {
    const f = footprint(o);
    return cells.every((c) => !f.has(c));
  });
}

export function randomFleet(rng = Math.random): Boat[] {
  for (let attempt = 0; attempt < 200; attempt++) {
    const fleet: Boat[] = [];
    let ok = true;
    for (const len of FLEET) {
      let placed = false;
      for (let tries = 0; tries < 100 && !placed; tries++) {
        const down = rng() < 0.5;
        const b: Boat = { len, down, x: Math.floor(rng() * (down ? SIZE : SIZE - len + 1)), y: Math.floor(rng() * (down ? SIZE - len + 1 : SIZE)) };
        if (canPlace(fleet, b)) {
          fleet.push(b);
          placed = true;
        }
      }
      if (!placed) {
        ok = false;
        break;
      }
    }
    if (ok) return fleet;
  }
  // never reached in practice: a fixed, legal layout
  return [
    { x: 0, y: 0, len: 4, down: false },
    { x: 0, y: 2, len: 3, down: false },
    { x: 0, y: 4, len: 3, down: false },
    { x: 0, y: 6, len: 2, down: false },
  ];
}

/** Which of these boats have been hit in every cell. */
export function sunkBoats(fleet: Boat[] | undefined, shotsAgainst: string): Boat[] {
  return (fleet || []).filter((b) => boatCells(b).every((c) => shotsAgainst[c] === 'x'));
}

export function boatAt(fleet: Boat[] | undefined, cellIndex: number): Boat | null {
  return (fleet || []).find((b) => boatCells(b).includes(cellIndex)) || null;
}

export interface ShotResult {
  state: BoatsState;
  hit: boolean;
  sunk: Boat | null;
  allSunk: boolean;
}

/** `by` guesses a cell on the other person's pond. */
export function shoot(state: BoatsState, by: Seat, cellIndex: number): ShotResult | null {
  const them: Seat = by === 'a' ? 'b' : 'a';
  const fleet = state.fleets[them];
  if (!fleet || state.shots[by][cellIndex] !== '.') return null;
  const hit = !!boatAt(fleet, cellIndex);
  const row = state.shots[by];
  const shots = { ...state.shots, [by]: row.slice(0, cellIndex) + (hit ? 'x' : 'o') + row.slice(cellIndex + 1) };
  const next: BoatsState = { ...state, shots, lastShot: { by, cell: cellIndex } };
  const b = hit ? boatAt(fleet, cellIndex) : null;
  const sunk = b && boatCells(b).every((c) => shots[by][c] === 'x') ? b : null;
  const allSunk = sunkBoats(fleet, shots[by]).length === fleet.length;
  return { state: next, hit, sunk, allSunk };
}

const LEN_NAMES: Record<number, string> = { 2: 'the little boat', 3: 'a three-boat', 4: 'the big boat' };
export const boatName = (b: Boat) => LEN_NAMES[b.len] || 'a boat';

/**
 * The demo room's partner. Follows up a hit along its line, otherwise guesses
 * on a checkerboard, and skips the water around boats it has already sunk.
 */
export function botShot(state: BoatsState, bot: Seat, rng = Math.random): number {
  const them: Seat = bot === 'a' ? 'b' : 'a';
  const mine = state.shots[bot];
  const sunk = sunkBoats(state.fleets[them], mine);
  const blocked = new Set<number>();
  sunk.forEach((b) => footprint(b).forEach((c) => blocked.add(c)));
  const open = (i: number) => mine[i] === '.' && !blocked.has(i);
  const hits = [...mine].map((ch, i) => (ch === 'x' && !blocked.has(i) ? i : -1)).filter((i) => i >= 0);
  const xy = (i: number) => [i % SIZE, Math.floor(i / SIZE)];
  if (hits.length) {
    const tries: number[] = [];
    const [x0, y0] = xy(hits[0]);
    const inLine = hits.length > 1 && hits.every((h) => xy(h)[1] === y0) ? 'across' : hits.length > 1 && hits.every((h) => xy(h)[0] === x0) ? 'down' : null;
    for (const h of hits) {
      const [x, y] = xy(h);
      const n: Array<[number, number]> =
        inLine === 'across' ? [[x - 1, y], [x + 1, y]] : inLine === 'down' ? [[x, y - 1], [x, y + 1]] : [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]];
      for (const [nx, ny] of n) if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && open(idx(nx, ny))) tries.push(idx(nx, ny));
    }
    if (tries.length) return tries[Math.floor(rng() * tries.length)];
  }
  const all = [...Array(CELLS).keys()].filter(open);
  const checker = all.filter((i) => (i % SIZE + Math.floor(i / SIZE)) % 2 === 0);
  const pool = checker.length ? checker : all.length ? all : [...Array(CELLS).keys()].filter((i) => mine[i] === '.');
  return pool[Math.floor(rng() * pool.length)];
}
