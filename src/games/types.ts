/**
 * Games for two. Each game keeps one "match" document: whose move it is,
 * the board, and a running tally of wins. Turn-based games live entirely in
 * that document, so you can take your turn hours after your person took theirs.
 */

export type GameKind =
  | 'fireflies'
  | 'boats'
  | 'doodle'
  | 'noughts'
  | 'fence'
  | 'lanterns'
  | 'tug'
  | 'quickdraw'
  | 'rps';

/** 'turns': play across the day, whenever it's your move. 'live': you're both here, right now. */
export type GameMode = 'turns' | 'live';

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
  mode: GameMode;
}

export const GAMES: Record<GameKind, GameInfo> = {
  fireflies: {
    kind: 'fireflies',
    name: 'Fireflies',
    tagline: 'Drop fireflies into the jar. Four in a row, any direction, wins.',
    style: 'Take turns',
    mode: 'turns',
  },
  boats: {
    kind: 'boats',
    name: 'Paper Boats',
    tagline: 'Hide four paper boats on your pond, then take turns guessing where theirs are.',
    style: 'Take turns',
    mode: 'turns',
  },
  doodle: {
    kind: 'doodle',
    name: 'Doodle Guess',
    tagline: 'One draws on a little pixel canvas, the other guesses. Then swap. Six drawings, scored together.',
    style: 'Live, together',
    mode: 'live',
  },
  noughts: {
    kind: 'noughts',
    name: 'Noughts & Hearts',
    tagline: 'Three in a row on a little board. Best of five, and whoever went second starts the next one.',
    style: 'Take turns',
    mode: 'turns',
  },
  fence: {
    kind: 'fence',
    name: 'Fence the Garden',
    tagline: 'Take turns adding a bit of fence. Close a bed and it’s yours, and you go again. Most beds wins.',
    style: 'Take turns',
    mode: 'turns',
  },
  lanterns: {
    kind: 'lanterns',
    name: 'Lanterns',
    tagline: 'Light a lantern to trap theirs in a line, and they all turn your colour. Most lanterns at the end wins.',
    style: 'Take turns',
    mode: 'turns',
  },
  tug: {
    kind: 'tug',
    name: 'Tug of War',
    tagline: 'Tap as fast as you can to pull the ribbon over to your side. Twenty seconds, no mercy.',
    style: 'Live',
    mode: 'live',
  },
  quickdraw: {
    kind: 'quickdraw',
    name: 'Quick Draw',
    tagline: 'Wait for the lantern to light, then tap. Quickest wins the round; tap too soon and you lose it. First to three.',
    style: 'Live',
    mode: 'live',
  },
  rps: {
    kind: 'rps',
    name: 'Paper, Scissors, Stone',
    tagline: 'Pick before the timer runs out, and see what they picked. First to three rounds.',
    style: 'Live',
    mode: 'live',
  },
};
