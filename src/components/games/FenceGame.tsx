import React, { useEffect, useRef, useState } from 'react';
import { useGames } from '../../games/GamesContext';
import type { Match, Seat } from '../../games/types';
import { otherSeat } from '../../games/types';
import { EDGES, FenceState, H_COUNT, N, emptyFence, fenceCount } from '../../games/fence';
import { fenceMove, newFence } from '../../games/registry';
import { sfx, tone } from '../../escape/sfx';
import { GameFrame } from './GameFrame';

export const FLOWER: Record<Seat, { petal: string; dark: string }> = {
  a: { petal: '#ffc94a', dark: '#b8741f' },
  b: { petal: '#7fe0c0', dark: '#2f8f78' },
};

const CELL = 60;
const PAD = 18;
const SIZE = PAD * 2 + CELL * N;

/** where a piece of fence runs, in the picture's units */
function edgeGeom(e: number) {
  if (e < H_COUNT) {
    const r = Math.floor(e / N);
    const c = e % N;
    return { x1: PAD + c * CELL, y1: PAD + r * CELL, x2: PAD + (c + 1) * CELL, y2: PAD + r * CELL, across: true };
  }
  const k = e - H_COUNT;
  const r = Math.floor(k / (N + 1));
  const c = k % (N + 1);
  return { x1: PAD + c * CELL, y1: PAD + r * CELL, x2: PAD + c * CELL, y2: PAD + (r + 1) * CELL, across: false };
}

export const FlowerIcon: React.FC<{ seat: Seat; size?: number }> = ({ seat, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 8 8" style={{ imageRendering: 'pixelated' }} aria-hidden="true">
    <rect x="3" y="0" width="2" height="2" fill={FLOWER[seat].petal} />
    <rect x="0" y="3" width="2" height="2" fill={FLOWER[seat].petal} />
    <rect x="6" y="3" width="2" height="2" fill={FLOWER[seat].petal} />
    <rect x="3" y="6" width="2" height="2" fill={FLOWER[seat].petal} />
    <rect x="1" y="1" width="2" height="2" fill={FLOWER[seat].dark} />
    <rect x="5" y="1" width="2" height="2" fill={FLOWER[seat].dark} />
    <rect x="1" y="5" width="2" height="2" fill={FLOWER[seat].dark} />
    <rect x="5" y="5" width="2" height="2" fill={FLOWER[seat].dark} />
    <rect x="3" y="3" width="2" height="2" fill="#fff4c2" />
  </svg>
);

export const FenceGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { matches, save, mySeat, seatName } = useGames();
  const m = (matches.fence as Match<FenceState> | undefined) || null;
  const them = otherSeat(mySeat);
  const partner = seatName(them);
  const st = m?.state ?? emptyFence();
  const myTurn = m?.status === 'playing' && m.turn === mySeat;
  const [hover, setHover] = useState<number | null>(null);

  const heard = useRef('');
  useEffect(() => {
    if (!m) return;
    const key = `${m.id}:${m.seq}`;
    if (!heard.current || heard.current === key) {
      heard.current = key;
      return;
    }
    heard.current = key;
    if (m.state.lastBeds.length) [660, 880].forEach((f, i) => tone(f, 0.09, i * 0.08, 'triangle', 0.05));
    else tone(330, 0.05, 0, 'square', 0.03);
    if (m.status === 'over') {
      if (m.winner === mySeat) sfx.win();
      else if (m.winner !== 'draw') sfx.wrong();
    }
  }, [m, mySeat]);

  const start = () => save(newFence(m && m.status === 'over' ? otherSeat(m.startedBy) : mySeat, m?.wins));
  const build = (e: number) => {
    if (!m || !myTurn) return;
    const next = fenceMove(m, mySeat, e);
    if (next) save(next);
    setHover(null);
  };

  const mine = fenceCount(st, mySeat);
  const theirs = fenceCount(st, them);

  let status: React.ReactNode;
  if (!m) status = <>Take turns adding one bit of fence. Close a bed’s fourth side and it’s yours, and you go again. Most beds wins.</>;
  else if (m.status === 'over')
    status =
      m.winner === mySeat ? (
        <>
          <strong>
            You won, {mine} beds to {theirs}!
          </strong>
        </>
      ) : m.winner === 'draw' ? (
        <>A draw!</>
      ) : (
        <>
          <strong>{partner} won</strong>, {theirs} beds to {mine}.
        </>
      );
  else if (myTurn)
    status = (
      <>
        {m.seq > 0 && m.updatedBy === them ? `${partner} ${m.last}. ` : m.seq > 0 && m.updatedBy === mySeat ? 'You closed a bed: go again! ' : ''}
        <strong>Your move.</strong> Tap a gap between two posts.
      </>
    );
  else
    status =
      m.updatedBy === mySeat && m.seq > 0 ? (
        <>
          You {m.last}. Now it’s <strong>{partner}’s move</strong>.
        </>
      ) : (
        <>
          Waiting for <strong>{partner}</strong>.
        </>
      );

  return (
    <GameFrame
      title="Fence the Garden"
      onBack={onBack}
      match={m}
      marker={(s) => <FlowerIcon seat={s} size={26} />}
      status={status}
      width={720}
      actions={
        !m || m.status === 'over' ? (
          <button className="px-btn px-btn--sage" onClick={start}>
            {m ? 'Play again' : 'Start a game'}
          </button>
        ) : null
      }
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-4 text-lg font-bold">
          <span className="flex items-center gap-2">
            <FlowerIcon seat={mySeat} /> You {mine}
          </span>
          <span className="opacity-50">·</span>
          <span className="flex items-center gap-2">
            <FlowerIcon seat={them} /> {partner} {theirs}
          </span>
        </div>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          style={{ width: 'min(100%, 520px)', height: 'auto', background: '#3f6337', boxShadow: '0 0 0 4px #2b4426', touchAction: 'manipulation' }}
          role="group"
          aria-label="The garden"
          onMouseLeave={() => setHover(null)}
        >
          {/* the beds */}
          {[...st.beds].map((b, i) => {
            const r = Math.floor(i / N);
            const c = i % N;
            const x = PAD + c * CELL;
            const y = PAD + r * CELL;
            const fresh = st.lastBeds.includes(i);
            return (
              <g key={i}>
                <rect x={x + 4} y={y + 4} width={CELL - 8} height={CELL - 8} fill={b === '.' ? '#4f7a43' : '#5b3d2a'} />
                {b === '.' && <rect x={x + 14 + ((i * 7) % 20)} y={y + 16 + ((i * 11) % 18)} width={4} height={4} fill="#5f8c50" />}
                {b !== '.' && (
                  <g className={fresh ? 'game-blink' : ''}>
                    {[
                      [3, 0],
                      [0, 3],
                      [6, 3],
                      [3, 6],
                    ].map(([px, py], k) => (
                      <rect key={k} x={x + 14 + px * 4} y={y + 14 + py * 4} width={8} height={8} fill={FLOWER[b as Seat].petal} />
                    ))}
                    {[
                      [1, 1],
                      [5, 1],
                      [1, 5],
                      [5, 5],
                    ].map(([px, py], k) => (
                      <rect key={k} x={x + 14 + px * 4} y={y + 14 + py * 4} width={8} height={8} fill={FLOWER[b as Seat].dark} />
                    ))}
                    <rect x={x + 26} y={y + 26} width={8} height={8} fill="#fff4c2" />
                  </g>
                )}
              </g>
            );
          })}
          {/* the fences, built and not */}
          {[...Array(EDGES).keys()].map((e) => {
            const g = edgeGeom(e);
            const built = st.fences[e] !== '.';
            const can = myTurn && !built;
            const last = st.lastEdge === e;
            const show = built || (can && hover === e);
            const x = Math.min(g.x1, g.x2);
            const y = Math.min(g.y1, g.y2);
            const w = g.across ? CELL : 8;
            const h = g.across ? 8 : CELL;
            return (
              <g key={e}>
                {show && <rect x={g.across ? x : x - 4} y={g.across ? y - 4 : y} width={w} height={h} fill={built ? (last ? '#f1d27a' : '#c89a5c') : 'rgba(241,210,122,.55)'} />}
                {show && built && (
                  <rect x={g.across ? x : x - 4} y={g.across ? y - 4 : y} width={g.across ? CELL : 2} height={g.across ? 2 : CELL} fill={last ? '#fff4c2' : '#e2bf84'} />
                )}
                {!built && !show && (
                  <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="rgba(239,227,203,.18)" strokeWidth={2} strokeDasharray="4 6" />
                )}
                {can && (
                  <rect
                    x={g.across ? x + 8 : x - 12}
                    y={g.across ? y - 12 : y + 8}
                    width={g.across ? CELL - 16 : 24}
                    height={g.across ? 24 : CELL - 16}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Fence ${e + 1}`}
                    onMouseEnter={() => setHover(e)}
                    onFocus={() => setHover(e)}
                    onClick={() => build(e)}
                    onKeyDown={(ev) => (ev.key === 'Enter' || ev.key === ' ') && build(e)}
                  />
                )}
              </g>
            );
          })}
          {/* the posts */}
          {[...Array((N + 1) * (N + 1)).keys()].map((i) => {
            const r = Math.floor(i / (N + 1));
            const c = i % (N + 1);
            return <rect key={i} x={PAD + c * CELL - 6} y={PAD + r * CELL - 6} width={12} height={12} fill="#7a5232" stroke="#3b2a1e" strokeWidth={2} />;
          })}
        </svg>
      </div>
    </GameFrame>
  );
};
