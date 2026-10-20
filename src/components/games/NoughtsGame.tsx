import React, { useEffect, useRef } from 'react';
import { useGames } from '../../games/GamesContext';
import type { Match, Seat } from '../../games/types';
import { otherSeat } from '../../games/types';
import { MAX_ROUNDS, NoughtsState, ROUNDS_TO_WIN, emptyNoughts, threeInRow } from '../../games/noughts';
import { newNoughts, noughtsMove } from '../../games/registry';
import { sfx, tone } from '../../escape/sfx';
import { GameFrame } from './GameFrame';
import { Sprite } from './Pixel';

const HEART = ['.hh...hh.', 'hHHh.hHHh', 'hHwHhHHHh', 'hHHHHHHHh', '.hHHHHHh.', '..hHHHh..', '...hHh...', '....h....'];
const RING = ['...ooo...', '.oOOOOOo.', '.oOo.oOo.', 'oOo...oOo', 'oO.....Oo', 'oOo...oOo', '.oOo.oOo.', '.oOOOOOo.', '...ooo...'];

/** 'a' draws hearts, 'b' draws rings. */
export const Mark: React.FC<{ seat: Seat; size: number; faint?: boolean }> = ({ seat, size, faint }) =>
  seat === 'a' ? (
    <Sprite rows={HEART} pal={{ h: '#8f3b2a', H: '#e07a5f', w: '#f6c3a8' }} scale={size / 9} style={{ opacity: faint ? 0.4 : 1 }} label="heart" />
  ) : (
    <Sprite rows={RING} pal={{ o: '#2f8f78', O: '#7fe0c0' }} scale={size / 9} style={{ opacity: faint ? 0.4 : 1 }} label="ring" />
  );

export const NoughtsGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { matches, save, mySeat, seatName } = useGames();
  const m = (matches.noughts as Match<NoughtsState> | undefined) || null;
  const them = otherSeat(mySeat);
  const partner = seatName(them);
  const st = m?.state ?? emptyNoughts(mySeat);
  const myTurn = m?.status === 'playing' && m.turn === mySeat;

  // a little sound for each mark, and a tune at the end
  const heard = useRef('');
  useEffect(() => {
    if (!m) return;
    const key = `${m.id}:${m.seq}`;
    if (!heard.current || heard.current === key) {
      heard.current = key;
      return;
    }
    heard.current = key;
    tone(m.updatedBy === mySeat ? 620 : 520, 0.07, 0, 'triangle', 0.05);
    if (m.status === 'over') {
      if (m.winner === mySeat) sfx.win();
      else if (m.winner !== 'draw') sfx.wrong();
    }
  }, [m, mySeat]);

  const start = () => save(newNoughts(m && m.status === 'over' ? otherSeat(m.startedBy) : mySeat, m?.wins));
  const place = (cell: number) => {
    if (!m || !myTurn) return;
    const next = noughtsMove(m, mySeat, cell);
    if (next) save(next);
  };

  // straight after a round ends, show how it finished until the next round's first mark
  const showingLast = !!m && !!st.lastBoard && st.board === '.........';
  const board = st.board;
  const line = new Set(showingLast ? [] : st.line || (m?.status === 'over' ? threeInRow(board)?.cells : null) || []);
  const lastLine = new Set(showingLast ? st.line || [] : []);

  let status: React.ReactNode;
  if (!m) status = <>Best of five rounds of three in a row. You’re hearts, {partner} is rings. Start, and they can answer whenever they’re next here.</>;
  else if (m.status === 'over')
    status =
      m.winner === 'draw' ? (
        <>All square after five rounds: a draw.</>
      ) : m.winner === mySeat ? (
        <>
          <strong>You won the series {st.score[mySeat]}–{st.score[them]}!</strong>
        </>
      ) : (
        <>
          <strong>{partner} won the series</strong> {st.score[them]}–{st.score[mySeat]}.
        </>
      );
  else if (myTurn)
    status = (
      <>
        {m.seq > 0 && m.updatedBy === them ? `${partner} ${m.last}. ` : ''}
        <strong>Your move.</strong> {showingLast ? `Round ${st.round} starts with you.` : 'Tap a square.'}
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
          Waiting for <strong>{partner}</strong> to make their move.
        </>
      );

  return (
    <GameFrame
      title="Noughts & Hearts"
      onBack={onBack}
      match={m}
      marker={(s) => <Mark seat={s} size={26} />}
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
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-3 flex-wrap justify-center" aria-label="Rounds">
          {[...Array(MAX_ROUNDS).keys()].map((i) => {
            const h = st.history[i];
            const current = m && m.status !== 'over' && i === st.history.length;
            return (
              <span
                key={i}
                className="px-box flex items-center justify-center"
                style={{ width: 44, height: 44, color: 'var(--ink-soft)', outline: current ? '3px dashed rgba(241,210,122,.9)' : undefined, outlineOffset: 3 }}
                title={h ? (h === 'draw' ? `Round ${i + 1}: a draw` : `Round ${i + 1}: ${seatName(h)}`) : `Round ${i + 1}`}
              >
                {h === 'a' || h === 'b' ? <Mark seat={h} size={22} /> : h === 'draw' ? <span className="font-bold">=</span> : <span className="opacity-40">{i + 1}</span>}
              </span>
            );
          })}
        </div>
        <div className="text-sm opacity-80">First to {ROUNDS_TO_WIN} rounds</div>
        <div className="flex items-center gap-5 flex-wrap justify-center">
          <div
            className="grid"
            style={{
              gridTemplateColumns: 'repeat(3, var(--nh))',
              gap: 8,
              padding: 10,
              background: '#6b4a2f',
              boxShadow: '0 0 0 4px #3b2a1e, inset 0 4px 0 #8a6342',
              ['--nh' as string]: 'clamp(84px, 24vw, 132px)',
            }}
          >
            {[...board].map((c, i) => {
              const empty = c === '.';
              const can = myTurn && empty;
              return (
                <button
                  key={i}
                  type="button"
                  className="flex items-center justify-center border-0 p-0"
                  style={{
                    width: 'var(--nh)',
                    height: 'var(--nh)',
                    background: can ? '#f4ead6' : '#efe3cb',
                    boxShadow: line.has(i) ? 'inset 0 0 0 4px #e2b359' : 'inset 0 -4px 0 rgba(0,0,0,.12)',
                    cursor: can ? 'pointer' : 'default',
                  }}
                  disabled={!can}
                  aria-label={empty ? `Square ${i + 1}, empty` : `Square ${i + 1}, ${seatName(c as Seat)}’s`}
                  onClick={() => place(i)}
                >
                  {!empty && (
                    <span className={line.has(i) ? 'game-blink' : ''}>
                      <Mark seat={c as Seat} size={72} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {showingLast && (
            <div className="flex flex-col items-center gap-2">
              <div className="text-sm opacity-85">How round {st.round - 1} ended</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 34px)', gap: 3, padding: 4, background: '#6b4a2f', opacity: 0.9 }}>
                {[...(st.lastBoard as string)].map((c, i) => (
                  <span
                    key={i}
                    className="flex items-center justify-center"
                    style={{ width: 34, height: 34, background: '#d9c6a1', boxShadow: lastLine.has(i) ? 'inset 0 0 0 3px #e2b359' : undefined }}
                  >
                    {c !== '.' && <Mark seat={c as Seat} size={22} />}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
        {m && m.status !== 'over' && (
          <div className="text-sm opacity-85">
            Round {st.round} · {seatName(st.opener)} went first · {seatName(mySeat)} {st.score[mySeat]} – {st.score[them]} {partner}
          </div>
        )}
      </div>
    </GameFrame>
  );
};
