import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useStreamHub } from '../stream/StreamHub';
import { useTurntable } from '../music/TurntableContext';
import { ARTIST, LICENSE, LICENSE_URL, SOURCE_URL } from '../music/records';
import { describeYouTubeError, loadYouTubeApi, YTPlayer, YTState } from '../watch/youtube';
import { Sprite } from './games/Pixel';

const RECORD = ['..kkkkk..', '.kkgkgkk.', 'kkkkkkkkk', 'kgkrrrkgk', 'kkkrwrkkk', 'kgkrrrkgk', 'kkkkkkkkk', '.kkgkgkk.', '..kkkkk..'];
const PAL = { k: '#1f1718', g: '#3a3035', r: '#b8674f', w: '#efdcb8' };

/** YouTube's player has to stay visible, at least 200 by 200, with nothing on top of it. */
const PLAYER_W = 240;
const PLAYER_H = 200;
/** how far apart the two of you can drift before it nudges back (seconds) */
const DRIFT = 2.5;

const Spin: React.FC<{ on: boolean }> = ({ on }) => (
  <span className={`shrink-0 ${on ? 'np-spin' : ''}`} aria-hidden="true">
    <Sprite rows={RECORD} pal={PAL} scale={3} />
  </span>
);

/** What's on the record player, with the credit the music asks for, and its controls. */
export const NowPlaying: React.FC = () => {
  const tt = useTurntable();
  const hub = useStreamHub();
  const { currentUser, partnerUser } = useApp();
  const fromThem = !!partnerUser && tt.by === partnerUser.id;
  const who = fromThem ? partnerUser!.name : tt.by === currentUser.id ? 'You' : 'Someone';

  const card =
    tt.on && (tt.yt || tt.track) ? (
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
          .np-yt iframe { display: block; width: 100%; height: 100%; border: 0; }
        `}</style>
        {tt.yt ? <SongCard who={who} fromThem={fromThem} /> : <RecordCard who={who} fromThem={fromThem} />}
      </div>
    ) : null;

  return (
    <>
      {card}
      {tt.picking && <RecordPicker />}
    </>
  );
};

/** The jazz record. */
const RecordCard: React.FC<{ who: string; fromThem: boolean }> = ({ who, fromThem }) => {
  const tt = useTurntable();
  if (!tt.track) return null;
  return (
    <div className="px-box px-shadow px-fade px-3 py-2 flex items-center gap-x-3 gap-y-2 flex-wrap">
      <Spin on={tt.hearing} />
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
        <Volume />
        <button className="px-btn px-btn--paper px-btn--small" onClick={tt.openPicker} title="Put on a song from YouTube instead">
          A song instead
        </button>
        <button className="px-btn px-btn--paper px-btn--small" onClick={tt.toggle}>
          Lift the needle
        </button>
      </span>
    </div>
  );
};

const Volume: React.FC = () => {
  const tt = useTurntable();
  return (
    <>
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
    </>
  );
};

/**
 * A song from YouTube, playing for both of you. Each of you plays it in your own YouTube player (which
 * stays in view, as YouTube asks), lined up to the same moment from the shared start time.
 */
const SongCard: React.FC<{ who: string; fromThem: boolean }> = ({ who, fromThem }) => {
  const tt = useTurntable();
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const yt = tt.yt!;
  const listenRef = useRef<() => void>(() => undefined);

  return (
    <div className="px-box px-shadow px-fade p-3 flex flex-col sm:flex-row gap-3 max-w-[560px]">
      <div className="np-yt shrink-0 bg-black" style={{ width: PLAYER_W, height: PLAYER_H, boxShadow: '0 0 0 3px var(--ink)' }}>
        <SongPlayer
          key={`${yt.id}-${tt.startedAt}`}
          id={yt.id}
          startedAt={tt.startedAt}
          play={!tt.hushed && !tt.mutedForMe}
          volume={tt.volume}
          onTitle={(t) => {
            setTitle(t);
            tt.songInfo(yt.id, t);
          }}
          onHearing={(on) => {
            tt.reportHearing(on);
            if (on) setBlocked(false);
          }}
          onBlocked={setBlocked}
          onEnded={() => tt.songEnded(yt.id)}
          onError={(code) => setError(describeYouTubeError(code))}
          listenRef={listenRef}
        />
      </div>
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <Spin on={tt.hearing} />
          <span className="flex flex-col min-w-0 leading-tight">
            <span className="font-semibold line-clamp-2">{title || yt.title || 'A song from YouTube'}</span>
            <span className="text-xs text-[var(--muted)]">From YouTube{fromThem ? ` · ${who} put this on` : ''}</span>
          </span>
        </div>
        {error && (
          <p className="m-0 text-sm text-[#7f3835]">
            {error}{' '}
            <button className="px-link" onClick={tt.openPicker}>
              Pick another
            </button>
          </p>
        )}
        {blocked && !error && (
          <span className="flex items-center gap-2 flex-wrap">
            <span className="text-sm">{fromThem ? `${who} put a song on.` : 'A song’s playing.'}</span>
            <button className="px-btn px-btn--sage px-btn--small" onClick={() => listenRef.current()}>
              Listen
            </button>
          </span>
        )}
        {tt.hushed && !tt.mutedForMe && <span className="text-sm">Paused while you watch</span>}
        <span className="flex items-center gap-1.5 flex-wrap">
          <Volume />
        </span>
        <span className="flex items-center gap-1.5 flex-wrap">
          <button className="px-btn px-btn--paper px-btn--small" onClick={tt.openPicker}>
            Another song
          </button>
          <button className="px-btn px-btn--paper px-btn--small" onClick={tt.toggle}>
            Lift the needle
          </button>
        </span>
      </div>
    </div>
  );
};

/** One YouTube player, kept at the shared spot in the song. */
const SongPlayer: React.FC<{
  id: string;
  startedAt: number;
  play: boolean;
  volume: number;
  onTitle: (t: string) => void;
  onHearing: (on: boolean) => void;
  onBlocked: (b: boolean) => void;
  onEnded: () => void;
  onError: (code: number) => void;
  listenRef: React.MutableRefObject<() => void>;
}> = ({ id, startedAt, play, volume, onTitle, onHearing, onBlocked, onEnded, onError, listenRef }) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);
  const cb = useRef({ onTitle, onHearing, onBlocked, onEnded, onError });
  cb.current = { onTitle, onHearing, onBlocked, onEnded, onError };
  const want = useRef({ play, volume });
  want.current = { play, volume };
  const endedRef = useRef(false);
  const tries = useRef(0);

  const at = () => Math.max(0, (Date.now() - startedAt) / 1000);

  /** line the player up: playing at the shared spot, or paused here */
  const line = (fromGesture = false) => {
    const p = playerRef.current;
    if (!p || !readyRef.current || endedRef.current) return;
    const dur = p.getDuration?.() || 0;
    if (dur > 0 && at() > dur - 0.4) {
      endedRef.current = true;
      cb.current.onHearing(false);
      cb.current.onEnded();
      return;
    }
    const st = p.getPlayerState();
    if (!want.current.play) {
      if (st === YTState.PLAYING || st === YTState.BUFFERING) p.pauseVideo();
      cb.current.onHearing(false);
      return;
    }
    if (st === YTState.PLAYING) {
      tries.current = 0;
      if (Math.abs(p.getCurrentTime() - at()) > DRIFT) p.seekTo(at(), true);
      return;
    }
    if (st === YTState.BUFFERING && !fromGesture) return;
    p.seekTo(at(), true);
    p.playVideo();
    // still not playing after a couple of tries: the browser wants a tap first
    if (++tries.current >= 3 && !fromGesture) cb.current.onBlocked(true);
  };
  const lineRef = useRef(line);
  lineRef.current = line;
  listenRef.current = () => {
    tries.current = 0;
    lineRef.current(true);
  };

  useEffect(() => {
    let alive = true;
    const host = hostRef.current;
    if (!host) return;
    const el = document.createElement('div');
    host.append(el);
    loadYouTubeApi()
      .then((YT) => {
        if (!alive) return;
        playerRef.current = new YT.Player(el, {
          videoId: id,
          width: '100%',
          height: '100%',
          playerVars: { start: Math.floor(at()), playsinline: 1, rel: 0, iv_load_policy: 3, fs: 0, autoplay: 1 },
          events: {
            onReady: (e) => {
              readyRef.current = true;
              e.target.setVolume?.(Math.round(want.current.volume * 100));
              const t = e.target.getVideoData?.().title;
              if (t) cb.current.onTitle(t);
              lineRef.current();
            },
            onStateChange: (e) => {
              if (e.data === YTState.PLAYING) {
                cb.current.onHearing(true);
                cb.current.onBlocked(false);
                const t = e.target.getVideoData?.().title;
                if (t) cb.current.onTitle(t);
              } else if (e.data === YTState.PAUSED) cb.current.onHearing(false);
              else if (e.data === YTState.ENDED && !endedRef.current) {
                endedRef.current = true;
                cb.current.onHearing(false);
                cb.current.onEnded();
              }
            },
            onError: (e) => {
              cb.current.onHearing(false);
              cb.current.onError(e.data);
            },
          },
        });
      })
      .catch(() => alive && cb.current.onError(-1));
    const t = window.setInterval(() => lineRef.current(), 1500);
    return () => {
      alive = false;
      window.clearInterval(t);
      try {
        playerRef.current?.destroy();
      } catch {
        // already gone
      }
      playerRef.current = null;
      readyRef.current = false;
      el.remove();
      cb.current.onHearing(false);
    };
    // the player is made once per song (the parent remounts this for a new one)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    lineRef.current();
  }, [play]);

  useEffect(() => {
    if (readyRef.current) playerRef.current?.setVolume?.(Math.round(volume * 100));
  }, [volume]);

  return <div ref={hostRef} className="w-full h-full" />;
};

/** Choosing what goes on: the jazz record, or a song from YouTube. */
const RecordPicker: React.FC = () => {
  const tt = useTurntable();
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && tt.closePicker();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tt]);

  return (
    <div className="fixed inset-0 z-50 px-ui flex items-center justify-center p-4" style={{ background: 'rgba(29, 21, 18, 0.45)' }} onClick={tt.closePicker}>
      <div
        className="px-box px-shadow px-pop w-full max-w-[460px] p-5 flex flex-col gap-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="picker-title" className="text-2xl font-bold m-0 leading-tight">
              The record player
            </h2>
            <p className="m-0 text-sm text-[var(--muted)]">Whatever you put on plays for both of you, in sync.</p>
          </div>
          <button className="px-btn px-btn--paper px-btn--small" onClick={tt.closePicker} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="px-inset p-3 flex items-center gap-3">
          <Sprite rows={RECORD} pal={PAL} scale={4} />
          <span className="flex flex-col min-w-0 leading-tight flex-1">
            <strong>Our jazz record</strong>
            <span className="text-sm text-[var(--muted)]">Five soft jazz tracks, round and round.</span>
          </span>
          <button className="px-btn px-btn--small shrink-0" onClick={tt.playJazz}>
            Put it on
          </button>
        </div>

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setError(tt.playYouTube(link));
          }}
        >
          <label htmlFor="song-link" className="font-semibold">
            A song from YouTube
          </label>
          <span className="text-sm text-[var(--muted)] -mt-1">Paste a link from YouTube or YouTube Music.</span>
          <div className="flex gap-2 flex-wrap">
            <input
              id="song-link"
              className="px-input flex-1 min-w-[12rem]"
              value={link}
              onChange={(e) => {
                setLink(e.target.value);
                setError(null);
              }}
              placeholder="https://music.youtube.com/watch?v=…"
              autoComplete="off"
              spellCheck={false}
              autoFocus
            />
            <button className="px-btn" type="submit" disabled={!link.trim()}>
              Play
            </button>
          </div>
          {error && <p className="m-0 text-sm text-[#7f3835]">{error}</p>}
        </form>
      </div>
    </div>
  );
};
