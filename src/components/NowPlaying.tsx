import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { useStreamHub } from '../stream/StreamHub';
import { useTurntable } from '../music/TurntableContext';
import { shelf, creditFor } from '../music/records';
import { describeYouTubeError, loadYouTubeApi, YTPlayer, YTState } from '../watch/youtube';
import { songStalled, songStep, songSync } from '../music/songSync';
import { Sprite } from './games/Pixel';

const RECORD = ['..kkkkk..', '.kkgkgkk.', 'kkkkkkkkk', 'kgkrrrkgk', 'kkkrwrkkk', 'kgkrrrkgk', 'kkkkkkkkk', '.kkgkgkk.', '..kkkkk..'];
const PAL = { k: '#1f1718', g: '#3a3035', r: '#b8674f', w: '#efdcb8' };

/** YouTube's player has to stay visible, at least 200 by 200, with nothing on top of it. */
const PLAYER_W = 240;
const PLAYER_H = 200;

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

/** who made the song that's playing, with links, as its licence asks */
const Credit: React.FC<{ album?: string }> = ({ album }) => {
  const c = creditFor(album);
  return (
    <span className="text-xs text-[var(--muted)]">
      {c.artist} (
      <a className="underline" href={c.sourceUrl} target="_blank" rel="noreferrer">
        {c.source}
      </a>
      ) ·{' '}
      <a className="underline" href={c.licenseUrl} target="_blank" rel="noreferrer">
        {c.license}
      </a>
    </span>
  );
};

/** What's on the record player, and who made it. */
const RecordCard: React.FC<{ who: string; fromThem: boolean }> = ({ who, fromThem }) => {
  const tt = useTurntable();
  if (!tt.track) return null;
  return (
    <div className="px-box px-shadow px-fade px-3 py-2 flex items-center gap-x-3 gap-y-2 flex-wrap">
      <Spin on={tt.hearing} />
      <span className="flex flex-col min-w-0 leading-tight">
        <span className="text-[11px] font-bold tracking-wide" style={{ color: '#a84f4b' }}>
          NOW PLAYING · {(shelf.find((r) => r.id === tt.album)?.title ?? 'Jazz café').toUpperCase()}
        </span>
        <span className="font-semibold truncate">{tt.track.title}</span>
        <Credit album={tt.album ?? undefined} />
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
          Next song
        </button>
        <Volume />
        <button className="px-btn px-btn--paper px-btn--small" onClick={tt.openPicker} title="Choose a record">
          Record shelf
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
  /** how it's been keeping up (see music/songSync.ts) */
  const sync = useRef(songSync());

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
    // (a tap to listen starts it whatever it's doing)
    const step = fromGesture && want.current.play && st !== YTState.PLAYING ? 'seekPlay' : songStep(sync.current, st, p.getCurrentTime?.() || 0, at(), Date.now(), want.current.play);
    if (!want.current.play) {
      if (step === 'pause') p.pauseVideo();
      cb.current.onHearing(false);
      return;
    }
    if (st === YTState.PLAYING) tries.current = 0;
    if (step === 'seek') p.seekTo(at(), true);
    if (step !== 'play' && step !== 'seekPlay') return;
    if (step === 'seekPlay') p.seekTo(at(), true);
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
              else if (e.data === YTState.BUFFERING) songStalled(sync.current, Date.now());
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

/** Each record's sleeve on the shelf: its own little picture (the record shelf design, drawn the same on iPhone). */
const SLEEVES: Record<string, { bg: string; bits: React.CSSProperties[] }> = {
  // the jazz café: a note on terracotta
  jazz: { bg: '#8f4b3a', bits: [
    { left: 18, top: 14, width: 3, height: 22, background: '#f2d48a' },
    { left: 21, top: 14, width: 8, height: 3, background: '#f2d48a' },
    { left: 26, top: 17, width: 3, height: 5, background: '#f2d48a' },
    { left: 11, top: 31, width: 10, height: 7, background: '#f2d48a' },
  ] },
  // a night sky: two stars and the moon
  lofi: { bg: '#4a3a5a', bits: [
    { left: 10, top: 12, width: 6, height: 6, background: '#f2d48a' },
    { left: 30, top: 30, width: 4, height: 4, background: '#fff4e2' },
    { right: 14, top: 16, width: 18, height: 18, clipPath: 'circle(50%)', background: '#f4ecd0' },
  ] },
  // piano keys along the bottom
  piano: { bg: '#fff8ea', bits: [
    { left: 0, right: 0, bottom: 0, height: 30, background: 'repeating-linear-gradient(90deg, #fff8ea 0 12px, #2b1e1c 12px 15px)' },
    { left: 9, bottom: 12, width: 6, height: 18, background: '#2b1e1c' },
    { left: 33, bottom: 12, width: 6, height: 18, background: '#2b1e1c' },
    { left: 60, bottom: 12, width: 6, height: 18, background: '#2b1e1c' },
  ] },
  // the sun coming up over a hill
  acoustic: { bg: '#8a9a72', bits: [
    { left: '50%', top: 14, width: 26, height: 26, marginLeft: -13, clipPath: 'circle(50%)', background: '#f2d66b' },
    { left: 0, right: 0, bottom: 0, height: 22, background: '#6a7856' },
  ] },
  // rain on blue
  rain: { bg: '#5a79a3', bits: [
    { inset: 0, background: 'repeating-linear-gradient(105deg, transparent 0 9px, rgba(255,255,255,.35) 9px 11px)' },
  ] },
  // three blocks falling
  arcade: { bg: '#2b1e1c', bits: [
    { left: 12, top: 14, width: 12, height: 12, background: '#e2b359' },
    { left: 36, top: 30, width: 12, height: 12, background: '#c4453f' },
    { left: 60, top: 46, width: 12, height: 12, background: '#7fb2d9' },
  ] },
};

const Sleeve: React.FC<{ id: string; playing: boolean }> = ({ id, playing }) => {
  const art = SLEEVES[id] ?? SLEEVES.jazz;
  return (
    <span
      aria-hidden="true"
      className="relative block overflow-hidden"
      style={{
        height: 84,
        background: art.bg,
        border: '3px solid #2b1e1c',
        boxShadow: '3px 3px 0 rgba(0,0,0,.3)',
        ...(playing ? { outline: '3px solid #e2b359', outlineOffset: 1 } : {}),
      }}
    >
      {art.bits.map((bit, i) => (
        <span key={i} className="absolute" style={bit} />
      ))}
      {playing && (
        <>
          {/* (the site squares off every corner, so the circles are clipped instead) */}
          <span className="absolute" style={{ right: -21, top: 11, width: 60, height: 60, clipPath: 'circle(50%)', background: '#3a3035' }} />
          <span className="absolute" style={{ right: -18, top: 14, width: 54, height: 54, clipPath: 'circle(50%)', background: '#1f1718' }} />
          <span className="absolute" style={{ left: 7, bottom: 6, fontSize: 10, fontWeight: 700, color: '#f2d48a' }}>PLAYING</span>
        </>
      )}
    </span>
  );
};

const SONGS = shelf.reduce((n, record) => n + record.tracks.length, 0);

/** Choosing what goes on: a record from the shelf (Our song is chosen on iPhone). */
const RecordPicker: React.FC = () => {
  const tt = useTurntable();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && tt.closePicker();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tt]);

  return (
    <div className="st-frost fixed inset-0 z-50 px-ui flex items-center justify-center p-4" onClick={tt.closePicker}>
      <div
        className="px-box px-shadow px-pop w-full max-w-[460px] max-h-[90dvh] overflow-y-auto p-5 flex flex-col gap-4"
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

        <div className="flex items-baseline justify-between gap-2">
          <strong className="text-lg">Records</strong>
          <small className="text-xs whitespace-nowrap text-[var(--muted)]">
            {shelf.length} records · {SONGS} songs, free to use
          </small>
        </div>
        <div className="grid grid-cols-3 gap-x-2.5 gap-y-3">
          {shelf.map((record) => {
            const playing = tt.album === record.id;
            return (
              <button
                key={record.id}
                className="flex flex-col gap-1 text-left"
                aria-pressed={playing}
                aria-label={`${record.title}, ${record.tracks.length} songs by ${record.credit.artist}${playing ? ', playing' : ''}`}
                onClick={() => tt.playJazz(record.id)}
              >
                <Sleeve id={record.id} playing={playing} />
                <strong className="text-[13px] leading-tight">{record.title}</strong>
                <small className="text-[11px] leading-tight text-[var(--muted)]">
                  {record.tracks.length} songs
                  <br />
                  {record.credit.artist}
                </small>
              </button>
            );
          })}
        </div>
        <section className="flex items-center gap-2.5 px-3 py-2.5" style={{ background: '#3a2a2c', border: '3px solid #e2b359', boxShadow: '3px 3px 0 rgba(0,0,0,.3)' }}>
          <span className="flex flex-col gap-0.5 min-w-0">
            <strong style={{ color: '#fff4e2' }}>
              Our song{' '}
              <span style={{ fontSize: 10, background: '#e2b359', color: '#2b1e1c', padding: '1px 4px', verticalAlign: 2 }}>PLUS</span>
            </strong>
            <small style={{ color: '#e8d6bd' }}>Any song from Apple Music, for both of you. Choose it in Soultied on iPhone; you both need Apple Music.</small>
          </span>
        </section>
      </div>
    </div>
  );
};
