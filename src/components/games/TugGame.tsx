import React, { useCallback, useEffect, useRef } from 'react';
import { useGames } from '../../games/GamesContext';
import { useLiveGame } from '../../games/live/useLiveGame';
import { DURATION_MS, TUG, TugAct, TugState } from '../../games/tug';
import { tone } from '../../escape/sfx';
import { AvatarThumb } from '../PixelAvatarRenderer';
import type { AvatarConfig } from '../../types';
import { LiveFrame, useNow } from './LiveFrame';
import type { LiveGame } from '../../games/live/useLiveGame';

const ROPE_W = 640;

export const TugGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const game = useLiveGame<TugState, TugAct>('tug', TUG);
  const { seatUser } = useGames();
  const { state: s, mySeat, them, partner, act, stage, clock } = game;
  const now = useNow(stage === 'play' || stage === 'count', 100);
  const live = stage === 'play' && !!s && !s.winner && now >= game.startAt;

  // my taps this game, counted here so a lost message never loses any
  const mine = useRef({ g: '', n: 0 });
  const gid = game.match?.id || '';
  if (mine.current.g !== gid) mine.current = { g: gid, n: 0 };

  const tap = useCallback(() => {
    if (!live) return;
    mine.current.n = Math.max(mine.current.n, s?.taps[mySeat] || 0) + 1;
    act({ taps: mine.current.n }, true);
    tone(300 + (mine.current.n % 6) * 40, 0.03, 0, 'square', 0.025);
  }, [live, act, s, mySeat]);

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

  // + towards me, on my screen I'm always on the left
  const pos = s ? (mySeat === 'a' ? s.pos : -s.pos) : 0;
  const myCount = Math.max(mine.current.n, s?.taps[mySeat] || 0);
  const theirCount = s?.taps[them] || 0;
  const secs = s ? Math.min(DURATION_MS / 1000, Math.max(0, Math.ceil((clock(s.endsAt) - now) / 1000))) : DURATION_MS / 1000;

  const me = seatUser(mySeat);
  const you = seatUser(them);

  return (
    <LiveFrame
      title="Tug of War"
      onBack={onBack}
      game={game as unknown as LiveGame<unknown, unknown>}
      howTo={<>Tap the big button (or the space bar) as fast as you can. Pull the ribbon all the way to your side, or be ahead when 20 seconds are up.</>}
      playing={
        <>
          <strong>Tap, tap, tap!</strong> {secs}s left.
        </>
      }
      poster={<Field pos={0} me={me?.avatar} you={you?.avatar} />}
    >
      <div className="flex flex-col items-center gap-4">
        <Field pos={pos} me={me?.avatar} you={you?.avatar} />
        <div className="flex items-center justify-between w-full max-w-[640px] font-bold text-lg">
          <span>You · {myCount}</span>
          <span className="opacity-80">{secs}s</span>
          <span>
            {theirCount} · {partner}
          </span>
        </div>
        <button
          type="button"
          className="px-btn px-btn--sage w-full max-w-[640px] select-none"
          style={{ fontSize: 34, padding: '28px 0', touchAction: 'manipulation' }}
          disabled={!live}
          onPointerDown={(e) => {
            e.preventDefault();
            tap();
          }}
        >
          {live ? 'TAP!' : s?.winner ? 'Done' : 'Get ready…'}
        </button>
      </div>
    </LiveFrame>
  );
};

/** The meadow, the rope, and the ribbon in the middle of it. */
const Field: React.FC<{ pos: number; me?: AvatarConfig; you?: AvatarConfig }> = ({ pos, me, you }) => {
  const x = 50 - pos * 38;
  return (
    <div className="relative w-full max-w-[640px] mx-auto" style={{ aspectRatio: `${ROPE_W} / 170`, background: '#4f7a43', boxShadow: '0 0 0 4px #2b4426' }}>
      <div className="absolute inset-x-0 top-0" style={{ height: '34%', background: '#8fb8c9' }} />
      <div className="absolute inset-x-0" style={{ top: '34%', height: 6, background: '#3f6337' }} />
      {/* the two lines to pull the ribbon over */}
      <div className="absolute" style={{ left: '12%', top: '40%', bottom: '8%', width: 4, background: '#efe3cb', opacity: 0.8 }} />
      <div className="absolute" style={{ right: '12%', top: '40%', bottom: '8%', width: 4, background: '#efe3cb', opacity: 0.8 }} />
      {/* the rope */}
      <div className="absolute" style={{ left: '8%', right: '8%', top: '62%', height: 8, background: '#c89a5c', boxShadow: 'inset 0 2px 0 #e2bf84, inset 0 -2px 0 #8a6a36' }} />
      {/* the ribbon */}
      <div className="absolute" style={{ left: `${x}%`, top: '50%', transform: 'translateX(-50%)', transition: 'left 120ms linear' }}>
        <div style={{ width: 14, height: 34, background: '#c4453f', boxShadow: 'inset 3px 0 0 #e07a5f' }} />
      </div>
      <div className="absolute" style={{ left: '1%', top: '38%' }}>
        {me ? <AvatarThumb config={me} region="head" size={64} /> : null}
      </div>
      <div className="absolute" style={{ right: '1%', top: '38%', transform: 'scaleX(-1)' }}>
        {you ? <AvatarThumb config={you} region="head" size={64} /> : null}
      </div>
    </div>
  );
};
