import React from 'react';
import { AvatarThumb } from '../PixelAvatarRenderer';
import type { Match, Seat } from '../../games/types';
import { useGames } from '../../games/GamesContext';

export const GAME_BG = 'radial-gradient(ellipse at top, #3a2b25 0%, #1b1411 72%)';

/** The dark, warm backdrop every game screen sits on. */
export const GameShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="fixed inset-0 z-30 overflow-y-auto px-ui" style={{ background: GAME_BG, color: '#efe3cb' }}>
    <style>{`
      @keyframes game-blink { 0%, 100% { opacity: 1; } 50% { opacity: .35; } }
      .game-blink { animation: game-blink 0.9s steps(2) infinite; }
      @keyframes game-glow { 0%, 100% { outline-color: rgba(241,210,122,.15); } 50% { outline-color: rgba(241,210,122,.9); } }
      .game-turn { outline: 3px dashed rgba(241,210,122,.9); outline-offset: 5px; animation: game-glow 1.4s steps(4) infinite; }
      @media (prefers-reduced-motion: reduce) { .game-blink, .game-turn { animation: none; } }
    `}</style>
    {children}
  </div>
);

/** For games played on the same side: who's doing what, instead of wins and turns. */
export interface CoopChips {
  active: Seat | null;
  note: (s: Seat) => string;
}

const PlayerChip: React.FC<{ seat: Seat; match: Match | null; marker?: (s: Seat) => React.ReactNode; coop?: CoopChips }> = ({ seat, match, marker, coop }) => {
  const { seatUser, seatName, mySeat } = useGames();
  const user = seatUser(seat);
  const turn = coop ? coop.active === seat : match?.status === 'playing' && match.turn === seat;
  const won = !coop && match?.status === 'over' && match.winner === seat;
  return (
    <div
      className={`px-box flex items-center gap-3 px-3 py-2 min-w-0 ${turn ? 'game-turn' : ''}`}
      style={{ color: 'var(--ink-soft)', outline: won ? '3px solid #e2b359' : undefined, outlineOffset: won ? 5 : undefined }}
    >
      <span className="-my-1 shrink-0">{user ? <AvatarThumb config={user.avatar} region="head" size={40} /> : <span className="inline-block w-10 h-10" />}</span>
      <span className="flex flex-col min-w-0">
        <span className="font-bold leading-tight truncate">
          {seatName(seat)}
          {seat === mySeat && <span className="font-normal text-[var(--muted)]"> (you)</span>}
        </span>
        <span className="text-sm text-[var(--muted)] leading-tight">
          {coop ? (
            coop.note(seat) || '\u00a0'
          ) : (
            <>
              {match?.wins?.[seat] ?? 0} {(match?.wins?.[seat] ?? 0) === 1 ? 'win' : 'wins'}
              {turn ? (seat === mySeat ? ' · your move' : ' · their move') : won ? ' · won this one' : ''}
            </>
          )}
        </span>
      </span>
      {marker && <span className="ml-auto shrink-0">{marker(seat)}</span>}
    </div>
  );
};

export const GameFrame: React.FC<{
  title: string;
  onBack: () => void;
  match: Match | null;
  marker?: (s: Seat) => React.ReactNode;
  status: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  width?: number;
  coop?: CoopChips;
}> = ({ title, onBack, match, marker, status, children, actions, width = 980, coop }) => {
  const { mySeat } = useGames();
  const them: Seat = mySeat === 'a' ? 'b' : 'a';
  return (
    <GameShell>
      <div className="mx-auto px-4 py-5 flex flex-col gap-4" style={{ maxWidth: width }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button className="px-btn px-btn--paper px-btn--small" onClick={onBack}>
            ← All games
          </button>
          <h1 className="text-3xl font-bold m-0">{title}</h1>
        </div>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <PlayerChip seat={mySeat} match={match} marker={marker} coop={coop} />
          <PlayerChip seat={them} match={match} marker={marker} coop={coop} />
        </div>
        <div className="px-box px-4 py-2.5 leading-snug" style={{ color: 'var(--ink-soft)' }} role="status" aria-live="polite">
          {status}
        </div>
        {children}
        {actions && <div className="flex gap-3 flex-wrap justify-center">{actions}</div>}
      </div>
    </GameShell>
  );
};
