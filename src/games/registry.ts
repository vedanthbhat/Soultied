import type { GameKind, Match, Seat } from './types';
import { newMatchId, otherSeat } from './types';
import { FirefliesState, botColumn, columnPlace, drop, emptyFireflies, findLine, isFull } from './fireflies';
import { Boat, BoatsState, boatName, botShot, coordName, emptyBoats, randomFleet, shoot } from './boats';
import { BOT_WORDS, DRAW_SECONDS, DoodleState, ROUNDS, judge, pickChoices } from './doodle';

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

/* ---------- Doodle Guess ---------- */

/** Starting Doodle Guess opens a little lobby; it begins once you're both in. */
export const newDoodle = (starter: Seat, best = 0): Match<DoodleState> => ({
  ...base<DoodleState>(
    'doodle',
    starter,
    { phase: 'lobby', joined: { [starter]: true }, round: 0, drawer: starter, choices: [], word: null, startedAt: null, endsAt: null, guesses: [], rounds: [], best },
    undefined
  ),
  status: 'setup',
  turn: null,
  last: 'wants to play Doodle Guess',
});

export function doodleJoin(m: Match<DoodleState>, seat: Seat): Match<DoodleState> | null {
  if (m.status === 'over' || m.state.phase !== 'lobby' || m.state.joined[seat]) return null;
  const joined = { ...m.state.joined, [seat]: true };
  if (!(joined.a && joined.b)) return { ...m, state: { ...m.state, joined }, last: 'is here' };
  const drawer = m.startedBy;
  return {
    ...m,
    status: 'playing',
    turn: drawer,
    state: { ...m.state, joined, phase: 'choosing', round: 1, drawer, choices: pickChoices() },
    last: 'joined',
  };
}

export function doodleChoose(m: Match<DoodleState>, seat: Seat, word: string): Match<DoodleState> | null {
  if (m.status !== 'playing' || m.state.phase !== 'choosing' || m.state.drawer !== seat) return null;
  const now = Date.now();
  return {
    ...m,
    turn: otherSeat(seat),
    state: { ...m.state, phase: 'drawing', word, choices: [], startedAt: now, endsAt: now + DRAW_SECONDS * 1000, guesses: [] },
    last: 'started drawing',
  };
}

/** A guess from whoever isn't drawing. `pixels` is the drawing as they see it, kept if they get it. */
export function doodleGuess(
  m: Match<DoodleState>,
  seat: Seat,
  text: string,
  pixels?: string
): { match: Match<DoodleState>; verdict: 'right' | 'close' | 'wrong' } | null {
  const st = m.state;
  const said = text.trim().slice(0, 40);
  if (m.status !== 'playing' || st.phase !== 'drawing' || st.drawer === seat || !st.word || !said) return null;
  const verdict = judge(said, st.word);
  const right = verdict === 'right';
  const guesses = [...st.guesses, { by: seat, text: said, right, ...(verdict === 'close' ? { close: true } : {}) }].slice(-12);
  if (!right) return { match: { ...m, state: { ...st, guesses }, last: `guessed “${said}”` }, verdict };
  const secs = Math.max(1, Math.round((Date.now() - (st.startedAt || Date.now())) / 1000));
  return {
    match: {
      ...m,
      turn: null,
      state: { ...st, guesses, phase: 'reveal', rounds: [...st.rounds, { word: st.word, drawer: st.drawer, secs, ...(pixels ? { pixels } : {}) }] },
      last: `guessed it: ${st.word}`,
    },
    verdict,
  };
}

/** Time's up (or someone gave up): show the word and move on. */
export function doodleTimeUp(m: Match<DoodleState>, pixels?: string, gaveUp = false): Match<DoodleState> | null {
  const st = m.state;
  if (m.status !== 'playing' || st.phase !== 'drawing' || !st.word) return null;
  return {
    ...m,
    turn: null,
    state: { ...st, phase: 'reveal', rounds: [...st.rounds, { word: st.word, drawer: st.drawer, secs: null, ...(pixels ? { pixels } : {}) }] },
    last: gaveUp ? 'skipped that one' : 'ran out of time',
  };
}

/** Keep the finished drawing with the round, when whoever ended it didn't have it. */
export function doodleKeepDrawing(m: Match<DoodleState>, pixels: string): Match<DoodleState> | null {
  const st = m.state;
  const i = st.rounds.length - 1;
  if (st.phase !== 'reveal' || i < 0 || st.rounds[i].pixels === pixels) return null;
  const rounds = st.rounds.map((r, k) => (k === i ? { ...r, pixels } : r));
  return { ...m, state: { ...st, rounds } };
}

export const doodleScore = (st: DoodleState) => st.rounds.filter((r) => r.secs !== null).length;

export function doodleNext(m: Match<DoodleState>): Match<DoodleState> | null {
  const st = m.state;
  if (m.status !== 'playing' || st.phase !== 'reveal') return null;
  if (st.round >= ROUNDS) {
    const score = doodleScore(st);
    return { ...m, status: 'over', turn: null, winner: null, state: { ...st, best: Math.max(st.best, score) }, last: `finished with ${score} of ${ROUNDS}` };
  }
  const drawer = otherSeat(st.drawer);
  return {
    ...m,
    turn: drawer,
    state: {
      ...st,
      phase: 'choosing',
      round: st.round + 1,
      drawer,
      choices: pickChoices(Math.random, st.rounds.map((r) => r.word)),
      word: null,
      startedAt: null,
      endsAt: null,
      guesses: [],
    },
    last: 'moved on to the next drawing',
  };
}

/** A lobby nobody answered, or a round nobody finished, stops nagging after a while. */
const STALE_MS = 30 * 60 * 1000;

/** A Doodle Guess nobody's touched for a while: treat it as over. */
export const doodleStale = (m: Match) => m.kind === 'doodle' && m.status !== 'over' && Date.now() - m.updatedAt > STALE_MS;

/* ---------- what each game needs from whom ---------- */

export function needsMe(m: Match | undefined | null, seat: Seat): boolean {
  if (!m) return false;
  if (m.kind === 'doodle') {
    const d = m as Match<DoodleState>;
    if (d.status === 'over' || doodleStale(d)) return false;
    if (d.state.phase === 'lobby') return !d.state.joined[seat];
    if (d.state.phase === 'choosing') return d.state.drawer === seat;
    // they're drawing: come and guess
    if (d.state.phase === 'drawing') return d.state.drawer !== seat && (d.state.endsAt || 0) > Date.now();
    return false;
  }
  if (m.status === 'playing') return m.turn === seat;
  if (m.status === 'setup' && m.kind === 'boats') return !(m as Match<BoatsState>).state.fleets[seat];
  return false;
}

/** The line for the little note in the room, e.g. "Rohan wants to play Doodle Guess." */
export function noteFor(m: Match, who: string, game: string): string {
  if (m.kind === 'doodle') {
    const d = m as Match<DoodleState>;
    if (d.state.phase === 'lobby') return `${who} wants to play ${game}. Join them?`;
    if (d.state.phase === 'drawing') return `${who} is drawing something in ${game}. Come and guess!`;
    return `It’s your turn to draw in ${game}.`;
  }
  if (m.status === 'setup') return `${who} started ${game}. Hide your boats!`;
  if (m.seq === 0) return `${who} started a game of ${game}. Your move.`;
  return `${who} ${m.last} in ${game}. Your move.`;
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
  if (m.kind === 'doodle') {
    const d = m as Match<DoodleState>;
    const st = d.state;
    if (st.phase === 'lobby') return doodleJoin(d, bot);
    if (st.phase === 'choosing' && st.drawer === bot) {
      const keys = Object.keys(BOT_WORDS).filter((k) => !st.rounds.some((r) => r.word === BOT_WORDS[k]));
      const key = keys[Math.floor(Math.random() * keys.length)] || 'sun';
      return doodleChoose(d, bot, BOT_WORDS[key]);
    }
    if (st.phase === 'drawing' && st.drawer !== bot && st.word) {
      // a couple of wrong guesses, then usually the right one
      const wrongs = st.guesses.filter((g) => g.by === bot && !g.right).length;
      const text = wrongs >= 2 || Math.random() < 0.3 ? (Math.random() < 0.85 ? st.word : 'no idea') : pickChoices(Math.random, [st.word])[0];
      return doodleGuess(d, bot, text)?.match || null;
    }
    if (st.phase === 'reveal' && otherSeat(st.drawer) === bot) return doodleNext(d);
  }
  return null;
}

/** How long the demo room's partner takes over each kind of move. */
export function botDelay(m: Match, bot: Seat): number {
  if (m.kind === 'doodle') {
    const st = (m as Match<DoodleState>).state;
    if (st.phase === 'drawing') return 7000 + Math.random() * 7000;
    if (st.phase === 'reveal') return 5000;
    return 1500;
  }
  void bot;
  if (m.kind === 'boats' && m.status === 'setup') return 900;
  return 1100 + Math.random() * 900;
}

/** Whether the demo room's partner has something to do (in Doodle Guess it also moves things on after a reveal). */
export function botTurn(m: Match | undefined | null, bot: Seat): boolean {
  if (!m) return false;
  if (m.kind === 'doodle' && m.status === 'playing') {
    const st = (m as Match<DoodleState>).state;
    if (st.phase === 'reveal') return otherSeat(st.drawer) === bot;
  }
  return needsMe(m, bot);
}

/** For the activity feed, once a game is over. */
export function endLine(m: Match, name: (s: Seat) => string, game: string): string {
  if (m.kind === 'doodle') {
    const n = doodleScore((m as Match<DoodleState>).state);
    return `Guessed ${n} of ${ROUNDS} drawings together at ${game}.`;
  }
  return m.winner === 'draw' ? `A draw at ${game}.` : `${name(m.winner as Seat)} won at ${game}.`;
}

/** Short words for the games stack in the room, e.g. "Your turn in Fireflies". */
export function waitingLabel(m: Match, who: string, game: string): string {
  if (m.kind === 'doodle') {
    const st = (m as Match<DoodleState>).state;
    if (st.phase === 'lobby') return `${who} wants to play ${game}`;
    if (st.phase === 'drawing') return `${who} is drawing: come and guess`;
    return `Your turn to draw in ${game}`;
  }
  return `Your turn in ${game}`;
}
