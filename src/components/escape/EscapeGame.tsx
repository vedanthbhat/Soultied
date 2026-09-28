import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { UserProfile } from '../../types';
import { ROOMS, roomById } from '../../escape/rooms';
import type { RoomDef, RoomId, Side } from '../../escape/types';
import { viewOf } from '../../escape/types';
import { Channel, EscapeEvent, EscapeSave, Progress, formatTime, loadSave, localChannel, mergeProgress, storeSave } from '../../escape/sync';
import { sfx } from '../../escape/sfx';
import { AvatarThumb } from '../PixelAvatarRenderer';
import { SceneView } from './SceneView';
import { ClueCard } from './ClueCard';
import { LockPanel } from './LockPanel';
import { DoorSprite } from './Glyph';

type Screen = 'corridor' | 'door' | 'play';
type Mode = 'here' | 'online';
const other = (s: Side): Side => (s === 'a' ? 'b' : 'a');
const sameProgress = (a: Progress, b: Progress) =>
  a.room === b.room && a.step === b.step && a.finishedAt === b.finishedAt && JSON.stringify(a.hints) === JSON.stringify(b.hints);
const HINT_AFTER_MS = 30000;

interface ChatMsg {
  id: string;
  by: string;
  name: string;
  text: string;
}

/**
 * The dark door: a corridor of four escape rooms. Each room has two halves;
 * each of you plays one half and holds half of the clues.
 */
export const EscapeGame: React.FC<{ onExit: () => void }> = ({ onExit }) => {
  const { currentUser, partnerUser, space } = useApp();
  const me = currentUser.id;
  const spaceId = space?.id || 'solo';
  const creatorIsMe = !space || space.creatorId === me;
  const mySide: Side = creatorIsMe ? 'a' : 'b';
  const partnerName = partnerUser?.name || space?.partnerPlaceholderName || 'your person';
  const person = (side: Side): { name: string; user: UserProfile | null } =>
    side === mySide ? { name: currentUser.name, user: currentUser } : { name: partnerName, user: partnerUser };

  const [save, setSave] = useState<EscapeSave>(() => loadSave(spaceId));
  const [screen, setScreen] = useState<Screen>('corridor');
  const [roomId, setRoomId] = useState<RoomId>('attic');
  const [mode, setMode] = useState<Mode>('here');
  const [progress, setProgress] = useState<Progress | null>(null);
  const [partnerSeen, setPartnerSeen] = useState(0);
  const [partnerReady, setPartnerReady] = useState<RoomId | null>(null);
  const [meReady, setMeReady] = useState<RoomId | null>(null);
  const [open, setOpen] = useState<Record<Side, string | null>>({ a: null, b: null });
  const [fresh, setFresh] = useState<Record<Side, Set<string>>>({ a: new Set(), b: new Set() });
  const [log, setLog] = useState<string | null>(null);
  const [holds, setHolds] = useState<Record<Side, boolean>>({ a: false, b: false });
  const [holdProgress, setHoldProgress] = useState(0);
  const [viewSide, setViewSide] = useState<Side>(mySide);
  const [now, setNow] = useState(Date.now());
  const [activeSince, setActiveSince] = useState(Date.now());
  const [wide, setWide] = useState(() => window.innerWidth >= 980);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [draft, setDraft] = useState('');
  const [endingOpen, setEndingOpen] = useState(false);

  const room = roomById(roomId);
  const step = progress?.step ?? 0;
  const puzzle = room.puzzles[step];
  const partnerHere = !!partnerUser && now - partnerSeen < 12000;

  /* ---------- the line to the other device ---------- */
  const chanRef = useRef<Channel<EscapeEvent> | null>(null);
  const lastSent = useRef('');
  const send = useCallback((e: EscapeEvent) => chanRef.current?.send(e), []);
  const stateRef = useRef({ progress, meReady, screen, mode });
  stateRef.current = { progress, meReady, screen, mode };

  const startGame = useCallback(
    (id: RoomId, m: Mode, fromScratch = false) => {
      const saved = loadSave(spaceId).progress[id];
      const resume = !fromScratch && saved && !saved.finishedAt;
      const p: Progress = resume
        ? { ...saved, startedAt: saved.startedAt + (Date.now() - ((saved as Progress & { pausedAt?: number }).pausedAt || Date.now())) }
        : { room: id, step: 0, hints: {}, startedAt: Date.now() };
      setRoomId(id);
      setMode(m);
      setProgress(p);
      setOpen({ a: null, b: null });
      setFresh({ a: new Set(), b: new Set() });
      setLog(null);
      setEndingOpen(false);
      setHolds({ a: false, b: false });
      setActiveSince(Date.now());
      setScreen('play');
      if (m === 'online') send({ type: 'progress', by: me, progress: p, at: Date.now() });
    },
    [spaceId, send, me]
  );

  useEffect(() => {
    if (!partnerUser) return;
    const ch = localChannel<EscapeEvent>(`soultied-escape-${spaceId}`);
    chanRef.current = ch;
    const off = ch.subscribe((e) => {
      if (e.by === me) return;
      setPartnerSeen(Date.now());
      const st = stateRef.current;
      switch (e.type) {
        case 'hello':
          ch.send({ type: 'ready', by: me, room: st.meReady, at: Date.now() });
          if (st.screen === 'play' && st.mode === 'online' && st.progress) ch.send({ type: 'progress', by: me, progress: st.progress, at: Date.now() });
          break;
        case 'bye':
          setPartnerSeen(0);
          setPartnerReady(null);
          break;
        case 'ready':
          setPartnerReady(e.room);
          if (e.room && st.meReady === e.room && st.screen !== 'play') startGame(e.room, 'online');
          break;
        case 'progress':
          if (st.screen === 'play' && st.mode === 'online')
            setProgress((p) => {
              const m = mergeProgress(p, e.progress);
              return p && m && sameProgress(p, m) ? p : m;
            });
          break;
        case 'hold':
          setHolds((h) => ({ ...h, [e.side]: e.down }));
          break;
        case 'chat':
          setChat((c) => [...c.slice(-40), { id: e.id, by: e.by, name: e.name, text: e.text }]);
          break;
      }
    });
    ch.send({ type: 'hello', by: me, at: Date.now() });
    const ping = window.setInterval(() => ch.send({ type: 'ping', by: me, at: Date.now() }), 5000);
    const bye = () => ch.send({ type: 'bye', by: me, at: Date.now() });
    window.addEventListener('pagehide', bye);
    return () => {
      bye();
      window.removeEventListener('pagehide', bye);
      window.clearInterval(ping);
      off();
      ch.close();
      chanRef.current = null;
    };
  }, [spaceId, me, partnerUser, startGame]);

  // tell the partner which door I'm standing at
  useEffect(() => {
    send({ type: 'ready', by: me, room: meReady, at: Date.now() });
    if (meReady && partnerReady === meReady && screen !== 'play') startGame(meReady, 'online');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meReady]);

  /* ---------- clocks and layout ---------- */
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    const r = () => setWide(window.innerWidth >= 980);
    window.addEventListener('resize', r);
    return () => {
      window.clearInterval(t);
      window.removeEventListener('resize', r);
    };
  }, []);

  /* ---------- progress side effects ---------- */
  const prevStep = useRef<number | null>(null);
  useEffect(() => {
    if (!progress) {
      prevStep.current = null;
      return;
    }
    // remember it, and share it
    setSave((s) => {
      const next: EscapeSave = { ...s, progress: { ...s.progress, [progress.room]: progress } };
      if (progress.finishedAt) {
        const t = progress.finishedAt - progress.startedAt;
        const best = s.best[progress.room];
        next.best = { ...s.best, [progress.room]: best ? Math.min(best, t) : t };
      }
      storeSave(spaceId, next);
      return next;
    });
    const sig = JSON.stringify([progress.room, progress.step, progress.hints, progress.finishedAt]);
    if (mode === 'online' && sig !== lastSent.current) {
      lastSent.current = sig;
      send({ type: 'progress', by: me, progress, at: Date.now() });
    }

    const before = prevStep.current;
    prevStep.current = progress.step;
    if (before === null || progress.step <= before) return;
    // something just opened
    const solvedPuzzle = room.puzzles[progress.step - 1];
    setLog(solvedPuzzle.solved);
    setActiveSince(Date.now());
    setHolds({ a: false, b: false });
    if (solvedPuzzle.lock.kind === 'sequence') sfx.melody(solvedPuzzle.answer.split(',') as never);
    else sfx.open();
    setOpen((o) => {
      const n = { ...o };
      (['a', 'b'] as Side[]).forEach((s) => {
        const obj = room.objects.find((x) => x.id === o[s]);
        const v = obj && viewOf(obj, before);
        if (v?.puzzle === solvedPuzzle.id) n[s] = null;
      });
      return n;
    });
    setFresh((f) => {
      const n = { a: new Set(f.a), b: new Set(f.b) };
      room.objects.filter((o) => o.views.some((v) => v.from === progress.step)).forEach((o) => n[o.side].add(o.id));
      return n;
    });
    if (progress.step >= room.puzzles.length) {
      window.setTimeout(() => {
        sfx.win();
        setEndingOpen(true);
      }, 900);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress]);

  const solve = useCallback(
    (puzzleId: string) =>
      setProgress((p) => {
        if (!p) return p;
        const idx = room.puzzles.findIndex((x) => x.id === puzzleId);
        if (idx !== p.step) return p;
        const s = p.step + 1;
        return { ...p, step: s, finishedAt: s >= room.puzzles.length ? Date.now() : p.finishedAt };
      }),
    [room]
  );

  /* ---------- doing it together (hold at the same time) ---------- */
  useEffect(() => {
    if (!puzzle || puzzle.lock.kind !== 'together' || !(holds.a && holds.b)) {
      setHoldProgress(0);
      return;
    }
    const holdMs = puzzle.lock.holdMs;
    const start = performance.now();
    const id = window.setInterval(() => {
      const f = (performance.now() - start) / holdMs;
      setHoldProgress(Math.min(1, f));
      if (f >= 1) {
        window.clearInterval(id);
        solve(puzzle.id);
      }
    }, 50);
    return () => window.clearInterval(id);
  }, [holds.a, holds.b, puzzle, solve]);

  const setHold = useCallback(
    (side: Side, down: boolean) => {
      setHolds((h) => (h[side] === down ? h : { ...h, [side]: down }));
      if (mode === 'online') send({ type: 'hold', by: me, side, down, at: Date.now() });
    },
    [mode, send, me]
  );

  // one screen, two people: hold A and L on the keyboard
  useEffect(() => {
    if (screen !== 'play' || mode !== 'here' || puzzle?.lock.kind !== 'together') return;
    const key = (down: boolean) => (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'a') setHold('a', down);
      if (k === 'l') setHold('b', down);
    };
    const d = key(true);
    const u = key(false);
    window.addEventListener('keydown', d);
    window.addEventListener('keyup', u);
    return () => {
      window.removeEventListener('keydown', d);
      window.removeEventListener('keyup', u);
    };
  }, [screen, mode, puzzle, setHold]);

  /* ---------- leaving ---------- */
  const leaveRoom = () => {
    if (progress && !progress.finishedAt) {
      const paused = { ...progress, pausedAt: Date.now() } as Progress;
      const next = { ...save, progress: { ...save.progress, [progress.room]: paused } };
      storeSave(spaceId, next);
      setSave(next);
    }
    setProgress(null);
    setMeReady(null);
    setScreen('corridor');
  };

  const sendChat = (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim().slice(0, 200);
    if (!text) return;
    const msg: ChatMsg = { id: `${me}-${Date.now()}`, by: me, name: currentUser.name, text };
    setChat((c) => [...c.slice(-40), msg]);
    setDraft('');
    send({ type: 'chat', ...msg, at: Date.now() });
  };

  /* ======================= screens ======================= */

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-30 overflow-y-auto px-ui" style={{ background: 'radial-gradient(ellipse at top, #2a1f2a 0%, #140e11 70%)', color: '#efe3cb' }}>
      <style>{`
        @keyframes esc-pulse { 0%, 100% { outline-color: rgba(241,210,122,0); } 50% { outline-color: rgba(241,210,122,.9); } }
        .esc-fresh { outline: 3px dashed rgba(241,210,122,.9); outline-offset: 2px; animation: esc-pulse 1.2s steps(4) infinite; }
        @media (prefers-reduced-motion: reduce) { .esc-fresh { animation: none; } }
      `}</style>
      {children}
    </div>
  );

  /* ---------- the corridor of doors ---------- */
  if (screen === 'corridor') {
    return shell(
      <div className="mx-auto max-w-[1100px] px-4 py-6 flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button className="px-btn px-btn--paper px-btn--small" onClick={onExit}>
            ← Back to the living room
          </button>
          {partnerUser && (
            <span className="px-box px-2.5 py-1 text-sm flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 ${partnerHere ? 'bg-[var(--sage)]' : 'bg-[#b9a98f]'}`} />
              {partnerHere ? `${partnerName} is here too` : `${partnerName} isn’t here yet`}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-4xl font-bold m-0">The dark door</h1>
          <p className="m-0 mt-1 max-w-[640px] leading-snug opacity-85">
            Four rooms, two of you. Inside, each of you gets half of the room and half of the clues, so you’ll need to tell each other what you
            see. No timers chasing you, and hints whenever you’re stuck.
          </p>
        </div>
        {partnerReady && partnerHere && (
          <div className="px-box px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <span>
              <strong>{partnerName}</strong> is waiting at the door of <strong>{roomById(partnerReady).title}</strong>.
            </span>
            <button
              className="px-btn px-btn--sage"
              onClick={() => {
                setRoomId(partnerReady);
                setScreen('door');
                setMeReady(partnerReady);
              }}
            >
              Step in with them
            </button>
          </div>
        )}
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {ROOMS.map((r) => {
            const p = save.progress[r.id];
            const best = save.best[r.id];
            const status = best
              ? `Escaped in ${formatTime(best)}`
              : p && !p.finishedAt && p.step > 0
                ? `In progress: ${p.step} of ${r.puzzles.length} solved`
                : `${r.puzzles.length} puzzles · about ${r.minutes} min`;
            return (
              <button
                key={r.id}
                className="px-box text-left border-0 cursor-pointer p-4 flex flex-col gap-3 items-start"
                onClick={() => {
                  setRoomId(r.id);
                  setScreen('door');
                }}
              >
                <div className="w-full flex justify-center py-2" style={{ background: '#1d1518' }}>
                  <DoorSprite accent={r.accent} open={!!best} />
                </div>
                <div className="text-xs font-semibold tracking-[0.14em] uppercase" style={{ color: 'var(--terracotta-d)' }}>
                  {r.mood}
                </div>
                <div className="text-xl font-bold leading-tight -mt-2">{r.title}</div>
                <div className="leading-snug text-[var(--muted)] -mt-1">{r.tagline}</div>
                <div className="text-sm font-semibold">{status}</div>
                {partnerReady === r.id && partnerHere && <span className="px-tag px-tag--sage">{partnerName} is waiting here</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  /* ---------- standing at one door ---------- */
  if (screen === 'door') {
    const p = save.progress[room.id];
    const inProgress = !!p && !p.finishedAt && p.step > 0;
    const waiting = meReady === room.id;
    return shell(
      <div className="mx-auto max-w-[760px] px-4 py-6 flex flex-col gap-5">
        <button
          className="px-btn px-btn--paper px-btn--small self-start"
          onClick={() => {
            setMeReady(null);
            setScreen('corridor');
          }}
        >
          ← Back to the corridor
        </button>
        <div className="px-box px-shadow p-5 flex flex-col gap-4">
          <div className="flex items-start gap-4">
            <div className="shrink-0 p-2" style={{ background: '#1d1518' }}>
              <DoorSprite accent={room.accent} open={waiting} scale={3} />
            </div>
            <div>
              <div className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--terracotta-d)]">{room.mood}</div>
              <h2 className="text-3xl font-bold m-0 leading-tight">{room.title}</h2>
              <p className="m-0 text-[var(--muted)]">{room.tagline}</p>
            </div>
          </div>
          <p className="m-0 leading-relaxed">{room.intro}</p>
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {(['a', 'b'] as Side[]).map((s) => (
              <div key={s} className="px-inset px-3 py-2.5 flex items-center gap-3">
                {person(s).user && <AvatarThumb config={person(s).user!.avatar} region="head" size={34} />}
                <div className="leading-tight">
                  <div className="font-bold">
                    {person(s).name}: {room.sides[s].name}
                  </div>
                  <div className="text-sm text-[var(--muted)]">{room.sides[s].blurb}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="px-divider" />
          {inProgress && (
            <p className="m-0 text-sm">
              You’re {p!.step} of {room.puzzles.length} puzzles in. Carry on where you left off, or start over.
            </p>
          )}
          <div className="flex gap-3 flex-wrap">
            <button className="px-btn" onClick={() => startGame(room.id, 'here')}>
              {inProgress ? 'Continue' : 'Play'} on this screen
            </button>
            {partnerUser &&
              (waiting ? (
                <button className="px-btn px-btn--paper" onClick={() => setMeReady(null)}>
                  Stop waiting
                </button>
              ) : (
                <button className="px-btn px-btn--sage" onClick={() => setMeReady(room.id)}>
                  Play from two devices
                </button>
              ))}
            {inProgress && (
              <button className="px-btn px-btn--paper" onClick={() => startGame(room.id, 'here', true)}>
                Start over
              </button>
            )}
          </div>
          {waiting && (
            <p className="m-0 text-sm leading-snug" aria-live="polite">
              {partnerReady === room.id
                ? 'Opening the door…'
                : `Waiting for ${partnerName} to step in on their device. (Prototype: open Soultied in another tab, choose “View as ${partnerName}”, and go to the dark door.)`}
            </p>
          )}
          {!partnerUser && <p className="m-0 text-sm text-[var(--muted)]">Once {partnerName} moves in, you can play from two devices. For now, try both halves on this screen.</p>}
        </div>
      </div>
    );
  }

  /* ---------- inside the room ---------- */
  if (!progress) return null;
  const elapsed = (progress.finishedAt || now) - progress.startedAt;
  const hintN = puzzle ? progress.hints[puzzle.id] || 0 : 0;
  const hintReady = now - activeSince > HINT_AFTER_MS || hintN > 0;
  const sides: Side[] = mode === 'online' ? [mySide] : wide ? ['a', 'b'] : [viewSide];

  const panelFor = (side: Side) => {
    const obj = room.objects.find((o) => o.id === open[side]);
    if (!obj) return null;
    const v = viewOf(obj, step);
    if (!v) return null;
    let body: React.ReactNode;
    if (v.puzzle) {
      const idx = room.puzzles.findIndex((x) => x.id === v.puzzle);
      const pz = room.puzzles[idx];
      if (idx === step) {
        body = (
          <LockPanel
            key={`${pz.id}-${side}`}
            puzzle={pz}
            onSolve={() => solve(pz.id)}
            together={
              pz.lock.kind === 'together'
                ? {
                    mine: holds[side],
                    partner: holds[other(side)],
                    progress: holdProgress,
                    onHold: (d) => setHold(side, d),
                    partnerName: person(other(side)).name,
                    keyHint: mode === 'here' ? 'On one keyboard? Hold the A and L keys together.' : undefined,
                  }
                : undefined
            }
          />
        );
      } else body = <p className="m-0 leading-snug">{v.text || (idx < step ? 'It’s open now.' : 'Not yet. Something else comes first.')}</p>;
    } else if (v.clue) body = <ClueCard clue={v.clue} />;
    else body = <p className="m-0 leading-snug">{v.text}</p>;
    return (
      <div className="px-box px-shadow p-4 flex flex-col gap-2 px-pop" style={{ color: 'var(--ink-soft)' }}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold tracking-[0.12em] uppercase text-[var(--terracotta-d)]">{obj.label}</span>
          <button className="px-btn px-btn--paper px-btn--small" onClick={() => setOpen((o) => ({ ...o, [side]: null }))} aria-label="Close">
            ✕
          </button>
        </div>
        {body}
      </div>
    );
  };

  return shell(
    <div className="mx-auto max-w-[1500px] px-3 sm:px-4 py-3 flex flex-col gap-3">
      {/* top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button className="px-btn px-btn--paper px-btn--small" onClick={leaveRoom}>
          ← Leave
        </button>
        <div className="leading-tight mr-auto">
          <div className="text-xl font-bold">{room.title}</div>
          <div className="text-xs opacity-75">{mode === 'here' ? 'Both halves on this screen' : `You’re in ${room.sides[mySide].name.toLowerCase()}`}</div>
        </div>
        <div className="flex items-center gap-1.5" aria-label={`${step} of ${room.puzzles.length} solved`}>
          {room.puzzles.map((p, i) => (
            <span key={p.id} className="inline-block" style={{ width: 14, height: 14, background: i < step ? room.accent : '#3a2c33', boxShadow: 'inset 0 -3px 0 rgba(0,0,0,.3)' }} />
          ))}
        </div>
        <span className="px-box px-2 py-0.5 text-sm tabular-nums">{formatTime(elapsed)}</span>
        {mode === 'online' && (
          <span className="px-box px-2 py-0.5 text-sm flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 ${partnerHere ? 'bg-[var(--sage)]' : 'bg-[#b9a98f]'}`} />
            {partnerName}
          </span>
        )}
        <button
          className="px-btn px-btn--paper px-btn--small"
          onClick={() => {
            sfx.setMuted(!sfx.isMuted());
            setNow(Date.now());
          }}
          aria-label={sfx.isMuted() ? 'Turn sound on' : 'Mute sound'}
        >
          {sfx.isMuted() ? 'Sound off' : 'Sound on'}
        </button>
      </div>

      {/* what just happened + hints */}
      <div className="grid gap-3" style={{ gridTemplateColumns: wide ? '1fr auto' : '1fr' }}>
        <div className="px-box px-3.5 py-2.5 leading-snug" style={{ color: 'var(--ink-soft)' }} aria-live="polite" key={log || 'intro'}>
          {log ? <span className="px-fade block">{log}</span> : step === 0 ? <span>Look around and click on things. Tell each other what you find.</span> : null}
        </div>
        {puzzle && (
          <div className="px-box px-3 py-2 flex flex-col gap-1.5" style={{ color: 'var(--ink-soft)', maxWidth: wide ? 420 : undefined }}>
            {progress.hints[puzzle.id] ? (
              puzzle.hints.slice(0, hintN).map((h, i) => (
                <div key={i} className="text-sm leading-snug">
                  <strong>Hint {i + 1}:</strong> {h}
                </div>
              ))
            ) : (
              <div className="text-sm text-[var(--muted)]">Stuck? Hints unlock after a little while.</div>
            )}
            {hintN < 3 && (
              <button
                className="px-btn px-btn--paper px-btn--small self-start"
                disabled={!hintReady}
                onClick={() => setProgress((p) => (p ? { ...p, hints: { ...p.hints, [puzzle.id]: hintN + 1 } } : p))}
              >
                {hintN === 0 ? 'Get a hint' : hintN === 2 ? 'Show the answer' : 'Another hint'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* one screen, narrow: switch halves */}
      {mode === 'here' && !wide && (
        <div role="tablist" className="flex gap-1">
          {(['a', 'b'] as Side[]).map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={viewSide === s}
              className="px-btn px-btn--small"
              style={viewSide === s ? undefined : ({ '--bg': '#3a2c33', '--bg-d': '#241a1f', '--fg': '#efe3cb' } as React.CSSProperties)}
              onClick={() => setViewSide(s)}
            >
              {person(s).name} · {room.sides[s].name}
              {fresh[s].size > 0 && viewSide !== s && ' •'}
            </button>
          ))}
        </div>
      )}

      {/* the halves */}
      <div className="grid gap-4" style={{ gridTemplateColumns: sides.length === 2 ? '1fr 1fr' : '1fr' }}>
        {sides.map((s) => (
          <div key={s} className="flex flex-col gap-2 min-w-0" style={sides.length === 1 ? { maxWidth: 980, width: '100%', margin: '0 auto' } : undefined}>
            <div className="flex items-center gap-2">
              {person(s).user && <AvatarThumb config={person(s).user!.avatar} region="head" size={26} />}
              <span className="font-semibold">
                {person(s).name} <span className="opacity-70">· {room.sides[s].name}</span>
              </span>
            </div>
            <div style={{ boxShadow: '0 0 0 3px #0b0809, 6px 6px 0 3px rgba(0,0,0,.35)' }}>
              <SceneView
                room={room}
                side={s}
                step={step}
                selected={open[s]}
                fresh={fresh[s]}
                onObject={(id) => {
                  sfx.tick();
                  setOpen((o) => ({ ...o, [s]: o[s] === id ? null : id }));
                  setFresh((f) => {
                    if (!f[s].has(id)) return f;
                    const n = { ...f, [s]: new Set(f[s]) };
                    n[s].delete(id);
                    return n;
                  });
                }}
              />
            </div>
            {panelFor(s)}
          </div>
        ))}
      </div>

      {/* whispering, when you're on different devices */}
      {mode === 'online' && (
        <div className="px-box p-3 flex flex-col gap-2 max-w-[980px] w-full mx-auto" style={{ color: 'var(--ink-soft)' }}>
          <div className="text-sm font-semibold">Talk to {partnerName} (or hop on a call, it’s more fun)</div>
          <div className="flex flex-col gap-1 max-h-40 overflow-y-auto px-scroll text-sm">
            {chat.length === 0 && <span className="text-[var(--muted)]">Tell each other what you can see.</span>}
            {chat.map((m) => (
              <div key={m.id}>
                <strong>{m.by === me ? 'You' : m.name}:</strong> {m.text}
              </div>
            ))}
          </div>
          <form onSubmit={sendChat} className="flex gap-2">
            <input className="px-input text-sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="There’s a clock in here…" aria-label="Message" />
            <button className="px-btn px-btn--small shrink-0" type="submit">
              Send
            </button>
          </form>
        </div>
      )}

      {/* the ending */}
      {endingOpen && progress.finishedAt && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4" style={{ background: 'rgba(10,6,8,.72)' }}>
          <EndingCard
            room={room}
            time={progress.finishedAt - progress.startedAt}
            hints={Object.values(progress.hints).reduce((a, b) => a + b, 0)}
            onCorridor={() => {
              setEndingOpen(false);
              setProgress(null);
              setMeReady(null);
              setScreen('corridor');
            }}
            onHome={onExit}
          />
        </div>
      )}
    </div>
  );
};

const EndingCard: React.FC<{ room: RoomDef; time: number; hints: number; onCorridor: () => void; onHome: () => void }> = ({
  room,
  time,
  hints,
  onCorridor,
  onHome,
}) => (
  <div className="px-box px-shadow px-pop p-6 max-w-[560px] w-full flex flex-col gap-4" role="dialog" aria-modal="true" aria-label={room.ending.title} style={{ color: 'var(--ink-soft)' }}>
    <div className="flex items-center gap-4">
      <div className="p-2" style={{ background: '#1d1518' }}>
        <DoorSprite accent={room.accent} open scale={3} />
      </div>
      <div>
        <div className="text-xs font-semibold tracking-[0.14em] uppercase text-[var(--terracotta-d)]">You escaped {room.title.replace(/^The /, 'the ')}</div>
        <h2 className="text-3xl font-bold m-0 leading-tight">{room.ending.title}</h2>
      </div>
    </div>
    <p className="m-0 leading-relaxed">{room.ending.text}</p>
    <div className="flex gap-3 flex-wrap text-sm">
      <span className="px-inset px-2.5 py-1">Time: {formatTime(time)}</span>
      <span className="px-inset px-2.5 py-1">{hints === 0 ? 'No hints used' : `${hints} ${hints === 1 ? 'hint' : 'hints'} used`}</span>
    </div>
    <div className="flex gap-3 flex-wrap">
      <button className="px-btn" onClick={onCorridor}>
        Try another room
      </button>
      <button className="px-btn px-btn--paper" onClick={onHome}>
        Back to the living room
      </button>
    </div>
  </div>
);
