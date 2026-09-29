import type { GameKind, Match, Seat } from './types';
import { newMatchId, otherSeat } from './types';
import { FirefliesState, botColumn, columnPlace, drop, emptyFireflies, findLine, isFull } from './fireflies';
import { Boat, BoatsState, boatName, botShot, coordName, emptyBoats, randomFleet, shoot } from './boats';

/**
 * The moves of each game, as plain functions from one match to the next.
 * The screens and the demo room's partner both go through these.
 */

const base = <S,>(kind: GameKind, starter: Seat, state: S, wins: Record<Seat, number> | undefined): Match<S> => {
  const now = Date.now();
  return {
    kind,
    id: newMatchId(),
    status: 'playing',
    turn: starter,
    winner: null,
    startedBy: starter,
    startedAt: now,
    updatedAt: now,
    updatedBy: starter,
    seq: 0,
    state,
    wins: { a: wins?.a || 0, b: wins?.b || 0 },
    last: 'started a game',
  };
};

/* ---------- Fireflies ---------- */

export const newFireflies = (starter: Seat, wins?: Record<Seat, number>) => base<FirefliesState>('fireflies', starter, emptyFireflies(), wins);

export function fireflyMove(m: Match<FirefliesState>, seat: Seat, col: number): Match<FirefliesState> | null {
  if (m.status !== 'playing' || m.turn !== seat) return null;
  const d = drop(m.state.board, col, seat);
  if (!d) return null;
  const line = findLine(d.board);
  const over = !!line || isFull(d.board);
  return {
    ...m,
    state: { board: d.board, lastCell: d.cell, line: line ? line.cells : null },
    status: over ? 'over' : 'playing',
    turn: over ? null : otherSeat(seat),
    winner: line ? line.seat : over ? 'draw' : null,
    last: line ? 'lined up four fireflies' : over ? 'filled the jar, so it’s a draw' : `dropped a firefly ${columnPlace(col)}`,
  };
}

/* ---------- Paper Boats ---------- */

export const newBoats = (starter: Seat, wins?: Record<Seat, number>): Match<BoatsState> => ({
  ...base<BoatsState>('boats', starter, emptyBoats(), wins),
  status: 'setup',
  turn: null,
  last: 'started a game',
});

export function boatsReady(m: Match<BoatsState>, seat: Seat, fleet: Boat[]): Match<BoatsState> | null {
  if (m.status !== 'setup' || m.state.fleets[seat]) return null;
  const fleets = { ...m.state.fleets, [seat]: fleet };
  const both = !!fleets.a && !!fleets.b;
  return {
    ...m,
    state: { ...m.state, fleets },
    status: both ? 'playing' : 'setup',
    // whoever hides their boats second is here right now, so they go first
    turn: both ? seat : null,
    last: 'hid their boats',
  };
}

export function boatsShot(m: Match<BoatsState>, seat: Seat, cell: number): Match<BoatsState> | null {
  if (m.status !== 'playing' || m.turn !== seat) return null;
  const r = shoot(m.state, seat, cell);
  if (!r) return null;
  const at = coordName(cell);
  return {
    ...m,
    state: r.state,
    status: r.allSunk ? 'over' : 'playing',
    turn: r.allSunk ? null : otherSeat(seat),
    winner: r.allSunk ? seat : null,
    last: r.allSunk
      ? `sank the last boat at ${at}`
      : r.sunk
        ? `sank ${boatName(r.sunk)} at ${at}`
        : r.hit
          ? `hit a boat at ${at}`
          : `guessed ${at}: just water`,
  };
}

/* ---------- what each game needs from whom ---------- */

export function needsMe(m: Match | undefined | null, seat: Seat): boolean {
  if (!m) return false;
  if (m.status === 'playing') return m.turn === seat;
  if (m.status === 'setup' && m.kind === 'boats') return !(m as Match<BoatsState>).state.fleets[seat];
  return false;
}

/** The demo room's partner takes its turn. */
export function botAct(m: Match, bot: Seat): Match | null {
  if (m.kind === 'fireflies') {
    const f = m as Match<FirefliesState>;
    return f.status === 'playing' && f.turn === bot ? fireflyMove(f, bot, botColumn(f.state.board, bot)) : null;
  }
  if (m.kind === 'boats') {
    const b = m as Match<BoatsState>;
    if (b.status === 'setup' && !b.state.fleets[bot]) return boatsReady(b, bot, randomFleet());
    if (b.status === 'playing' && b.turn === bot) return boatsShot(b, bot, botShot(b.state, bot));
  }
  return null;
}
