import React, { useEffect, useRef, useState } from 'react';
import { useGames } from '../../games/GamesContext';
import type { Match, Seat } from '../../games/types';
import { otherSeat } from '../../games/types';
import { LanternsState, SIZE, emptyLanterns, flipsFor, lanternCount, legalCells } from '../../games/lanterns';
import { lanternMove, newLanterns } from '../../games/registry';
import { sfx, tone } from '../../escape/sfx';
import { GameFrame } from './GameFrame';
import { Sprite } from './Pixel';

const LANTERN = ['..ttt..', '.tLLLt.', 'tLwLLLt', 'tLLLLLt', 'tLLLLLt', '.tLLLt.', '..ttt..'];
export const LANTERN_COL: Record<Seat, { L: string; w: string; t: string; glow: string }> = {
  a: { L: '#ffc94a', w: '#fff4c2', t: '#b8741f', glow: 'rgba(255,190,80,.7)' },
  b: { L: '#7fe0c0', w: '#eafff6', t: '#2f8f78', glow: 'rgba(120,230,195,.65)' },
};

export const Lantern: React.FC<{ seat: Seat; size: number; faint?: boolean; flip?: boolean }> = ({ seat, size, faint, flip }) => {
  const c = LANTERN_COL[seat];
  return (
    <span className={flip ? 'ln-flip' : ''} style={{ display: 'inline-flex' }}>
      <Sprite
        rows={LANTERN}
        pal={{ L: c.L, w: c.w, t: c.t }}
        scale={size / 7}
        style={{ filter: faint ? 'none' : `drop-shadow(0 0 ${Math.round(size / 5)}px ${c.glow})`, opacity: faint ? 0.35 : 1 }}
        label={seat === 'a' ? 'amber lantern' : 'mint lantern'}
      />
    </span>
  );
};

export const LanternsGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { matches, save, mySeat, seatName } = useGames();
  const m = (matches.lanterns as Match<LanternsState> | undefined) || null;
  const them = otherSeat(mySeat);
  const partner = seatName(them);
  const st = m?.state ?? emptyLanterns(mySeat);
  const myTurn = m?.status === 'playing' && m.turn === mySeat;
  const legal = new Set(myTurn ? legalCells(st.board, mySeat) : []);
  const [hover, setHover] = useState<number | null>(null);
  const preview = new Set(hover !== null && legal.has(hover) ? flipsFor(st.board, mySeat, hover) : []);

  const heard = useRef('');
  useEffect(() => {
    if (!m) return;
    const key = `${m.id}:${m.seq}`;
    if (!heard.current || heard.current === key) {
      heard.current = key;
      return;
    }
    heard.current = key;
    m.state.flipped.slice(0, 6).forEach((_, i) => tone(500 + i * 70, 0.06, i * 0.05, 'triangle', 0.04));
    if (m.status === 'over') {
      if (m.winner === mySeat) sfx.win();
      else if (m.winner !== 'draw') sfx.wrong();
    }
  }, [m, mySeat]);

  const start = () => save(newLanterns(m && m.status === 'over' ? otherSeat(m.startedBy) : mySeat, m?.wins));
  const light = (cell: number) => {
    if (!m || !myTurn || !legal.has(cell)) return;
    const next = lanternMove(m, mySeat, cell);
    if (next) save(next);
    setHover(null);
  };

  const mine = lanternCount(st.board, mySeat);
  const theirs = lanternCount(st.board, them);
  const flipped = new Set(st.flipped);

  let status: React.ReactNode;
  if (!m) status = <>Light a lantern so a line of theirs is caught between two of yours, and the whole line turns your colour. You can only light where you’d catch something.</>;
  else if (m.status === 'over')
    status =
      m.winner === mySeat ? (
        <>
          <strong>
            You won, {mine} lanterns to {theirs}!
          </strong>
        </>
      ) : m.winner === 'draw' ? (
        <>An even pond: a draw.</>
      ) : (
        <>
          <strong>{partner} won</strong>, {theirs} lanterns to {mine}.
        </>
      );
  else if (myTurn)
    status = (
      <>
        {st.passed === them ? `${partner} had nowhere to light, so you go again. ` : m.seq > 0 && m.updatedBy === them ? `${partner} ${m.last}. ` : ''}
        <strong>Your move.</strong> The little dots show where you can light one.
      </>
    );
  else
    status =
      st.passed === mySeat ? (
        <>
          You had nowhere to light, so it’s <strong>{partner}’s move</strong> again.
        </>
      ) : m.updatedBy === mySeat && m.seq > 0 ? (
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
      title="Lanterns"
      onBack={onBack}
      match={m}
      marker={(s) => <Lantern seat={s} size={24} />}
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
        @keyframes ln-flip { 0% { transform: scaleX(1); } 50% { transform: scaleX(0.1); } 100% { transform: scaleX(1); } }
        .ln-flip { animation: ln-flip .45s steps(6) both; }
        @media (prefers-reduced-motion: reduce) { .ln-flip { animation: none; } }
      `}</style>
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-4 text-lg font-bold">
          <span className="flex items-center gap-2">
            <Lantern seat={mySeat} size={20} /> You {mine}
          </span>
          <span className="opacity-50">·</span>
          <span className="flex items-center gap-2">
            <Lantern seat={them} size={20} /> {partner} {theirs}
          </span>
        </div>
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${SIZE}, var(--lc))`,
            gap: 3,
            padding: 8,
            background: '#16303d',
            boxShadow: '0 0 0 4px #0c1c25, inset 0 0 0 2px #24485a',
            ['--lc' as string]: 'clamp(34px, 10.5vw, 56px)',
          }}
          onMouseLeave={() => setHover(null)}
        >
          {[...st.board].map((c, i) => {
            const can = legal.has(i);
            const last = st.lastCell === i;
            return (
              <button
                key={i}
                type="button"
                className="flex items-center justify-center border-0 p-0"
                style={{
                  width: 'var(--lc)',
                  height: 'var(--lc)',
                  background: (Math.floor(i / SIZE) + i) % 2 ? '#1d3b4a' : '#1a3542',
                  boxShadow: last ? 'inset 0 0 0 2px #f1d27a' : undefined,
                  cursor: can ? 'pointer' : 'default',
                }}
                disabled={!can}
                aria-label={`${'ABCDEFGH'[i % SIZE]}${Math.floor(i / SIZE) + 1}${c === '.' ? (can ? ', you can light here' : '') : `, ${seatName(c as Seat)}’s lantern`}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => light(i)}
              >
                {c !== '.' ? (
                  <span key={`${i}:${c}`} style={{ display: 'inline-flex' }}>
                    <Lantern seat={preview.has(i) ? mySeat : (c as Seat)} size={36} flip={flipped.has(i) || last} faint={preview.has(i)} />
                  </span>
                ) : can ? (
                  hover === i ? (
                    <Lantern seat={mySeat} size={36} faint />
                  ) : (
                    <span style={{ width: 8, height: 8, background: 'rgba(241,210,122,.55)' }} />
                  )
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </GameFrame>
  );
};
