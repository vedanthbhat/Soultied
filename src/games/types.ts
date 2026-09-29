/**
 * Games for two. Each game keeps one "match" document: whose move it is,
 * the board, and a running tally of wins. Turn-based games live entirely in
 * that document, so you can take your turn hours after your person took theirs.
 */

export type GameKind = 'fireflies' | 'boats';

/** 'a' is whoever built the place, 'b' is the person who joined (same as the couch). */
export type Seat = 'a' | 'b';

export const otherSeat = (s: Seat): Seat => (s === 'a' ? 'b' : 'a');

export type MatchStatus = 'setup' | 'playing' | 'over';

export interface Match<S = unknown> {
  kind: GameKind;
  /** a new id for every game, so a rematch is never mistaken for the last one */
  id: string;
  status: MatchStatus;
  /** the seat whose move it is (null while setting up or once it's over) */
  turn: Seat | null;
  winner: Seat | 'draw' | null;
  startedBy: Seat;
  startedAt: number;
  updatedAt: number;
  updatedBy: Seat;
  /** goes up by one with every move */
  seq: number;
  state: S;
  /** wins so far, across every game of this kind */
  wins: Record<Seat, number>;
  /** a short line about the last thing that happened, e.g. "dropped a firefly in the middle" */
  last: string;
}

export const newMatchId = () => `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export interface GameInfo {
  kind: GameKind;
  name: string;
  tagline: string;
  /** how it's played, shown on the box */
  style: string;
}

export const GAMES: Record<GameKind, GameInfo> = {
  fireflies: {
    kind: 'fireflies',
    name: 'Fireflies',
    tagline: 'Drop fireflies into the jar. Four in a row, any direction, wins.',
    style: 'Take turns',
  },
  boats: {
    kind: 'boats',
    name: 'Paper Boats',
    tagline: 'Hide four paper boats on your pond, then take turns guessing where theirs are.',
    style: 'Take turns',
  },
};
