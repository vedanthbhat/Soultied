import React, { useEffect, useRef, useState } from 'react';
import { useGames } from '../../games/GamesContext';
import type { Match, Seat } from '../../games/types';
import { otherSeat } from '../../games/types';
import { COLS, ROWS, FirefliesState, cell, emptyFireflies, landingRow } from '../../games/fireflies';
import { fireflyMove, newFireflies } from '../../games/registry';
import { sfx, tone } from '../../escape/sfx';
import { GameFrame } from './GameFrame';
import { Sprite } from './Pixel';

const FIREFLY = ['..hhh..', '.hbbbh.', 'hbbwbbh', 'hbwwwbh', 'hbbwbbh', '.hbbbh.', '..hhh..'];
const COLORS: Record<Seat, { b: string; w: string; h: string; glow: string; name: string }> = {
  a: { b: '#ffc94a', w: '#fff4c2', h: '#b8741f', glow: 'rgba(255,190,80,.75)', name: 'amber' },
  b: { b: '#7fe0c0', w: '#eafff6', h: '#2f8f78', glow: 'rgba(120,230,195,.7)', name: 'mint' },
};

/** A glowing firefly. `fluid` makes it fill its box instead of a fixed size. */
export const Firefly: React.FC<{ seat: Seat; size: number; faint?: boolean; fluid?: boolean }> = ({ seat, size, faint, fluid }) => {
  const c = COLORS[seat];
  return (
    <Sprite
      rows={FIREFLY}
      pal={{ b: c.b, w: c.w, h: c.h }}
      scale={size / 7}
      style={{
        filter: faint ? 'none' : `drop-shadow(0 0 ${Math.round(size / 5)}px ${c.glow})`,
        opacity: faint ? 0.45 : 1,
        ...(fluid ? { width: '86%', height: 'auto' } : {}),
      }}
      label={`${c.name} firefly`}
    />
  );
};

export const FirefliesGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { matches, save, mySeat, seatName } = useGames();
  const m = (matches.fireflies as Match<FirefliesState> | undefined) || null;
  const them = otherSeat(mySeat);
  const partner = seatName(them);
  const board = m?.state.board ?? emptyFireflies().board;
  const myTurn = m?.status === 'playing' && m.turn === mySeat;
  const [hoverCol, setHoverCol] = useState<number | null>(null);

  // a little chime when a firefly lands, and a tune at the end
  const heard = useRef('');
  useEffect(() => {
    if (!m) return;
    const key = `${m.id}:${m.seq}`;
    if (!heard.current) {
      heard.current = key;
      return;
    }
    if (heard.current === key) return;
    heard.current = key;
    if (m.state.lastCell !== null) tone(520 + (5 - Math.floor(m.state.lastCell / COLS)) * 60, 0.08, 0, 'triangle', 0.05);
    if (m.status === 'over') {
      if (m.winner === mySeat) sfx.win();
      else if (m.winner !== 'draw') sfx.wrong();
    }
  }, [m, mySeat]);

  const start = () => save(newFireflies(mySeat, m?.wins));
  const dropIn = (col: number) => {
    if (!m || !myTurn) return;
    const next = fireflyMove(m, mySeat, col);
    if (next) save(next);
    // on a touch screen there's no "mouse left the jar", so clear the preview here
    setHoverCol(null);
  };

  let status: React.ReactNode;
  if (!m) status = <>Start a game and drop the first firefly. {partner} can take their turn whenever they’re next here.</>;
  else if (m.status === 'over')
    status =
      m.winner === 'draw' ? (
        <>The jar is full and nobody got four. It’s a draw.</>
      ) : m.winner === mySeat ? (
        <>
          <strong>You lined up four. You win!</strong> {partner} will see it next time they look.
        </>
      ) : (
        <>
          <strong>{partner} lined up four</strong> and wins this one.
        </>
      );
  else if (myTurn)
    status =
      m.seq === 0 ? (
        <>Your move. Tap a column to drop a firefly.</>
      ) : (
        <>
          {partner} {m.last}. <strong>Your move.</strong>
        </>
      );
  else
    status =
      m.updatedBy === mySeat && m.seq > 0 ? (
        <>
          You {m.last}. Now it’s <strong>{partner}’s move</strong>. They’ll see it next time they open Soultied.
        </>
      ) : (
        <>
          Waiting for <strong>{partner}</strong> to drop a firefly.
        </>
      );

  const line = new Set(m?.state.line || []);
  const previewRow = hoverCol !== null && myTurn ? landingRow(board, hoverCol) : -1;

  return (
    <GameFrame
      title="Fireflies"
      onBack={onBack}
      match={m}
      marker={(s) => <Firefly seat={s} size={26} />}
      status={status}
      width={760}
      actions={
        !m || m.status === 'over' ? (
          <button className="px-btn px-btn--sage" onClick={start}>
            {m ? 'Play again' : 'Start a game'}
          </button>
        ) : null
      }
    >
      <style>{`
        .ff-jar { --c: clamp(36px, 11.5vw, 64px); }
        @keyframes ff-fall { from { transform: translateY(calc(var(--fall) * var(--c) * -1)); } to { transform: translateY(0); } }
        .ff-drop { animation: ff-fall calc(0.07s * var(--fall) + 0.08s) steps(8) both; }
        @media (prefers-reduced-motion: reduce) { .ff-drop { animation: none; } }
      `}</style>
      <div className="ff-jar mx-auto flex flex-col items-center" style={{ width: 'max-content', maxWidth: '100%' }}>
        {/* where your next firefly will go */}
        <div className="flex" style={{ height: 'var(--c)' }} aria-hidden="true">
          {[...Array(COLS).keys()].map((c) => (
            <div key={c} className="flex items-center justify-center" style={{ width: 'var(--c)' }}>
              {myTurn && hoverCol === c && previewRow >= 0 && <Firefly seat={mySeat} size={28} />}
            </div>
          ))}
        </div>
        {/* the lid */}
        <div style={{ height: 8, width: 'calc(var(--c) * 7 + 8px)', background: '#b48c4a', boxShadow: 'inset 0 3px 0 #d6ad63, inset 0 -2px 0 #8a6a36' }} />
        <div
          className="flex"
          style={{
            padding: 4,
            background: '#1f2748',
            boxShadow: '0 0 0 4px #9fc3d6, inset 6px 0 0 rgba(200,224,234,.12)',
          }}
          onMouseLeave={() => setHoverCol(null)}
        >
          {[...Array(COLS).keys()].map((c) => {
            const full = landingRow(board, c) < 0;
            return (
              <button
                key={c}
                type="button"
                className="flex flex-col border-0 p-0 bg-transparent"
                style={{ cursor: myTurn && !full ? 'pointer' : 'default', background: hoverCol === c && myTurn && !full ? 'rgba(255,244,194,.07)' : 'transparent' }}
                disabled={!myTurn || full}
                aria-label={`Drop a firefly in column ${c + 1}${full ? ' (full)' : ''}`}
                onMouseEnter={() => setHoverCol(c)}
                onFocus={() => setHoverCol(c)}
                onClick={() => dropIn(c)}
              >
                {[...Array(ROWS).keys()].map((r) => {
                  const i = cell(r, c);
                  const s = board[i];
                  const isLast = m?.state.lastCell === i;
                  return (
                    <span key={r} className="flex items-center justify-center" style={{ width: 'var(--c)', height: 'var(--c)' }}>
                      <span
                        className="flex items-center justify-center"
                        style={{
                          width: '74%',
                          height: '74%',
                          background: '#141a31',
                          boxShadow: line.has(i) ? '0 0 0 3px #fff4c2' : 'inset 0 3px 0 rgba(0,0,0,.35)',
                          borderRadius: 2,
                        }}
                      >
                        {s !== '.' ? (
                          <span
                            key={isLast ? `${m?.id}:${m?.seq}` : 'still'}
                            className={`flex items-center justify-center w-full h-full ${isLast ? 'ff-drop' : ''} ${line.has(i) ? 'game-blink' : ''}`}
                            style={{ ['--fall' as string]: r + 1 } as React.CSSProperties}
                          >
                            <Firefly seat={s as Seat} size={30} fluid />
                          </span>
                        ) : r === previewRow && hoverCol === c ? (
                          <Firefly seat={mySeat} size={30} faint fluid />
                        ) : null}
                      </span>
                    </span>
                  );
                })}
              </button>
            );
          })}
        </div>
      </div>
    </GameFrame>
  );
};
