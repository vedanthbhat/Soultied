import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import * as store from '../../cloud/store';
import type { LiveChannel } from '../../cloud/live';
import { useGames } from '../../games/GamesContext';
import type { Match, Seat } from '../../games/types';
import { otherSeat } from '../../games/types';
import {
  BOT_WORDS,
  DH,
  DRAW_SECONDS,
  DW,
  DoodleCanvas,
  DoodleInk,
  DoodleState,
  INKS,
  InkOp,
  PAPER,
  ROUNDS,
  applyOps,
  blankCanvas,
  botStrokes,
  brushLine,
  fillCells,
  packCells,
  paint,
} from '../../games/doodle';
import { doodleChoose, doodleGuess, doodleJoin, doodleKeepDrawing, doodleNext, doodleScore, doodleStale, doodleTimeUp, newDoodle } from '../../games/registry';
import { sfx, tone } from '../../escape/sfx';
import { GameFrame } from './GameFrame';
import { PixelArt } from './Pixel';

/** Ink goes out a few times a second while you draw, and the whole page is saved every few seconds. */
const SEND_MS = 300;
const SAVE_MS = 2500;
/** the first letter shows up as a hint with this many seconds left */
const HINT_AT = 40;
/** if the person drawing has gone quiet, the guesser ends the round this long after time's up */
const GRACE_MS = 4000;

const localCanvasKey = (sid: string) => `soultied_doodle_canvas_${sid}`;

const INK_ORDER = ['k', 'r', 'y', 'g', 'b', 'p', 'n', 'w'];
const INK_NAMES: Record<string, string> = { k: 'black', r: 'red', y: 'yellow', g: 'green', b: 'blue', p: 'pink', n: 'brown', w: 'white' };
type Tool = 'pen' | 'fill' | 'erase';

/** A finished drawing, small. */
const Drawing: React.FC<{ pixels: string; scale?: number; label?: string }> = ({ pixels, scale = 3, label }) => (
  <PixelArt
    w={DW}
    h={DH}
    scale={scale}
    label={label}
    style={{ boxShadow: '0 0 0 2px #d8c7a4' }}
    deps={[pixels]}
    paint={(px) => {
      px(0, 0, DW, DH, PAPER);
      for (let i = 0; i < pixels.length; i++) if (pixels[i] !== '.' && INKS[pixels[i]]) px(i % DW, Math.floor(i / DW), 1, 1, INKS[pixels[i]]);
    }}
  />
);

/** "c _ _ _ _ _" — the word's shape, with the first letter once the hint is in. */
function shape(word: string, hint: boolean) {
  let first = true;
  return word
    .split('')
    .map((ch) => {
      if (ch === ' ') return ' ';
      const out = hint && first ? ch.toUpperCase() : '_';
      first = false;
      return out;
    })
    .join(' ');
}

export const DoodleGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { currentUser, space, openLive, cloudMode, cloudTarget, demo } = useApp();
  const { matches, save, mySeat, seatName, ready } = useGames();
  const raw = (matches.doodle as Match<DoodleState> | undefined) || null;
  /** the game under way (one left hanging for half an hour doesn't count) */
  const m = raw && raw.status !== 'over' && !doodleStale(raw) ? raw : null;
  /** the last finished game, for the look back */
  const over = raw && raw.status === 'over' ? raw : null;
  const st = m?.state;
  const them = otherSeat(mySeat);
  const partner = seatName(them);
  const me = currentUser.id;
  const sid = space?.id || 'solo';
  const phase = st ? st.phase : null;
  const iDraw = !!st && st.drawer === mySeat;
  const drawing = phase === 'drawing';
  const roundKey = m && st && st.round > 0 ? `${m.id}:${st.round}` : '';

  /* ---------- your pen ---------- */
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('k');
  const [size, setSize] = useState(1);
  const pending = useRef<Array<{ c: string; cells: number[] } | { c: string; all: true }>>([]);
  const dirty = useRef(false);
  const stroke = useRef<{ x: number; y: number } | null>(null);

  /* ---------- the canvas ---------- */
  const cvs = useRef<HTMLCanvasElement | null>(null);
  const pix = useRef(blankCanvas());
  const drawAll = useCallback(() => {
    const ctx = cvs.current?.getContext('2d');
    if (!ctx) return;
    const p = pix.current;
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, DW, DH);
    for (let i = 0; i < p.length; i++) {
      const c = INKS[p[i]];
      if (p[i] === '.' || !c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(i % DW, Math.floor(i / DW), 1, 1);
    }
  }, []);
  const drawCells = (cells: number[], key: string) => {
    const ctx = cvs.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = key === '.' ? PAPER : INKS[key];
    for (const i of cells) ctx.fillRect(i % DW, Math.floor(i / DW), 1, 1);
  };
  const setCanvas = useCallback(
    (el: HTMLCanvasElement | null) => {
      cvs.current = el;
      if (el) drawAll();
    },
    [drawAll]
  );

  /* ---------- what the person guessing sees: the last saved page, plus ink since ---------- */
  const roundRef = useRef<{ key: string; mid: string; r: number; drawer: boolean; startedAt: number }>({ key: '', mid: '', r: 0, drawer: false, startedAt: 0 });
  const base = useRef<{ n: number; pixels: string }>({ n: -1, pixels: blankCanvas() });
  const ink = useRef(new Map<string, Map<number, InkOp[]>>());
  const lastDoc = useRef<DoodleCanvas | null>(null);
  const nRef = useRef(0);
  const frame = useRef(0);

  const recompute = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const R = roundRef.current;
      if (!R.key || R.drawer) return;
      const got = ink.current.get(R.key);
      const b = base.current;
      const ns = got ? [...got.keys()].filter((n) => n > b.n).sort((x, y) => x - y) : [];
      let p = b.pixels;
      for (const n of ns) p = applyOps(p, got!.get(n)!);
      pix.current = p;
      drawAll();
    });
  }, [drawAll]);

  /** A saved page arrived (or was already here): the person drawing picks up where they were; the guesser lays it under the ink. */
  const takeDoc = useCallback(
    (d: DoodleCanvas | null) => {
      if (d) lastDoc.current = d;
      const R = roundRef.current;
      if (!d || !R.key || d.mid !== R.mid || d.r !== R.r || typeof d.pixels !== 'string' || d.pixels.length !== DW * DH) return;
      if (R.drawer) {
        // only when coming back to a round already under way, never over what you've drawn since
        if (d.n > nRef.current) {
          pix.current = d.pixels;
          nRef.current = d.n;
          drawAll();
        }
        return;
      }
      if (d.n <= base.current.n) return;
      base.current = { n: d.n, pixels: d.pixels };
      const got = ink.current.get(R.key);
      if (got) for (const n of [...got.keys()]) if (n <= d.n) got.delete(n);
      recompute();
    },
    [drawAll, recompute]
  );

  // a new round starts with a blank page
  useEffect(() => {
    if (!roundKey || !m || !st) {
      roundRef.current = { key: '', mid: '', r: 0, drawer: false, startedAt: 0 };
      return;
    }
    const R = roundRef.current;
    const drawer = st.drawer === mySeat;
    if (R.key === roundKey && R.drawer === drawer) {
      R.startedAt = st.startedAt || R.startedAt;
      return;
    }
    roundRef.current = { key: roundKey, mid: m.id, r: st.round, drawer, startedAt: st.startedAt || 0 };
    pix.current = blankCanvas();
    base.current = { n: -1, pixels: blankCanvas() };
    nRef.current = 0;
    pending.current = [];
    stroke.current = null;
    setTool('pen');
    for (const k of [...ink.current.keys()]) if (!k.startsWith(`${m.id}:`) || Number(k.split(':')[1]) < st.round) ink.current.delete(k);
    drawAll();
    if (!cloudMode) {
      try {
        const saved = localStorage.getItem(localCanvasKey(sid));
        if (saved) lastDoc.current = JSON.parse(saved) as DoodleCanvas;
      } catch {
        // ignore
      }
    }
    takeDoc(lastDoc.current);
    recompute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey, st?.drawer, st?.startedAt, mySeat]);

  // the saved page, when online
  useEffect(() => {
    if (!cloudMode) return;
    const o = cloudTarget();
    if (!o) return;
    return store.subscribeDoodleCanvas(o.db, o.sid, takeDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudMode, sid, takeDoc]);

  // the live line: ink as it's drawn
  const chan = useRef<LiveChannel<DoodleInk> | null>(null);
  useEffect(() => {
    if (!ready) return;
    const ch = openLive<DoodleInk>('doodle');
    chan.current = ch;
    const off = ch.subscribe((e) => {
      if (e.by === me || !e.mid || typeof e.n !== 'number' || !Array.isArray(e.ops)) return;
      const key = `${e.mid}:${e.r}`;
      let got = ink.current.get(key);
      if (!got) ink.current.set(key, (got = new Map()));
      got.set(e.n, e.ops);
      if (key === roundRef.current.key) recompute();
    });
    return () => {
      off();
      ch.close();
      chan.current = null;
    };
  }, [openLive, ready, me, recompute]);

  /* ---------- drawing ---------- */
  const put = (cells: number[], key: string) => {
    if (!cells.length) return;
    pix.current = paint(pix.current, cells, key);
    drawCells(cells, key);
    const q = pending.current;
    const top = q[q.length - 1];
    if (top && 'cells' in top && top.c === key) top.cells.push(...cells);
    else q.push({ c: key, cells: [...cells] });
  };

  const flush = useCallback(() => {
    const R = roundRef.current;
    const ch = chan.current;
    if (!R.drawer || !R.key || !pending.current.length) return;
    const ops: InkOp[] = pending.current.map((o) => ('all' in o ? { c: o.c, s: '*' } : { c: o.c, s: packCells([...new Set(o.cells)]) }));
    pending.current = [];
    // counts up through the round, and keeps counting up if you reload halfway through
    nRef.current = Math.max(nRef.current + 1, Date.now() - (R.startedAt || Date.now()));
    ch?.send({ by: me, at: Date.now(), mid: R.mid, r: R.r, n: nRef.current, ops });
    dirty.current = true;
  }, [me]);

  const saveCanvas = useCallback(() => {
    const R = roundRef.current;
    if (!R.drawer || !R.key || !dirty.current) return;
    dirty.current = false;
    const doc: DoodleCanvas = { mid: R.mid, r: R.r, n: nRef.current, pixels: pix.current };
    lastDoc.current = doc;
    const o = cloudMode ? cloudTarget() : null;
    if (o) store.writeDoodleCanvas(o.db, o.sid, doc).catch((err) => console.warn('[soultied] doodle', err));
    else
      try {
        localStorage.setItem(localCanvasKey(sid), JSON.stringify(doc));
      } catch {
        // ignore
      }
  }, [cloudMode, cloudTarget, sid]);

  useEffect(() => {
    if (!(drawing && iDraw)) return;
    const a = window.setInterval(flush, SEND_MS);
    const b = window.setInterval(saveCanvas, SAVE_MS);
    return () => {
      window.clearInterval(a);
      window.clearInterval(b);
      flush();
      saveCanvas();
    };
  }, [drawing, iDraw, flush, saveCanvas]);

  const cellAt = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) / r.width) * DW);
    const y = Math.floor(((e.clientY - r.top) / r.height) * DH);
    return { x: Math.max(0, Math.min(DW - 1, x)), y: Math.max(0, Math.min(DH - 1, y)) };
  };
  const inkKey = tool === 'erase' ? '.' : color;
  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!(drawing && iDraw)) return;
    e.preventDefault();
    const p = cellAt(e);
    if (tool === 'fill') {
      const cells = fillCells(pix.current, p.y * DW + p.x);
      if (pix.current[p.y * DW + p.x] !== color) put(cells, color);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    stroke.current = p;
    put(brushLine(p.x, p.y, p.x, p.y, tool === 'erase' ? Math.max(2, size) : size), inkKey);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const s = stroke.current;
    if (!s || !(drawing && iDraw)) return;
    const p = cellAt(e);
    if (p.x === s.x && p.y === s.y) return;
    put(brushLine(s.x, s.y, p.x, p.y, tool === 'erase' ? Math.max(2, size) : size), inkKey);
    stroke.current = p;
  };
  const onUp = () => {
    stroke.current = null;
  };
  const clearPage = () => {
    pix.current = blankCanvas();
    drawAll();
    pending.current.push({ c: '.', all: true });
  };

  /* ---------- the demo room's partner draws too ---------- */
  useEffect(() => {
    if (!demo || !drawing || iDraw || !m || !st?.word) return;
    const key = Object.keys(BOT_WORDS).find((k) => BOT_WORDS[k] === st.word) || 'sun';
    const strokes = botStrokes(key);
    const order = [...new Set(strokes.map(([, c]) => c))];
    strokes.sort((a, b) => order.indexOf(a[1]) - order.indexOf(b[1]) || a[0] - b[0]);
    const rk = `${m.id}:${st.round}`;
    let i = 0;
    let n = 0;
    const t = window.setInterval(() => {
      if (i >= strokes.length) return window.clearInterval(t);
      const bit = strokes.slice(i, i + 4);
      i += 4;
      let got = ink.current.get(rk);
      if (!got) ink.current.set(rk, (got = new Map()));
      got.set(++n, bit.map(([cell, c]) => ({ c, s: packCells([cell]) })));
      recompute();
    }, 130);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demo, drawing, iDraw, m?.id, st?.round, st?.word, recompute]);

  /* ---------- the clock ---------- */
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!drawing) return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [drawing]);
  const left = drawing && st?.endsAt ? Math.max(0, Math.ceil((st.endsAt - now) / 1000)) : DRAW_SECONDS;
  const ended = useRef('');
  useEffect(() => {
    if (!drawing || !m || !st?.endsAt) return;
    const late = now - st.endsAt;
    // whoever's drawing calls time; the guesser does if they've gone quiet (or it's the demo room's partner)
    if (late < 0 || (!iDraw && !demo && late < GRACE_MS)) return;
    const k = `${m.id}:${st.round}`;
    if (ended.current === k) return;
    ended.current = k;
    if (iDraw) flush();
    const next = doodleTimeUp(m, pix.current);
    if (next) save(next);
  }, [now, drawing, m, st, iDraw, demo, flush, save]);

  /* ---------- guessing ---------- */
  const [text, setText] = useState('');
  const [said, setSaid] = useState<{ verdict: 'right' | 'close' | 'wrong'; text: string } | null>(null);
  useEffect(() => setSaid(null), [roundKey]);
  const guess = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!m || !drawing || iDraw) return;
    const r = doodleGuess(m, mySeat, text, pix.current);
    if (!r) return;
    save(r.match);
    setSaid({ verdict: r.verdict, text: text.trim() });
    setText('');
    if (r.verdict === 'close') tone(660, 0.1, 0, 'triangle', 0.05);
    else if (r.verdict === 'wrong') tone(300, 0.08, 0, 'triangle', 0.04);
  };

  /* ---------- moving things along ---------- */
  // you came to play: say you're here
  const joinedFor = useRef('');
  useEffect(() => {
    if (!m || !ready || phase !== 'lobby' || st!.joined[mySeat] || joinedFor.current === m.id) return;
    joinedFor.current = m.id;
    const next = doodleJoin(m, mySeat);
    if (next) save(next);
  }, [m, ready, phase, st, mySeat, save]);

  // the round's picture stays with it for the look back at the end
  const kept = useRef('');
  useEffect(() => {
    if (!m || phase !== 'reveal' || !st) return;
    const r = st.rounds[st.rounds.length - 1];
    if (!r) return;
    const k = `${m.id}:${st.round}`;
    if (r.pixels && r.pixels !== pix.current && roundRef.current.key === k && !iDraw) {
      // show what was kept, if we saw less of it
      pix.current = r.pixels;
      drawAll();
    }
    if (iDraw && !r.pixels && roundRef.current.key === k && kept.current !== k) {
      kept.current = k;
      const next = doodleKeepDrawing(m, pix.current);
      if (next) save(next);
    }
  }, [m, phase, st, iDraw, drawAll, save]);

  // sounds as things happen
  const heard = useRef<{ id: string; round: number; phase: string; guesses: number } | null>(null);
  useEffect(() => {
    const g = raw;
    if (!g) return;
    const now = { id: g.id, round: g.state.round, phase: g.status === 'over' ? 'over' : g.state.phase, guesses: g.state.guesses.length };
    const was = heard.current;
    heard.current = now;
    if (!was || was.id !== now.id) return;
    if (now.phase === 'over' && was.phase !== 'over') return sfx.win();
    if (now.phase === 'reveal' && was.phase !== 'reveal') {
      const r = g.state.rounds[g.state.rounds.length - 1];
      return r?.secs ? sfx.open() : sfx.wrong();
    }
    if (now.phase === 'drawing' && g.state.drawer === mySeat && now.guesses > was.guesses) {
      const last = g.state.guesses[g.state.guesses.length - 1];
      if (last && last.by !== mySeat) tone(last.close ? 660 : 440, 0.08, 0, 'triangle', 0.04);
    }
  }, [raw, mySeat]);

  const start = () => save(newDoodle(mySeat, raw?.state.best || 0));

  /* ---------- words on screen ---------- */
  const score = st ? doodleScore(st) : 0;
  const lastRound = st?.rounds[st.rounds.length - 1];
  const drawerName = st ? seatName(st.drawer) : '';
  const guesserName = st ? seatName(otherSeat(st.drawer)) : '';
  const hint = drawing && !iDraw && left <= HINT_AT;

  let status: React.ReactNode;
  if (!ready) status = <>Doodle Guess needs two. Once {partner} has joined your place, you can play it here.</>;
  else if (!m) {
    const got = over ? doodleScore(over.state) : 0;
    status = over ? (
      <>
        <strong>
          You guessed {got} of {ROUNDS} together.
        </strong>{' '}
        {got > 0 && got >= over.state.best ? 'Your best yet!' : `Your best is ${over.state.best} of ${ROUNDS}.`}
      </>
    ) : (
      <>
        One of you draws, the other guesses, then you swap. {ROUNDS} drawings, {DRAW_SECONDS} seconds each. You’re on the same team, so see how many you can get.
      </>
    );
  } else if (phase === 'lobby')
    status = (
      <>
        Waiting for <strong>{partner}</strong> to join. They’ll see a note in the living room, or you can tell them to open Games.
      </>
    );
  else if (phase === 'choosing')
    status = iDraw ? (
      <>
        <strong>Your turn to draw.</strong> Pick one. {partner} won’t see which.
      </>
    ) : (
      <>
        <strong>{partner}</strong> is picking something to draw…
      </>
    );
  else if (phase === 'drawing')
    status = iDraw ? (
      <>
        Draw <strong>{st!.word}</strong> for {partner}. No letters or numbers!
      </>
    ) : (
      <>
        What is <strong>{partner}</strong> drawing? Type your guesses below.
      </>
    );
  else if (phase === 'reveal')
    status = lastRound?.secs ? (
      <>
        <strong>{guesserName === seatName(mySeat) ? 'You' : guesserName} got it</strong> in {lastRound.secs} seconds. It was <strong>{lastRound.word}</strong>.
      </>
    ) : (
      <>
        It was <strong>{lastRound?.word}</strong>. {m.last === 'skipped that one' ? 'Skipped.' : 'Out of time.'}
      </>
    );

  const coopNote = (s: Seat) => {
    if (!m || !st) return '';
    if (st.phase === 'lobby') return st.joined[s] ? 'here' : 'not here yet';
    if (st.phase === 'reveal') return '';
    return st.drawer === s ? 'drawing' : 'guessing';
  };

  /** the word's blanks and the guess box: under the drawing on a phone, beside it on a bigger screen */
  const guessArea = (where: 'under' | 'beside') =>
    drawing && !iDraw && st?.word ? (
      <div className={`${where === 'under' ? 'flex md:hidden mt-2' : 'hidden md:flex'} flex-col gap-2`}>
        <div className="px-box px-3 py-2 text-center" style={{ color: 'var(--ink-soft)' }}>
          <div className="text-2xl font-bold tracking-wider" aria-label={`${st.word.replace(/ /g, '').length} letters${hint ? `, starts with ${st.word[0]}` : ''}`}>
            {shape(st.word, hint)}
          </div>
          <div className="text-xs text-[var(--muted)]" aria-hidden="true">
            {st.word.replace(/ /g, '').length} letters{st.word.includes(' ') ? `, ${st.word.split(' ').length} words` : ''}
            {!hint && ` · first letter at ${HINT_AT}s`}
          </div>
        </div>
        <form className="flex gap-2" onSubmit={guess}>
          <input
            className="px-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Your guess"
            maxLength={40}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Your guess"
            autoFocus={where === 'beside' && typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches}
          />
          <button className="px-btn px-btn--sage" type="submit" disabled={!text.trim()}>
            Guess
          </button>
        </form>
        {said && said.verdict !== 'right' && (
          <div className="text-sm font-semibold" role="status">
            {said.verdict === 'close' ? `“${said.text}” is so close!` : `Not “${said.text}”.`}
          </div>
        )}
      </div>
    ) : null;

  const canvasBox = (
    <div className="flex flex-col gap-2 min-w-0">
      {st && st.round > 0 && (
        <div className="flex flex-col gap-1 mb-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span>
              <strong>
                Drawing {st.round} of {ROUNDS}
              </strong>
              <span className="opacity-75"> · {score} guessed</span>
            </span>
            {drawing && <span className={left <= 10 ? 'font-bold' : ''}>{left}s left</span>}
          </div>
          <div className="h-2 w-full" style={{ background: 'rgba(239,227,203,.15)' }} aria-hidden="true">
            <div
              className="h-full"
              style={{ width: `${drawing ? (left / DRAW_SECONDS) * 100 : phase === 'choosing' ? 100 : 0}%`, background: left <= 10 ? '#c4453f' : '#8fb06a', transition: 'width .25s steps(2)' }}
            />
          </div>
        </div>
      )}
      <div className="relative" style={{ boxShadow: '0 0 0 4px #b48c4a, 0 0 0 8px #6b4633' }}>
        <canvas
          ref={setCanvas}
          width={DW}
          height={DH}
          className="pixelated block w-full"
          style={{ aspectRatio: `${DW} / ${DH}`, touchAction: drawing && iDraw ? 'none' : undefined, cursor: drawing && iDraw ? 'crosshair' : 'default' }}
          role="img"
          aria-label={drawing ? (iDraw ? `Your drawing of ${st?.word}` : `${partner}’s drawing`) : 'The drawing'}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {phase === 'choosing' && (
          <div className="absolute inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(244,232,208,.9)', color: 'var(--ink)' }}>
            {iDraw ? (
              <div className="flex flex-col gap-2 w-full max-w-[320px]">
                {st!.choices.map((w) => (
                  <button
                    key={w}
                    className="px-option px-option--big font-bold text-xl"
                    onClick={() => {
                      const next = m && doodleChoose(m, mySeat, w);
                      if (next) save(next);
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-xl font-bold text-center game-blink">{partner} is choosing…</div>
            )}
          </div>
        )}
        {phase === 'reveal' && lastRound && (
          <div className="absolute left-0 right-0 bottom-0 flex justify-center p-3 pointer-events-none">
            <span className="px-box px-4 py-1.5 text-2xl font-bold" style={{ color: 'var(--ink)' }}>
              {lastRound.word}
            </span>
          </div>
        )}
      </div>
      {guessArea('under')}
      {drawing && iDraw && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-box px-3 py-3 mt-2" style={{ color: 'var(--ink-soft)' }}>
          <div className="flex flex-wrap gap-2.5" role="group" aria-label="Ink">
            {INK_ORDER.map((k) => (
              <button
                key={k}
                className="px-swatch"
                style={{ background: INKS[k] }}
                aria-label={INK_NAMES[k]}
                aria-pressed={tool !== 'erase' && color === k}
                onClick={() => {
                  setColor(k);
                  if (tool === 'erase') setTool('pen');
                }}
              />
            ))}
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Tool">
            {(
              [
                ['pen', 'Pen'],
                ['fill', 'Fill'],
                ['erase', 'Rubber'],
              ] as const
            ).map(([t, label]) => (
              <button key={t} className={`px-btn px-btn--small ${tool === t ? 'px-btn--ink' : 'px-btn--paper'}`} aria-pressed={tool === t} onClick={() => setTool(t)}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5" role="group" aria-label="Brush size">
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                className={`px-btn px-btn--small ${size === s ? 'px-btn--ink' : 'px-btn--paper'}`}
                aria-pressed={size === s}
                aria-label={['Thin', 'Medium', 'Thick'][s - 1]}
                onClick={() => setSize(s)}
              >
                <span className="inline-block align-middle" style={{ width: 4 + s * 3, height: 4 + s * 3, background: 'currentColor' }} />
              </button>
            ))}
          </div>
          <button className="px-btn px-btn--paper px-btn--small ml-auto" onClick={clearPage}>
            Clear
          </button>
        </div>
      )}
    </div>
  );

  const side = st && (phase === 'drawing' || phase === 'reveal' || phase === 'choosing') && (
    <div className="flex flex-col gap-3 min-w-0">
      {drawing && iDraw && (
        <div className="px-box px-3 py-2.5 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <strong>{st.word}</strong> is yours to draw. With {HINT_AT} seconds left, {partner} gets the first letter as a hint.
        </div>
      )}
      {phase === 'choosing' && (
        <div className="px-box px-3 py-2.5 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {iDraw ? `${partner} will have ${DRAW_SECONDS} seconds to guess it.` : `You’ll have ${DRAW_SECONDS} seconds to guess.`} Then you swap.
        </div>
      )}
      {guessArea('beside')}

      {st.guesses.length > 0 && (phase === 'drawing' || phase === 'reveal') && (
        <div className="px-box px-3 py-2 flex flex-col gap-1 text-sm" style={{ color: 'var(--ink-soft)' }} aria-label="Guesses">
          {st.guesses
            .slice(-6)
            .reverse()
            .map((g, i) => (
              <div key={`${st.guesses.length - i}`} className="flex justify-between gap-2">
                <span className="truncate">
                  <span className="text-[var(--muted)]">{seatName(g.by)}:</span> {g.text}
                </span>
                {g.right ? <span className="font-bold">✓</span> : g.close ? <span className="text-[var(--muted)]">close</span> : null}
              </div>
            ))}
        </div>
      )}

      {drawing && (
        <button
          className="px-btn px-btn--paper px-btn--small self-start"
          onClick={() => {
            if (!m) return;
            if (iDraw) flush();
            const next = doodleTimeUp(m, pix.current, true);
            if (next) save(next);
          }}
        >
          {iDraw ? 'Too hard? Skip it' : 'Give up on this one'}
        </button>
      )}
      {phase === 'reveal' && (
        <button
          className="px-btn px-btn--sage self-start"
          onClick={() => {
            const next = m && doodleNext(m);
            if (next) save(next);
          }}
        >
          {st.round >= ROUNDS ? 'See how you did' : `Next drawing (${seatName(otherSeat(st.drawer)) === seatName(mySeat) ? 'you draw' : `${seatName(otherSeat(st.drawer))} draws`})`}
        </button>
      )}
    </div>
  );

  return (
    <GameFrame
      title="Doodle Guess"
      onBack={onBack}
      match={raw}
      status={status}
      width={1020}
      coop={{ active: st && (phase === 'choosing' || phase === 'drawing') ? st.drawer : null, note: coopNote }}
      actions={
        ready && !m ? (
          <button className="px-btn px-btn--sage" onClick={start}>
            {over ? 'Play again' : 'Start a game'}
          </button>
        ) : null
      }
    >
      {m && phase && phase !== 'lobby' ? (
        <div className="flex flex-wrap gap-5 items-start">
          <div className="min-w-0" style={{ flex: '2 1 460px' }}>
            {canvasBox}
          </div>
          <div className="min-w-0" style={{ flex: '1 1 260px' }}>
            {side}
          </div>
        </div>
      ) : !m && over && over.state.rounds.length > 0 ? (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {over.state.rounds.map((r, i) => (
            <figure key={i} className="px-box m-0 p-2 flex flex-col gap-1.5 items-center" style={{ color: 'var(--ink-soft)' }}>
              {r.pixels ? (
                <Drawing pixels={r.pixels} scale={3} label={`${seatName(r.drawer)}’s drawing of ${r.word}`} />
              ) : (
                <div style={{ width: DW * 3, height: DH * 3, background: PAPER, boxShadow: '0 0 0 2px #d8c7a4' }} />
              )}
              <figcaption className="text-center leading-tight">
                <strong>{r.word}</strong>
                <div className="text-xs text-[var(--muted)]">
                  by {seatName(r.drawer)} · {r.secs ? `got it in ${r.secs}s` : 'not this time'}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : m && phase === 'lobby' ? (
        <div className="flex justify-center py-6">
          <Drawing pixels={blankCanvas()} scale={4} />
        </div>
      ) : null}
    </GameFrame>
  );
};
