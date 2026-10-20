import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLiveGame } from '../../games/live/useLiveGame';
import type { LiveGame } from '../../games/live/useLiveGame';
import { QUICK, QuickAct, QuickState, QuickTap, TO_WIN } from '../../games/quickdraw';
import type { Seat } from '../../games/types';
import { sfx, tone } from '../../escape/sfx';
import { LiveFrame } from './LiveFrame';
import { Sprite } from './Pixel';

const LANTERN = ['...hh...', '..hhhh..', '.gGGGGg.', 'gGGwGGGg', 'gGGGGGGg', 'gGGGGGGg', 'gGGGGGGg', '.gGGGGg.', '..hhhh..', '...hh...'];
const LIT = { h: '#8a6a36', g: '#e2a33a', G: '#ffd76a', w: '#fffbe6' };
const DARK = { h: '#5a4632', g: '#3a3340', G: '#4a4252', w: '#5c5468' };

const tapWords = (t: QuickTap | undefined) => (!t ? 'no tap' : 'early' in t ? 'too soon!' : `${t.ms} ms`);

export const QuickDrawGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const game = useLiveGame<QuickState, QuickAct>('quickdraw', QUICK);
  const { state: s, mySeat, them, partner, act, stage, clock } = game;
  const [lit, setLit] = useState(false);
  const litAtLocal = useRef<{ round: number; t: number } | null>(null);
  const tapped = useRef<number>(0);

  // light the lantern on this screen at its moment, and remember exactly when
  useEffect(() => {
    if (!s || s.phase !== 'play' || s.winner) {
      setLit(false);
      return;
    }
    if (litAtLocal.current?.round === s.round) return;
    setLit(false);
    let raf = 0;
    const when = clock(s.litAt);
    const loop = () => {
      if (Date.now() >= when) {
        litAtLocal.current = { round: s.round, t: performance.now() };
        setLit(true);
        tone(880, 0.12, 0, 'triangle', 0.06);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [s, clock]);

  // end-of-round sounds
  const lastRound = useRef(0);
  useEffect(() => {
    if (!s || s.phase !== 'show' || lastRound.current === s.round) return;
    lastRound.current = s.round;
    if (s.last?.winner === mySeat) [660, 990].forEach((f, i) => tone(f, 0.1, i * 0.08, 'triangle', 0.05));
    else if (s.last?.winner) sfx.wrong();
  }, [s, mySeat]);

  const tap = useCallback(() => {
    if (!s || s.phase !== 'play' || s.winner || stage !== 'play' || tapped.current === s.round) return;
    tapped.current = s.round;
    const L = litAtLocal.current;
    if (L && L.round === s.round) act({ ms: Math.round(performance.now() - L.t), round: s.round });
    else act({ early: true, round: s.round });
  }, [s, stage, act]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        tap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tap]);

  const myTap = s?.phase === 'play' ? s.taps[mySeat] : undefined;
  let big = 'Wait for it…';
  if (s?.phase === 'play') {
    if (myTap && 'early' in myTap) big = 'Too soon!';
    else if (myTap) big = `${myTap.ms} ms`;
    else if (lit) big = 'NOW!';
  } else if (s?.phase === 'show' && s.last) {
    const w = s.last.winner;
    big = w === mySeat ? 'You got it!' : w === them ? `${partner} got it` : 'Nobody this time';
  }

  const pips = (seat: Seat) => (
    <span className="flex gap-1.5">
      {[...Array(TO_WIN).keys()].map((i) => (
        <span key={i} style={{ width: 14, height: 14, background: (s?.score[seat] || 0) > i ? '#ffd76a' : 'rgba(239,227,203,.18)', boxShadow: '0 0 0 2px #1b1411' }} />
      ))}
    </span>
  );

  return (
    <LiveFrame
      title="Quick Draw"
      onBack={onBack}
      game={game as unknown as LiveGame<unknown, unknown>}
      howTo={<>When the lantern lights, tap (or press space). Quickest wins the round; tap while it’s dark and you lose it. First to {TO_WIN}.</>}
      playing={
        s?.phase === 'show' && s.last ? (
          <>
            You: <strong>{tapWords(s.last.taps[mySeat])}</strong> · {partner}: <strong>{tapWords(s.last.taps[them])}</strong>
          </>
        ) : (
          <>
            Round {s?.round}. Keep your finger ready, and <strong>wait for the light</strong>.
          </>
        )
      }
      poster={
        <div className="flex justify-center py-6">
          <Sprite rows={LANTERN} pal={DARK} scale={16} />
        </div>
      }
      width={720}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-between w-full max-w-[520px] font-bold">
          <span className="flex items-center gap-2">You {pips(mySeat)}</span>
          <span className="flex items-center gap-2">
            {pips(them)} {partner}
          </span>
        </div>
        <button
          type="button"
          className="border-0 p-6 flex flex-col items-center gap-3 w-full max-w-[520px] select-none"
          style={{ background: lit ? '#3a2f22' : '#1b1518', boxShadow: '0 0 0 4px #0f0b0c', cursor: 'pointer', touchAction: 'manipulation', color: '#efe3cb' }}
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
          aria-label="Tap when the lantern lights"
        >
          <span style={{ filter: lit ? 'drop-shadow(0 0 28px rgba(255,215,106,.85))' : 'none' }}>
            <Sprite rows={LANTERN} pal={lit ? LIT : DARK} scale={16} />
          </span>
          <span className="text-4xl font-bold">{big}</span>
        </button>
      </div>
    </LiveFrame>
  );
};
