import type { GameKind, Match, Seat } from '../types';
import { newMatchId } from '../types';

/**
 * A live game's match document is only the invitation and the result: who's
 * in, and who won. Everything in between happens over the live link (see
 * link.ts and useLiveGame.ts), with whoever started the game keeping score.
 */

export interface LiveResult {
  winner: Seat | 'draw' | null;
  /** e.g. "won 3–1" */
  line: string;
  score?: Record<Seat, number>;
}

export interface LiveLobby {
  phase: 'lobby' | 'live' | 'done';
  joined: Partial<Record<Seat, boolean>>;
  /** so both screens agree on anything random (questions, cards) */
  seed: number;
  result?: LiveResult | null;
}

/** An invitation nobody answered, or a game nobody finished, is forgotten after this long. */
export const LIVE_STALE_MS = 15 * 60 * 1000;

export const liveStale = (m: Match | null | undefined) => !!m && m.status !== 'over' && Date.now() - m.updatedAt > LIVE_STALE_MS;

export function newLive(kind: GameKind, starter: Seat, wins?: Record<Seat, number>): Match<LiveLobby> {
  const now = Date.now();
  return {
    kind,
    id: newMatchId(),
    status: 'setup',
    turn: null,
    winner: null,
    startedBy: starter,
    startedAt: now,
    updatedAt: now,
    updatedBy: starter,
    seq: 0,
    state: { phase: 'lobby', joined: { [starter]: true }, seed: Math.floor(Math.random() * 2 ** 31), result: null },
    wins: { a: wins?.a || 0, b: wins?.b || 0 },
    last: 'wants to play',
  };
}

export function liveJoin(m: Match<LiveLobby>, seat: Seat): Match<LiveLobby> | null {
  if (m.status !== 'setup' || m.state.phase !== 'lobby' || m.state.joined[seat]) return null;
  const joined = { ...m.state.joined, [seat]: true };
  const both = !!(joined.a && joined.b);
  return {
    ...m,
    status: both ? 'playing' : 'setup',
    state: { ...m.state, joined, phase: both ? 'live' : 'lobby' },
    last: both ? 'joined' : 'is here',
  };
}

export function liveFinish(m: Match<LiveLobby>, r: LiveResult): Match<LiveLobby> | null {
  if (m.status === 'over') return null;
  return { ...m, status: 'over', turn: null, winner: r.winner, state: { ...m.state, phase: 'done', result: r }, last: r.line };
}

export function liveCancel(m: Match<LiveLobby>): Match<LiveLobby> | null {
  if (m.status === 'over') return null;
  return { ...m, status: 'over', turn: null, winner: null, state: { ...m.state, phase: 'done', result: null }, last: 'stopped the game' };
}

/** A small, repeatable random number source from a seed (mulberry32). */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The rules of one live game; useLiveGame runs them. */
export interface LiveDef<S, A> {
  /** a fresh game; `rng` is seeded from the match so anything random is fair */
  init: (rng: () => number, now: number) => S;
  /** someone did something (runs on the host) */
  act: (s: S, seat: Seat, a: A, now: number) => S;
  /** time passing (runs on the host every tickMs once the countdown is over) */
  tick?: (s: S, now: number) => S;
  /** the game is over: who won */
  result: (s: S) => LiveResult | null;
  /** the demo room's partner, asked every botMs */
  bot?: (s: S, seat: Seat, now: number) => A | null;
  botMs?: number;
  tickMs?: number;
  /** changes many times a second: shared over the fast route (only the latest matters) */
  continuous?: boolean;
  /** for continuous games: whenever this changes, the state is also sent the careful way */
  phase?: (s: S) => string;
}

export const COUNTDOWN_MS = 3000;
