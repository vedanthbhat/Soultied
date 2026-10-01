import React from 'react';
import { useApp } from '../context/AppContext';
import { useStreamHub } from '../stream/StreamHub';
import { useTurntable } from '../music/TurntableContext';
import { ARTIST, LICENSE, LICENSE_URL, SOURCE_URL } from '../music/records';
import { Sprite } from './games/Pixel';

const RECORD = ['..kkkkk..', '.kkgkgkk.', 'kkkkkkkkk', 'kgkrrrkgk', 'kkkrwrkkk', 'kgkrrrkgk', 'kkkkkkkkk', '.kkgkgkk.', '..kkkkk..'];
const PAL = { k: '#1f1718', g: '#3a3035', r: '#b8674f', w: '#efdcb8' };

/** What's on the record player, with the credit the music asks for, and its controls. */
export const NowPlaying: React.FC = () => {
  const tt = useTurntable();
  const hub = useStreamHub();
  const { currentUser, partnerUser } = useApp();
  if (!tt.on || !tt.track) return null;
  const fromThem = !!partnerUser && tt.by === partnerUser.id;
  const who = fromThem ? partnerUser!.name : tt.by === currentUser.id ? 'You' : 'Someone';
  return (
    // on a phone it sits up top, clear of the couch and the coffee table
    <div
      className={`fixed left-4 top-11 sm:top-auto ${hub?.active ? 'sm:bottom-20' : 'sm:bottom-4'} z-30 px-ui max-w-[calc(100vw-2rem)]`}
      role="region"
      aria-label="Record player"
    >
      <style>{`
        @keyframes np-spin { to { transform: rotate(360deg); } }
        .np-spin { animation: np-spin 1.8s steps(8) infinite; }
        @media (prefers-reduced-motion: reduce) { .np-spin { animation: none; } }
      `}</style>
      <div className="px-box px-shadow px-fade px-3 py-2 flex items-center gap-x-3 gap-y-2 flex-wrap">
        <span className={`shrink-0 ${tt.hearing ? 'np-spin' : ''}`} aria-hidden="true">
          <Sprite rows={RECORD} pal={PAL} scale={3} />
        </span>
        <span className="flex flex-col min-w-0 leading-tight">
          <span className="font-semibold truncate">{tt.track.title}</span>
          <span className="text-xs text-[var(--muted)]">
            {ARTIST} (
            <a className="underline" href={SOURCE_URL} target="_blank" rel="noreferrer">
              incompetech.com
            </a>
            ) ·{' '}
            <a className="underline" href={LICENSE_URL} target="_blank" rel="noreferrer">
              {LICENSE}
            </a>
          </span>
          {fromThem && !tt.blocked && <span className="text-xs text-[var(--muted)]">{who} put this on</span>}
        </span>
        {tt.blocked && (
          <span className="flex items-center gap-2">
            <span className="text-sm">{fromThem ? `${who} put a record on.` : 'A record’s playing.'}</span>
            <button className="px-btn px-btn--sage px-btn--small" onClick={tt.listen}>
              Listen
            </button>
          </span>
        )}
        {tt.hushed && !tt.mutedForMe && <span className="text-sm">Paused while you watch</span>}
        <span className="flex items-center gap-1.5 flex-wrap">
          <button className="px-btn px-btn--paper px-btn--small" onClick={tt.skip}>
            Next
          </button>
          <button className="px-btn px-btn--paper px-btn--small" aria-pressed={tt.mutedForMe} onClick={() => tt.setMutedForMe(!tt.mutedForMe)}>
            {tt.mutedForMe ? 'Unmute' : 'Mute for me'}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={tt.volume}
            onChange={(e) => tt.setVolume(Number(e.target.value))}
            aria-label="Volume"
            className="w-20 accent-[#b8674f]"
          />
          <button className="px-btn px-btn--paper px-btn--small" onClick={tt.toggle}>
            Lift the needle
          </button>
        </span>
      </div>
    </div>
  );
};
