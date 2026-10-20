import React, { useEffect, useRef } from 'react';
import { useLiveGame } from '../../games/live/useLiveGame';
import type { LiveGame } from '../../games/live/useLiveGame';
import { HANDS, Hand, PICK_MS, RPS, RpsAct, RpsState, TO_WIN } from '../../games/rps';
import type { Seat } from '../../games/types';
import { sfx, tone } from '../../escape/sfx';
import { LiveFrame, useNow } from './LiveFrame';
import { Sprite } from './Pixel';

const ART: Record<Hand, { rows: string[]; pal: Record<string, string> }> = {
  stone: {
    rows: ['...gggg...', '..gGGGGg..', '.gGGwGGGg.', 'gGGGGGGGGg', 'gGGGGGGdGg', 'gGGdGGGGGg', 'gGGGGGGGGg', '.gGGGGGGg.', '..gggggg..', '..........'],
    pal: { g: '#5c5560', G: '#9a929e', w: '#d6cfd8', d: '#6e6672' },
  },
  paper: {
    rows: ['.pppppp...', '.pPPPPpp..', '.pPllPPpp.', '.pPPPPPPp.', '.pPllllPp.', '.pPPPPPPp.', '.pPllllPp.', '.pPPPPPPp.', '.pppppppp.', '..........'],
    pal: { p: '#a8987a', P: '#f4ead6', l: '#c9b896' },
  },
  scissors: {
    rows: ['.s......s.', '.ss....ss.', '..ss..ss..', '...ssss...', '....hh....', '...hhhh...', '..hH..Hh..', '.hH....Hh.', '.hH....Hh.', '..hh..hh..'],
    pal: { s: '#c8d3d8', h: '#8f3b2a', H: '#e07a5f' },
  },
};

const NAME: Record<Hand, string> = { stone: 'Stone', paper: 'Paper', scissors: 'Scissors' };

export const HandArt: React.FC<{ hand: Hand; size: number; flip?: boolean }> = ({ hand, size, flip }) => (
  <span style={{ display: 'inline-flex', transform: flip ? 'scaleX(-1)' : undefined }}>
    <Sprite rows={ART[hand].rows} pal={ART[hand].pal} scale={size / 10} label={NAME[hand]} />
  </span>
);

export const RpsGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const game = useLiveGame<RpsState, RpsAct>('rps', RPS);
  const { state: s, mySeat, them, partner, act, stage, clock } = game;
  const now = useNow(stage === 'play', 100);
  const picking = stage === 'play' && s?.phase === 'pick' && !s.winner;
  const myPick = s?.picks[mySeat];
  const theyPicked = !!s?.picks[them];
  const left = s ? Math.max(0, clock(s.pickUntil) - now) : 0;

  const lastRound = useRef(0);
  useEffect(() => {
    if (!s || s.phase !== 'show' || lastRound.current === s.round) return;
    lastRound.current = s.round;
    if (s.last?.winner === mySeat) [660, 990].forEach((f, i) => tone(f, 0.1, i * 0.08, 'triangle', 0.05));
    else if (s.last?.winner) sfx.wrong();
    else tone(440, 0.1, 0, 'triangle', 0.04);
  }, [s, mySeat]);

  const pick = (h: Hand) => {
    if (!picking || myPick || !s) return;
    act({ round: s.round, hand: h });
    tone(520, 0.05, 0, 'square', 0.03);
  };

  const pips = (seat: Seat) => (
    <span className="flex gap-1.5">
      {[...Array(TO_WIN).keys()].map((i) => (
        <span key={i} style={{ width: 14, height: 14, background: (s?.score[seat] || 0) > i ? '#ffd76a' : 'rgba(239,227,203,.18)', boxShadow: '0 0 0 2px #1b1411' }} />
      ))}
    </span>
  );

  const shown = s?.phase === 'show' ? s.last : null;
  let line: React.ReactNode = null;
  if (shown) {
    const mine = shown.hands[mySeat];
    const theirs = shown.hands[them];
    if (!mine && !theirs) line = <>Neither of you picked in time. Again!</>;
    else if (!mine) line = <>You didn’t pick in time, so {partner} takes it.</>;
    else if (!theirs) line = <>{partner} didn’t pick in time, so you take it.</>;
    else if (mine === theirs) line = <>Both {NAME[mine].toLowerCase()}: nobody scores.</>;
    else if (shown.winner === mySeat)
      line = (
        <>
          <strong>Your {NAME[mine].toLowerCase()} beats their {NAME[theirs].toLowerCase()}!</strong>
        </>
      );
    else
      line = (
        <>
          Their {NAME[theirs].toLowerCase()} beats your {NAME[mine].toLowerCase()}.
        </>
      );
  }

  return (
    <LiveFrame
      title="Paper, Scissors, Stone"
      onBack={onBack}
      game={game as unknown as LiveGame<unknown, unknown>}
      howTo={<>Each round you’ve {PICK_MS / 1000} seconds to pick. You’ll see theirs once you’ve both chosen. First to {TO_WIN}.</>}
      playing={
        shown ? (
          line
        ) : (
          <>
            Round {s?.round}. {myPick ? (theyPicked ? 'Both picked!' : `Waiting for ${partner} to pick…`) : <strong>Pick one!</strong>}{' '}
            {theyPicked && !myPick ? `${partner} has picked.` : ''}
          </>
        )
      }
      poster={
        <div className="flex justify-center gap-6 py-6">
          {HANDS.map((h) => (
            <HandArt key={h} hand={h} size={80} />
          ))}
        </div>
      }
      width={760}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center justify-between w-full max-w-[560px] font-bold">
          <span className="flex items-center gap-2">You {pips(mySeat)}</span>
          <span className="flex items-center gap-2">
            {pips(them)} {partner}
          </span>
        </div>
        {/* the table: your hand on the left, theirs on the right */}
        <div className="flex items-center justify-around w-full max-w-[560px] py-4" style={{ background: '#3a2b25', boxShadow: '0 0 0 4px #1b1411', minHeight: 170 }}>
          <div className="flex flex-col items-center gap-2">
            {shown?.hands[mySeat] || myPick ? <HandArt hand={(shown?.hands[mySeat] || myPick) as Hand} size={110} /> : <span className="text-6xl opacity-40">?</span>}
            <span className="text-sm opacity-80">You</span>
          </div>
          <div className="text-3xl font-bold opacity-70">vs</div>
          <div className="flex flex-col items-center gap-2">
            {shown?.hands[them] ? (
              <HandArt hand={shown.hands[them] as Hand} size={110} flip />
            ) : (
              <span className="text-6xl" style={{ opacity: theyPicked ? 0.9 : 0.35 }}>
                {theyPicked ? '✓' : '?'}
              </span>
            )}
            <span className="text-sm opacity-80">{partner}</span>
          </div>
        </div>
        {s?.phase === 'pick' && (
          <div className="w-full max-w-[560px] h-3" style={{ background: 'rgba(239,227,203,.15)' }}>
            <div style={{ width: `${(left / PICK_MS) * 100}%`, height: '100%', background: left < 1500 ? '#e07a5f' : '#ffd76a', transition: 'width 100ms linear' }} />
          </div>
        )}
        <div className="flex gap-2.5 flex-wrap justify-center">
          {HANDS.map((h) => (
            <button
              key={h}
              type="button"
              className="px-box border-0 flex flex-col items-center gap-1.5 px-3 py-2.5"
              style={{
                color: 'var(--ink-soft)',
                cursor: picking && !myPick ? 'pointer' : 'default',
                opacity: !picking || (myPick && myPick !== h) ? 0.55 : 1,
                outline: myPick === h ? '3px solid #e2b359' : undefined,
                outlineOffset: 4,
              }}
              disabled={!picking || !!myPick}
              onClick={() => pick(h)}
            >
              <HandArt hand={h} size={56} />
              <span className="font-bold">{NAME[h]}</span>
            </button>
          ))}
        </div>
      </div>
    </LiveFrame>
  );
};
