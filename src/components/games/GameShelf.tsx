import React, { useState } from 'react';
import { useGames } from '../../games/GamesContext';
import { needsMe } from '../../games/registry';
import type { GameKind, Seat } from '../../games/types';
import { GAMES, otherSeat } from '../../games/types';
import { BoxArt, BoxId } from './BoxArt';
import { GameShell } from './GameFrame';
import { FirefliesGame } from './FirefliesGame';
import { PaperBoatsGame } from './PaperBoatsGame';

interface Shelf {
  id: BoxId;
  name: string;
  tagline: string;
  style: string;
  kind?: GameKind;
  soon?: boolean;
}

const SHELF: Shelf[] = [
  { id: 'fireflies', ...GAMES.fireflies },
  { id: 'boats', ...GAMES.boats },
  { id: 'door', name: 'The dark door', tagline: 'Four escape rooms. Each of you gets half the room and half the clues.', style: 'Together, live' },
  { id: 'doodle', name: 'Doodle Guess', tagline: 'One draws on a little pixel canvas, the other guesses. Then swap.', style: 'Live', soon: true },
  { id: 'coasters', name: 'Coasters', tagline: 'Air hockey on the coffee table with two drink coasters. First to 7.', style: 'Live', soon: true },
  { id: 'kitchen', name: 'Kitchen Rush', tagline: 'One of you chops, the other cooks, and the orders keep coming.', style: 'Together, live', soon: true },
];

/** The games cupboard: every game for two, and whose move it is in each. */
export const GameShelf: React.FC<{ onExit: () => void; onOpenDoor: () => void; initial?: GameKind | null }> = ({ onExit, onOpenDoor, initial = null }) => {
  const { matches, mySeat, seatName, ready } = useGames();
  const [open, setOpen] = useState<GameKind | null>(initial);
  const them: Seat = otherSeat(mySeat);
  const partner = seatName(them);

  if (open === 'fireflies') return <FirefliesGame onBack={() => setOpen(null)} />;
  if (open === 'boats') return <PaperBoatsGame onBack={() => setOpen(null)} />;

  const line = (kind: GameKind): { text: string; hot: boolean } => {
    const m = matches[kind];
    if (!m) return { text: 'Start a game', hot: false };
    if (needsMe(m, mySeat)) return { text: m.status === 'setup' ? 'Hide your boats' : 'Your move', hot: true };
    if (m.status === 'setup') return { text: `${partner} is hiding boats`, hot: false };
    if (m.status === 'playing') return { text: `${partner}’s move`, hot: false };
    return {
      text: m.winner === 'draw' ? 'Last game: a draw' : `${seatName(m.winner as Seat)} won last time`,
      hot: false,
    };
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
            Games for the two of you. The turn-based ones wait for whoever’s next, so you can play across a whole day. The live ones are for
            when you’re both here.
          </p>
        </div>
        {!ready && (
          <div className="px-box px-4 py-3" style={{ color: 'var(--ink-soft)' }}>
            Games need two. Once {partner} has joined your place, you can play them here.
          </div>
        )}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {SHELF.map((g) => {
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
          })}
        </div>
      </div>
    </GameShell>
  );
};
