import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { renderWatchRoom, WATCH_W, WATCH_H, TV_SCREEN, ICONS, ReactionKind, WatchState } from '../pixel/watchRoom';
import { PixelBuffer } from '../pixel/buffer';
import { AvatarThumb } from './PixelAvatarRenderer';
import { localTransport, projectedPosition, WatchEvent, WatchTransport } from '../watch/sync';
import { loadYouTubeApi, parseYouTubeId, parseYouTubeStart, describeYouTubeError, YTPlayer, YTState } from '../watch/youtube';

/**
 * Watch together (YouTube). The camera swings round behind the couch; the
 * YouTube player sits exactly inside the pixel TV. Nothing is ever drawn on
 * top of the player: the controls live beside or below it.
 */

interface Fit {
  s: number;
  left: number;
  top: number;
}

const BEZEL = 5;

function computeFit(W: number, H: number): Fit {
  let s = Math.max(W / WATCH_W, H / WATCH_H);
  s = Math.min(s, (W - 16) / (TV_SCREEN.w + BEZEL * 2)); // whole TV fits across
  s = Math.max(s, 200 / TV_SCREEN.h); // YouTube needs at least 200px of player
  const sceneW = WATCH_W * s;
  const sceneH = WATCH_H * s;
  let left = W / 2 - (TV_SCREEN.x + TV_SCREEN.w / 2) * s;
  left = Math.min(0, Math.max(W - sceneW, left));
  if (sceneW < W) left = (W - sceneW) / 2;
  let top = 0;
  if (sceneH > H) top = Math.max(H - sceneH, Math.min(0, -(TV_SCREEN.y - BEZEL - 4) * s, (H - sceneH) * 0.3));
  return { s, left, top };
}

interface ChatMsg {
  id: string;
  by: string;
  name: string;
  text: string;
  at: number;
}

const REACTIONS: Array<{ kind: ReactionKind; label: string }> = [
  { kind: 'heart', label: 'Send a heart' },
  { kind: 'laugh', label: 'Laugh' },
  { kind: 'wow', label: 'Wow' },
  { kind: 'cry', label: 'Tears' },
];

const ReactionIcon: React.FC<{ kind: ReactionKind }> = ({ kind }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const icon = ICONS[kind];
    const b = new PixelBuffer(7, 7);
    icon.rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        const col = icon.pal[k];
        if (col) b.set(i, j, col);
      })
    );
    c.width = 7;
    c.height = 7;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(7, 7);
    img.data.set(b.data);
    ctx.putImageData(img, 0, 0);
  }, [kind]);
  return <canvas ref={ref} className="pixelated" style={{ width: 21, height: 21 }} aria-hidden="true" />;
};

export const WatchParty: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { currentUser, partnerUser, space } = useApp();
  const me = currentUser.id;
  const roomId = space?.id || 'solo';
  const creatorIsMe = !space || space.creatorId === me;
  const mySeat: 'left' | 'right' = creatorIsMe ? 'left' : 'right';
  const theirSeat: 'left' | 'right' = mySeat === 'left' ? 'right' : 'left';
  const partnerName = partnerUser?.name || space?.partnerPlaceholderName || 'your person';
  const saveKey = `soultied_watch_${roomId}`;

  const saved = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem(saveKey) || 'null') as { videoId: string; pos: number } | null;
    } catch {
      return null;
    }
  }, [saveKey]);

  const [fit, setFit] = useState<Fit>(() => computeFit(window.innerWidth, window.innerHeight));
  const [videoId, setVideoId] = useState<string | null>(saved?.videoId || null);
  const [tv, setTv] = useState<WatchState['tv']>('idle');
  const [status, setStatus] = useState<'off' | 'loading' | 'ready' | 'failed'>('off');
  const [notice, setNotice] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [partnerHere, setPartnerHere] = useState(false);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [link, setLink] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const creatingRef = useRef(false);
  const transportRef = useRef<WatchTransport | null>(null);
  const videoIdRef = useRef<string | null>(videoId);
  const suppressUntil = useRef(0);
  const expected = useRef({ pos: saved?.pos || 0, at: Date.now(), playing: false });
  const leaderRef = useRef<string>(me);
  const pendingRef = useRef<{ videoId: string; pos: number; at: number; playing: boolean } | null>(
    saved ? { videoId: saved.videoId, pos: saved.pos, at: Date.now(), playing: false } : null
  );
  const lastSeen = useRef(0);
  const joinedAt = useRef(Date.now());
  const sceneRef = useRef<WatchState>({
    left: { avatar: null },
    right: { avatar: null },
    tv: 'idle',
    reactions: [],
  });

  videoIdRef.current = videoId;
  sceneRef.current.left.avatar = creatorIsMe ? currentUser.avatar : partnerUser?.avatar || null;
  sceneRef.current.right.avatar = creatorIsMe ? partnerUser?.avatar || null : currentUser.avatar;
  sceneRef.current.tv = videoId ? tv : 'idle';

  const send = useCallback((e: WatchEvent) => transportRef.current?.send(e), []);
  const suppress = (ms: number) => (suppressUntil.current = Date.now() + ms);
  const addReaction = (kind: ReactionKind, seat: 'left' | 'right') => {
    const now = Date.now();
    sceneRef.current.reactions = [...sceneRef.current.reactions.filter((r) => now - r.t0 < 2000), { kind, seat, t0: now }];
  };

  /* ---------- layout ---------- */
  useEffect(() => {
    const onResize = () => setFit(computeFit(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /* ---------- pixel scene loop ---------- */
  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const img = ctx.createImageData(WATCH_W, WATCH_H);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < (reduced ? 400 : 83)) return;
      last = now;
      const buf = renderWatchRoom(sceneRef.current, (now - start) / 1000);
      img.data.set(buf.data);
      ctx.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* ---------- applying the other person's actions ---------- */
  const applyRemote = useCallback(
    (target: { videoId?: string | null; pos: number; at: number; playing: boolean }, tolerance: number) => {
      const p = playerRef.current;
      const vid = target.videoId === undefined ? videoIdRef.current : target.videoId;
      if (!vid) return;
      const pos = projectedPosition(target.pos, target.at, target.playing);
      expected.current = { pos, at: Date.now(), playing: target.playing };
      if (vid !== videoIdRef.current || !p) {
        pendingRef.current = { videoId: vid, pos: target.pos, at: target.at, playing: target.playing };
        if (vid !== videoIdRef.current) setVideoId(vid);
        if (p) {
          suppress(2500);
          if (target.playing) p.loadVideoById({ videoId: vid, startSeconds: pos });
          else p.cueVideoById({ videoId: vid, startSeconds: pos });
          pendingRef.current = null;
        }
        return;
      }
      suppress(1500);
      const cur = p.getCurrentTime();
      if (Math.abs(cur - pos) > tolerance) p.seekTo(pos, true);
      const st = p.getPlayerState();
      if (target.playing && st !== YTState.PLAYING) {
        p.playVideo();
        window.setTimeout(() => {
          if (playerRef.current && playerRef.current.getPlayerState() !== YTState.PLAYING && expected.current.playing)
            setNeedsTap(true);
        }, 1800);
      }
      if (!target.playing && st === YTState.PLAYING) p.pauseVideo();
    },
    []
  );

  const onRemote = useCallback(
    (e: WatchEvent) => {
      if (e.by === me) return;
      lastSeen.current = Date.now();
      setPartnerHere(e.type !== 'bye');
      switch (e.type) {
        case 'hello': {
          const p = playerRef.current;
          send({
            type: 'state',
            videoId: videoIdRef.current,
            pos: p ? p.getCurrentTime() : expected.current.pos,
            playing: p ? p.getPlayerState() === YTState.PLAYING : false,
            by: me,
            at: Date.now(),
            reply: true,
          });
          break;
        }
        case 'react':
          addReaction(e.kind, theirSeat);
          break;
        case 'chat':
          setChat((c) => [...c.slice(-80), { id: e.id, by: e.by, name: e.name, text: e.text, at: e.at }]);
          break;
        case 'load':
          leaderRef.current = e.by;
          setNotice(null);
          applyRemote({ videoId: e.videoId, pos: e.pos, at: e.at, playing: true }, 0);
          break;
        case 'play':
          leaderRef.current = e.by;
          applyRemote({ pos: e.pos, at: e.at, playing: true }, 0.6);
          break;
        case 'pause':
          leaderRef.current = e.by;
          applyRemote({ pos: e.pos, at: e.at, playing: false }, 0.4);
          break;
        case 'seek':
          leaderRef.current = e.by;
          applyRemote({ pos: e.pos, at: e.at, playing: e.playing }, 0.3);
          break;
        case 'state':
          if (e.reply) {
            // catching up when one of us walks in
            const justArrived = Date.now() - joinedAt.current < 6000;
            if (e.videoId && (justArrived || e.playing || !videoIdRef.current || e.videoId !== videoIdRef.current)) {
              leaderRef.current = e.by;
              applyRemote({ videoId: e.videoId, pos: e.pos, at: e.at, playing: e.playing }, 1);
            }
          } else if (e.videoId === videoIdRef.current && e.playing && leaderRef.current === e.by) {
            // leader heartbeat: only correct real drift
            applyRemote({ pos: e.pos, at: e.at, playing: true }, 1.5);
          }
          break;
      }
    },
    [me, send, applyRemote, theirSeat]
  );

  /* ---------- transport lifecycle ---------- */
  useEffect(() => {
    const t = localTransport(roomId);
    transportRef.current = t;
    const off = t.subscribe((e) => onRemoteRef.current(e));
    t.send({ type: 'hello', by: me, at: Date.now() });
    const ping = window.setInterval(() => {
      t.send({ type: 'ping', by: me, at: Date.now() });
      if (Date.now() - lastSeen.current > 12000) setPartnerHere(false);
    }, 5000);
    const bye = () => t.send({ type: 'bye', by: me, at: Date.now() });
    window.addEventListener('pagehide', bye);
    return () => {
      bye();
      window.removeEventListener('pagehide', bye);
      window.clearInterval(ping);
      off();
      t.close();
      transportRef.current = null;
    };
  }, [roomId, me]);
  const onRemoteRef = useRef(onRemote);
  onRemoteRef.current = onRemote;

  /* ---------- the YouTube player ---------- */
  useEffect(() => {
    if (!videoId || playerRef.current || creatingRef.current || !hostRef.current) return;
    creatingRef.current = true;
    setStatus('loading');
    loadYouTubeApi()
      .then((YT) => {
        if (!hostRef.current) return;
        const inner = document.createElement('div');
        hostRef.current.appendChild(inner);
        const first = pendingRef.current;
        pendingRef.current = null;
        const startPos = first ? projectedPosition(first.pos, first.at, first.playing) : 0;
        new YT.Player(inner, {
          width: '100%',
          height: '100%',
          videoId: first?.videoId || videoId,
          playerVars: {
            playsinline: 1,
            rel: 0,
            start: Math.floor(startPos),
            autoplay: first && !first.playing ? 0 : 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (ev) => {
              playerRef.current = ev.target;
              setStatus('ready');
              suppress(1500);
              if (first && Math.abs(ev.target.getCurrentTime() - startPos) > 1) ev.target.seekTo(startPos, true);
              const pend = pendingRef.current;
              if (pend) {
                pendingRef.current = null;
                applyRemote(pend, 0.5);
              }
            },
            onStateChange: (ev) => {
              const st = ev.data;
              if (st === YTState.PLAYING) {
                setTv('playing');
                setNeedsTap(false);
              } else if (st === YTState.PAUSED || st === YTState.ENDED || st === YTState.CUED) setTv('paused');
              if (st !== YTState.PLAYING && st !== YTState.PAUSED) return; // buffering / cued aren't intent
              const isPlaying = st === YTState.PLAYING;
              // an echo of what the other person just did: swallow it. Anything else is a real click.
              if (Date.now() < suppressUntil.current && isPlaying === expected.current.playing) return;
              const pos = ev.target.getCurrentTime();
              if (st === YTState.PLAYING) {
                leaderRef.current = me;
                expected.current = { pos, at: Date.now(), playing: true };
                send({ type: 'play', pos, by: me, at: Date.now() });
              } else if (st === YTState.PAUSED) {
                leaderRef.current = me;
                expected.current = { pos, at: Date.now(), playing: false };
                send({ type: 'pause', pos, by: me, at: Date.now() });
              }
            },
            onError: (ev) => setNotice(describeYouTubeError(ev.data)),
          },
        });
      })
      .catch(() => {
        creatingRef.current = false;
        setStatus('failed');
      });
  }, [videoId, me, send, applyRemote]);

  // Seek detection, heartbeat, and remembering where we were.
  useEffect(() => {
    const poll = window.setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      const now = Date.now();
      if (now < suppressUntil.current) return; // still settling after the other person's action
      const cur = p.getCurrentTime();
      const playing = p.getPlayerState() === YTState.PLAYING;
      const e = expected.current;
      const guess = projectedPosition(e.pos, e.at, e.playing, now);
      if (Math.abs(cur - guess) > 1.5) {
        leaderRef.current = me;
        send({ type: 'seek', pos: cur, playing, by: me, at: now });
      }
      expected.current = { pos: cur, at: now, playing };
    }, 700);
    const beat = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || leaderRef.current !== me || Date.now() < suppressUntil.current) return;
      if (p.getPlayerState() !== YTState.PLAYING) return;
      send({ type: 'state', videoId: videoIdRef.current, pos: p.getCurrentTime(), playing: true, by: me, at: Date.now() });
    }, 4000);
    const remember = window.setInterval(() => {
      const p = playerRef.current;
      if (!p || !videoIdRef.current) return;
      try {
        localStorage.setItem(saveKey, JSON.stringify({ videoId: videoIdRef.current, pos: p.getCurrentTime() }));
      } catch {
        // ignore
      }
    }, 5000);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(beat);
      window.clearInterval(remember);
    };
  }, [me, send, saveKey]);

  useEffect(
    () => () => {
      try {
        playerRef.current?.destroy();
      } catch {
        // ignore
      }
      playerRef.current = null;
    },
    []
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [chat.length, chatOpen]);

  /* ---------- my actions ---------- */
  const putOn = (e: React.FormEvent) => {
    e.preventDefault();
    const id = parseYouTubeId(link);
    if (!id) {
      setNotice("That doesn't look like a YouTube link. Paste the address of a video (youtube.com/watch?v=… or youtu.be/…).");
      return;
    }
    const start = parseYouTubeStart(link);
    setNotice(null);
    setLink('');
    leaderRef.current = me;
    expected.current = { pos: start, at: Date.now(), playing: true };
    const p = playerRef.current;
    if (p) {
      suppress(2000);
      p.loadVideoById({ videoId: id, startSeconds: start });
    } else pendingRef.current = { videoId: id, pos: start, at: Date.now(), playing: true };
    setVideoId(id);
    send({ type: 'load', videoId: id, pos: start, by: me, at: Date.now() });
  };

  const react = (kind: ReactionKind) => {
    addReaction(kind, mySeat);
    send({ type: 'react', kind, by: me, at: Date.now() });
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim().slice(0, 300);
    if (!text) return;
    const msg: ChatMsg = { id: `${me}-${Date.now()}`, by: me, name: currentUser.name, text, at: Date.now() };
    setChat((c) => [...c.slice(-80), msg]);
    setDraft('');
    send({ type: 'chat', ...msg });
  };

  const catchUp = () => {
    const p = playerRef.current;
    if (!p) return;
    const e = expected.current;
    suppress(1200);
    p.seekTo(projectedPosition(e.pos, e.at, e.playing), true);
    p.playVideo();
    setNeedsTap(false);
  };

  /* ---------- geometry ---------- */
  const W = window.innerWidth;
  const H = window.innerHeight;
  const tvBox = {
    left: Math.round(fit.left + TV_SCREEN.x * fit.s),
    top: Math.round(fit.top + TV_SCREEN.y * fit.s),
    width: Math.round(TV_SCREEN.w * fit.s),
    height: Math.round(TV_SCREEN.h * fit.s),
  };
  const tvRight = tvBox.left + tvBox.width + BEZEL * fit.s;
  const tvBottom = tvBox.top + tvBox.height + BEZEL * fit.s;
  const sceneBottom = fit.top + WATCH_H * fit.s;
  const stacked = H - sceneBottom > 180; // phone: scene on top, controls underneath
  const dockRight = !stacked && W - tvRight - 32 >= 260;
  const chatWidth = dockRight ? Math.min(340, W - tvRight - 32) : 0;
  const headerRoom = tvBox.left - BEZEL * fit.s - 32;
  const headerInRemote = stacked || headerRoom < 230;

  const watchingLine = partnerUser
    ? partnerHere
      ? `${partnerName} is watching with you`
      : `Waiting for ${partnerName} to sit down`
    : `Invite ${partnerName} to watch together`;

  const chatPanel = (
    <div className="px-box px-shadow flex flex-col" style={{ height: '100%' }}>
      <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
        <span className="font-bold">Couch chat</span>
        {!dockRight && !stacked && (
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => setChatOpen(false)} aria-label="Close chat">
            ✕
          </button>
        )}
      </div>
      <div className="px-divider mx-3" />
      <div className="px-scroll flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-2 text-sm" aria-live="polite">
        {chat.length === 0 && <p className="text-[var(--muted)]">Whisper something. Only the two of you can see this.</p>}
        {chat.map((m) => (
          <div key={m.id} className={`flex gap-2 items-start ${m.by === me ? 'flex-row-reverse text-right' : ''}`}>
            <span className="shrink-0 -mt-0.5">
              <AvatarThumb config={m.by === me ? currentUser.avatar : partnerUser?.avatar || currentUser.avatar} region="head" size={26} />
            </span>
            <span className={`px-2 py-1 max-w-[80%] break-words ${m.by === me ? 'bg-[#f1e0c4]' : 'bg-[var(--paper-2)]'}`}>
              {m.text}
            </span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>
      <form onSubmit={sendChat} className="flex gap-2 p-3 pt-1">
        <input
          className="px-input text-sm"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Say something to ${partnerName}`}
          aria-label="Chat message"
          maxLength={300}
        />
        <button className="px-btn px-btn--small shrink-0" type="submit">
          Send
        </button>
      </form>
    </div>
  );

  const header = (
    <div className="flex items-center gap-3 flex-wrap">
      <button className="px-btn px-btn--paper px-btn--small" onClick={onExit}>
        ← Back to the room
      </button>
      <span className="px-box px-2.5 py-1 text-sm flex items-center gap-2">
        <span className={`inline-block w-2.5 h-2.5 ${partnerHere ? 'bg-[var(--sage)]' : 'bg-[#b9a98f]'}`} />
        {watchingLine}
      </span>
    </div>
  );

  const remote = (
    <div className="px-box px-shadow flex flex-col gap-2 p-3" style={{ width: stacked ? '100%' : 'min(760px, calc(100vw - 32px))' }}>
      {headerInRemote && !stacked && header}
      <form onSubmit={putOn} className="flex gap-2 items-stretch">
        <input
          className="px-input text-sm"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Paste a YouTube link to put it on the TV"
          aria-label="YouTube link"
        />
        <button className="px-btn shrink-0" type="submit">
          Put it on
        </button>
      </form>
      <div className="flex items-center gap-2 flex-wrap">
        {REACTIONS.map((r) => (
          <button key={r.kind} className="px-btn px-btn--paper px-btn--small" onClick={() => react(r.kind)} aria-label={r.label} title={r.label}>
            <ReactionIcon kind={r.kind} />
          </button>
        ))}
        {needsTap && (
          <button className="px-btn px-btn--sage px-btn--small" onClick={catchUp}>
            ▶ Catch up with {partnerName}
          </button>
        )}
        {!dockRight && !stacked && (
          <button className="px-btn px-btn--paper px-btn--small ml-auto" onClick={() => setChatOpen((o) => !o)}>
            Chat{chat.length ? ` (${chat.length})` : ''}
          </button>
        )}
      </div>
      {notice && <p className="text-sm text-[#7f3835]">{notice}</p>}
    </div>
  );

  return (
    <div className="fixed inset-0 z-30 overflow-hidden px-ui" style={{ background: '#1d1512' }}>
      <style>{`
        .yt-host iframe { width: 100%; height: 100%; display: block; border: 0; }
        @keyframes watch-enter { from { opacity: 1; } to { opacity: 0; } }
        .watch-enter { animation: watch-enter 520ms steps(6) forwards; }
        @media (prefers-reduced-motion: reduce) { .watch-enter { animation-duration: 1ms; } }
      `}</style>
      <canvas
        ref={canvasRef}
        width={WATCH_W}
        height={WATCH_H}
        role="img"
        aria-label="The two of you on the couch, seen from behind, watching the big TV."
        className="absolute pixelated"
        style={{ left: fit.left, top: fit.top, width: WATCH_W * fit.s, height: WATCH_H * fit.s }}
      />

      {/* the real YouTube player, fitted into the TV screen */}
      <div className="absolute yt-host" style={{ ...tvBox, zIndex: 5, visibility: videoId ? 'visible' : 'hidden' }} ref={hostRef} />
      {(!videoId || status === 'loading' || status === 'failed') && (
        <div
          className="absolute flex flex-col items-center justify-center text-center gap-1 pointer-events-none"
          style={{ ...tvBox, zIndex: 6, color: '#e9d7b7' }}
        >
          {status === 'failed' ? (
            <>
              <span className="text-xl font-bold">Can't reach YouTube</span>
              <span className="text-sm opacity-80">Check your connection and try again.</span>
            </>
          ) : status === 'loading' ? (
            <span className="text-xl font-bold">Tuning in…</span>
          ) : (
            <>
              <span className="text-2xl font-bold mt-10">Put something on</span>
              <span className="text-sm opacity-80">Paste a YouTube link below. It plays for both of you.</span>
            </>
          )}
        </div>
      )}

      {stacked ? (
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-3 overflow-y-auto" style={{ top: sceneBottom + 8 }}>
          {header}
          {remote}
          <div style={{ height: 260 }}>{chatPanel}</div>
        </div>
      ) : (
        <>
          {!headerInRemote && (
            <div className="absolute" style={{ left: 16, top: 16, zIndex: 20, maxWidth: headerRoom }}>
              {header}
            </div>
          )}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 16, zIndex: 20 }}>
            {remote}
          </div>
          {dockRight && (
            <div className="absolute" style={{ right: 16, top: tvBox.top, height: tvBox.height, width: chatWidth, zIndex: 20 }}>
              {chatPanel}
            </div>
          )}
          {!dockRight && chatOpen && (
            <div
              className="absolute right-4"
              style={{ bottom: 140, width: 'min(340px, calc(100vw - 32px))', height: Math.max(160, H - tvBottom - 160), zIndex: 20 }}
            >
              {chatPanel}
            </div>
          )}
        </>
      )}

      {/* the camera swinging round: a quick stepped fade from black */}
      <div className="absolute inset-0 pointer-events-none watch-enter" style={{ background: '#0d0a0b', zIndex: 40 }} />
    </div>
  );
};
