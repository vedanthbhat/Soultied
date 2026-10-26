import React, { useState } from 'react';
import { useGames } from '../../games/GamesContext';
import { doodleStale, isLiveInvite, needsMe } from '../../games/registry';
import { liveStale } from '../../games/live/lobby';
import type { DoodleState } from '../../games/doodle';
import type { GameKind, Match, Seat } from '../../games/types';
import { GAMES, otherSeat } from '../../games/types';
import { BoxArt, BoxId } from './BoxArt';
import { GameShell } from './GameFrame';
import { FirefliesGame } from './FirefliesGame';
import { PaperBoatsGame } from './PaperBoatsGame';
import { DoodleGame } from './DoodleGame';
import { NoughtsGame } from './NoughtsGame';
import { FenceGame } from './FenceGame';
import { LanternsGame } from './LanternsGame';
import { TugGame } from './TugGame';
import { QuickDrawGame } from './QuickDrawGame';
import { RpsGame } from './RpsGame';
import { CoastersGame } from './CoastersGame';
import { KitchenGame } from './KitchenGame';
import type { LiveLobby } from '../../games/live/lobby';

interface Shelf {
  id: BoxId;
  name: string;
  tagline: string;
  style: string;
  kind?: GameKind;
  soon?: boolean;
}

const LIVE: Shelf[] = [
  { id: 'tug', ...GAMES.tug },
  { id: 'quickdraw', ...GAMES.quickdraw },
  { id: 'rps', ...GAMES.rps },
  { id: 'doodle', ...GAMES.doodle },
  { id: 'door', name: 'The dark door', tagline: 'Four escape rooms. Each of you gets half the room and half the clues.', style: 'Together, live' },
  { id: 'coasters', ...GAMES.coasters },
  { id: 'kitchen', ...GAMES.kitchen },
];

const TURNS: Shelf[] = [
  { id: 'fireflies', ...GAMES.fireflies },
  { id: 'boats', ...GAMES.boats },
  { id: 'noughts', ...GAMES.noughts },
  { id: 'fence', ...GAMES.fence },
  { id: 'lanterns', ...GAMES.lanterns },
];

const SCREENS: Partial<Record<GameKind, React.FC<{ onBack: () => void }>>> = {
  fireflies: FirefliesGame,
  boats: PaperBoatsGame,
  doodle: DoodleGame,
  noughts: NoughtsGame,
  fence: FenceGame,
  lanterns: LanternsGame,
  tug: TugGame,
  quickdraw: QuickDrawGame,
  rps: RpsGame,
  coasters: CoastersGame,
  kitchen: KitchenGame,
};

const Section: React.FC<{ title: string; note: string; games: Shelf[]; card: (g: Shelf) => React.ReactNode }> = ({ title, note, games, card }) => (
  <section className="flex flex-col gap-3">
    <div>
      <h2 className="text-2xl font-bold m-0">
        {title} <span className="opacity-60 font-normal">· {games.filter((g) => !g.soon).length}</span>
      </h2>
      <p className="m-0 opacity-80 leading-snug">{note}</p>
    </div>
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
      {games.map((g) => card(g))}
    </div>
  </section>
);

/** The games cupboard: every game for two, and whose move it is in each. */
export const GameShelf: React.FC<{ onExit: () => void; onOpenDoor: () => void; initial?: GameKind | null }> = ({ onExit, onOpenDoor, initial = null }) => {
  const { matches, mySeat, seatName, ready } = useGames();
  const [open, setOpen] = useState<GameKind | null>(initial);
  const them: Seat = otherSeat(mySeat);
  const partner = seatName(them);

  const Screen = open ? SCREENS[open] : null;
  if (Screen) return <Screen onBack={() => setOpen(null)} />;

  const line = (kind: GameKind): { text: string; hot: boolean } => {
    const m = matches[kind];
    if (kind === 'doodle') {
      const d = m as Match<DoodleState> | undefined;
      if (!d || d.status === 'over' || doodleStale(d)) return { text: d?.state.best ? `Your best: ${d.state.best} of 6` : 'Start a game', hot: false };
      const phase = d.state.phase;
      if (needsMe(d, mySeat))
        return { text: phase === 'lobby' ? `${partner} is waiting for you` : phase === 'drawing' ? `${partner} is drawing: guess!` : 'Your turn to draw', hot: true };
      return { text: phase === 'lobby' ? `Waiting for ${partner}` : 'Playing now', hot: false };
    }
    if (isLiveInvite(kind)) {
      if (m && !liveStale(m) && m.status === 'setup')
        return needsMe(m, mySeat) ? { text: `${partner} wants to play!`, hot: true } : { text: `Waiting for ${partner} to join`, hot: false };
      if (m && !liveStale(m) && m.status === 'playing') return { text: 'Playing now', hot: false };
      if (!m || m.status !== 'over' || !m.winner) return { text: `Invite ${partner}`, hot: false };
      if (kind === 'kitchen') {
        const r = (m as Match<LiveLobby>).state.result;
        return { text: r?.score ? `Last shift: ${r.score.a} served` : `Invite ${partner}`, hot: false };
      }
      return { text: m.winner === 'draw' ? 'Last game: a draw' : `${seatName(m.winner as Seat)} won last time`, hot: false };
    }
    if (!m) return { text: 'Start a game', hot: false };
    if (needsMe(m, mySeat)) return { text: m.status === 'setup' ? 'Hide your boats' : 'Your move', hot: true };
    if (m.status === 'setup') return { text: `${partner} is hiding boats`, hot: false };
    if (m.status === 'playing') return { text: `${partner}’s move`, hot: false };
    return {
      text: m.winner === 'draw' ? 'Last game: a draw' : `${seatName(m.winner as Seat)} won last time`,
      hot: false,
    };
  };

  const card = (g: Shelf) => {
    const kind = g.kind;
    const st = kind ? line(kind) : null;
    const m = kind ? matches[kind] : undefined;
    const tally = m && (m.wins.a || m.wins.b) ? `${seatName(mySeat)} ${m.wins[mySeat]} · ${partner} ${m.wins[them]}` : null;
    const disabled = g.soon || (!!kind && !ready);
    return (
      <button
        key={g.id}
        className="px-box text-left border-0 p-4 flex flex-col gap-3 items-start"
        style={{ cursor: disabled ? 'default' : 'pointer', opacity: g.soon ? 0.72 : 1 }}
        disabled={disabled}
        onClick={() => (g.id === 'door' ? onOpenDoor() : kind && setOpen(kind))}
      >
        <div className="w-full flex justify-center py-2" style={{ background: '#1d1518' }}>
          <BoxArt id={g.id} scale={4} dim={g.soon} />
        </div>
        <div className="flex items-center gap-2 flex-wrap -mb-1">
          <span className="px-tag">{g.style}</span>
          {g.soon && <span className="px-tag px-tag--night">On the way</span>}
          {st?.hot && <span className="px-tag px-tag--sage">{st.text}</span>}
        </div>
        <div className="text-xl font-bold leading-tight">{g.name}</div>
        <div className="leading-snug text-[var(--muted)] -mt-1">{g.tagline}</div>
        {st && !st.hot && <div className="text-sm font-semibold">{st.text}</div>}
        {tally && <div className="text-sm text-[var(--muted)] -mt-2">{tally}</div>}
      </button>
    );
  };

  return (
    <GameShell>
      <div className="mx-auto max-w-[1100px] px-4 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button className="px-btn px-btn--paper px-btn--small" onClick={onExit}>
            ← Back to the living room
          </button>
        </div>
        <div>
          <h1 className="text-4xl font-bold m-0">Games</h1>
          <p className="m-0 mt-1 max-w-[640px] leading-snug opacity-85">
            Games for the two of you: live ones for when you’re both here, and turn-based ones that wait for whoever’s next, so you can play
            across a whole day.
          </p>
        </div>
        {!ready && (
          <div className="px-box px-4 py-3" style={{ color: 'var(--ink-soft)' }}>
            Games need two. Once {partner} has joined your place, you can play them here.
          </div>
        )}
        <Section title="Play together now" note="For when you’re both here: invite your person and play live." games={LIVE} card={card} />
        <Section title="Take turns" note="Make your move and leave it. They’ll take theirs whenever they’re next here." games={TURNS} card={card} />
      </div>
    </GameShell>
  );
};
