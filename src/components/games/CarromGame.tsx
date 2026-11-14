import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useGames } from '../../games/GamesContext';
import type { Match, Seat } from '../../games/types';
import { otherSeat } from '../../games/types';
import {
  BASELINE,
  BASE_MAX,
  BASE_MIN,
  COINS,
  CarromState,
  POCKETS,
  POCKET_R,
  R_COIN,
  R_STRIKER,
  coinKind,
  emptyCarrom,
  forward,
  seatKind,
  simulate,
  strikerFits,
  sunkCount,
} from '../../games/carrom';
import { carromShot, newCarrom } from '../../games/registry';
import { sfx, tone } from '../../escape/sfx';
import { GameFrame } from './GameFrame';

/** the board is drawn small and shown big, so everything's in crisp pixels */
const PX = 2.4;
const SIZE = 100 * PX;
const COIN_PAL = {
  w: ['#fbf3e2', '#d9c6a1', '#8a7a5a'],
  b: ['#4a3428', '#2a1c14', '#8a6650'],
  q: ['#d4473c', '#9a2a22', '#f08a7a'],
  s: ['#cfe3ea', '#8fb3c2', '#ffffff'],
};

/** a disc of pixels; `pal` is body, rim, light */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, pal: string[]) {
  const x0 = Math.round(cx * PX);
  const y0 = Math.round(cy * PX);
  const rp = r * PX;
  const R = Math.ceil(rp);
  for (let y = -R; y <= R; y++)
    for (let x = -R; x <= R; x++) {
      const d = x * x + y * y;
      if (d > rp * rp) continue;
      ctx.fillStyle = d > (rp - 1.2) * (rp - 1.2) ? pal[1] : x + y < -rp * 0.6 && d < rp * rp * 0.4 ? pal[2] : pal[0];
      ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
}

function drawBoard(ctx: CanvasRenderingContext2D, flip: boolean) {
  const f = (v: number) => (flip ? 100 - v : v);
  ctx.fillStyle = '#e9cf9c';
  ctx.fillRect(0, 0, SIZE, SIZE);
  // the grain
  ctx.fillStyle = 'rgba(160,110,60,.10)';
  for (let y = 3; y < SIZE; y += 7) ctx.fillRect(0, y, SIZE, 1);
  // the baselines (two lines each, with a red dot at the ends)
  for (const s of ['a', 'b'] as Seat[]) {
    for (const off of [-R_STRIKER, R_STRIKER]) {
      ctx.fillStyle = '#5a3a24';
      ctx.fillRect(Math.round(BASE_MIN * PX), Math.round(f(BASELINE[s] + off) * PX), Math.round((BASE_MAX - BASE_MIN) * PX), 1);
    }
    for (const x of [BASE_MIN, BASE_MAX]) disc(ctx, x, f(BASELINE[s]), R_STRIKER, ['#c4453f', '#5a3a24', '#e07a5f']);
  }
  // the middle: two rings
  for (const [r, c] of [
    [15, '#5a3a24'],
    [14.3, '#e9cf9c'],
    [6, '#c4453f'],
    [5.3, '#e9cf9c'],
  ] as Array<[number, string]>) {
    ctx.fillStyle = c;
    const R = r * PX;
    for (let y = -R; y <= R; y++) {
      const w = Math.sqrt(R * R - y * y);
      ctx.fillRect(Math.round(50 * PX - w), Math.round(50 * PX + y), Math.round(w * 2), 1);
    }
  }
  // the arrows in from the corners
  ctx.fillStyle = '#5a3a24';
  for (let k = 0; k < 18 * PX; k++)
    for (const [sx, sy] of [
      [1, 1],
      [-1, 1],
      [1, -1],
      [-1, -1],
    ]) {
      const t = 12 * PX + k;
      ctx.fillRect(Math.round(sx > 0 ? t : SIZE - t), Math.round(sy > 0 ? t : SIZE - t), 1, 1);
    }
  // the pockets
  for (const [qx, qy] of POCKETS) disc(ctx, qx, qy, POCKET_R + 0.4, ['#1b1411', '#3b2a1e', '#1b1411']);
}

export const CarromGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { matches, save, mySeat, seatName } = useGames();
  const m = (matches.carrom as Match<CarromState> | undefined) || null;
  const them = otherSeat(mySeat);
  const partner = seatName(them);
  const st = m?.state ?? emptyCarrom(mySeat);
  const myTurn = m?.status === 'playing' && m.turn === mySeat;
  const flip = mySeat === 'b';
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [x, setX] = useState(50);
  const [aim, setAim] = useState<{ dx: number; dy: number; power: number } | null>(null);
  /** the shot being played out: its frames and how far along */
  const [play, setPlay] = useState<{ frames: number[][]; i: number } | null>(null);
  const heard = useRef('');
  const raf = useRef(0);

  // a fresh shot (yours or theirs): play it out, then settle on how it ended
  useEffect(() => {
    if (!m) return;
    const key = `${m.id}:${m.seq}`;
    if (heard.current === key) return;
    const first = !heard.current || heard.current.split(':')[0] !== m.id;
    heard.current = key;
    cancelAnimationFrame(raf.current);
    const shot = m.state.shot;
    if (first || !shot) {
      setPlay(null);
      return;
    }
    const sim = simulate(shot.xs, shot.ys, shot.by, shot.x, shot.dx, shot.dy, shot.power, 4);
    tone(220, 0.08, 0, 'square', 0.06);
    const t0 = performance.now();
    let sunkSeen = 0;
    const tick = () => {
      const i = Math.min(sim.frames.length - 1, Math.floor(((performance.now() - t0) / 1000) * 60));
      const fr = sim.frames[i];
      let gone = 0;
      for (let k = 2; k < fr.length; k += 2) if (fr[k] < 0) gone++;
      const before = shot.xs.filter((v) => v < 0).length;
      if (gone - before > sunkSeen) {
        sunkSeen = gone - before;
        [330, 262].forEach((f, j) => tone(f, 0.08, j * 0.06, 'triangle', 0.06));
      }
      setPlay({ frames: sim.frames, i });
      if (i < sim.frames.length - 1) raf.current = requestAnimationFrame(tick);
      else {
        setPlay(null);
        if (m.status === 'over') {
          if (m.winner === mySeat) sfx.win();
          else sfx.wrong();
        }
      }
    };
    raf.current = requestAnimationFrame(tick);
  }, [m, mySeat]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  // keep the striker somewhere it fits
  const fits = strikerFits(st, mySeat, x);
  useEffect(() => {
    if (!myTurn || fits) return;
    for (let d = 0; d <= 62; d += 1) for (const s of [x + d, x - d]) if (strikerFits(st, mySeat, s)) return setX(Math.round(s * 10) / 10);
  }, [myTurn, fits, st, mySeat, x]);

  // draw
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    drawBoard(ctx, flip);
    const f = (v: number) => (flip ? 100 - v : v);
    const fr = play ? play.frames[play.i] : null;
    for (let i = 0; i < COINS; i++) {
      const cx = fr ? fr[2 + i * 2] : st.xs[i];
      const cy = fr ? fr[3 + i * 2] : st.ys[i];
      if (cx < 0) continue;
      disc(ctx, f(cx), f(cy), R_COIN, COIN_PAL[coinKind(i)]);
    }
    if (fr) {
      if (fr[0] >= 0) disc(ctx, f(fr[0]), f(fr[1]), R_STRIKER, COIN_PAL.s);
    } else if (myTurn) {
      // where you'll shoot from, and which way
      if (aim) {
        ctx.fillStyle = 'rgba(58,42,38,.55)';
        const len = 8 + aim.power * 30;
        for (let k = 4; k < len; k += 1.6) ctx.fillRect(Math.round(f(x + aim.dx * k) * PX), Math.round(f(BASELINE[mySeat] + aim.dy * k) * PX), 2, 2);
      }
      disc(ctx, f(x), f(BASELINE[mySeat]), R_STRIKER, fits ? COIN_PAL.s : ['#e9a58d', '#c4453f', '#ffffff']);
    }
  }, [st, play, aim, x, myTurn, flip, mySeat, fits]);

  // aiming: press anywhere on the board, pull back away from where you want it to go, and let go
  const drag = useRef<{ id: number } | null>(null);
  const toBoard = (e: React.PointerEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const bx = ((e.clientX - r.left) / r.width) * 100;
    const by = ((e.clientY - r.top) / r.height) * 100;
    return flip ? [100 - bx, 100 - by] : [bx, by];
  };
  const onDown = (e: React.PointerEvent) => {
    if (!myTurn || play || !fits) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId };
    onMove(e);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const [bx, by] = toBoard(e);
    const ex = x - bx;
    const ey = BASELINE[mySeat] - by;
    const d = Math.sqrt(ex * ex + ey * ey);
    if (d < 2) return setAim(null);
    setAim({ dx: ex / d, dy: ey / d, power: Math.min(1, Math.max(0.05, (d - 2) / 34)) });
  };
  const onUp = () => {
    if (!drag.current) return;
    drag.current = null;
    const a = aim;
    setAim(null);
    if (!m || !a || !forward(mySeat, a.dy)) return;
    const next = carromShot(m, mySeat, x, a.dx, a.dy, a.power);
    if (next) save(next);
  };

  const start = () => save(newCarrom(m && m.status === 'over' ? otherSeat(m.startedBy) : mySeat, m?.wins));
  const mine = seatKind(st, mySeat);
  const queenLine =
    st.queen === 'board' ? 'on the board' : st.queen === mySeat ? 'yours' : st.queen === them ? `${partner}’s` : st.queen === `pending-${mySeat}` ? 'sunk: cover her!' : `sunk by ${partner}`;

  let status: React.ReactNode;
  if (!m) status = <>Flick the striker and sink your nine before {partner} sinks theirs. Start, and you play white and break.</>;
  else if (m.status === 'over') status = m.winner === mySeat ? <><strong>All nine of yours are in. You win!</strong></> : <><strong>{partner} sank all of theirs</strong> and wins this one.</>;
  else if (play) status = <>{m.updatedBy === mySeat ? 'Your shot…' : `${partner}’s shot…`}</>;
  else if (myTurn)
    status = (
      <>
        {m.seq > 0 && m.updatedBy === them ? `${partner} ${m.last}. ` : m.seq > 0 && m.updatedBy === mySeat ? `You ${m.last}. Again! ` : ''}
        <strong>Your shot.</strong> {aim ? (forward(mySeat, aim.dy) ? 'Let go to shoot.' : 'Pull back towards your side.') : 'Slide the striker, then press on the board and pull back to aim.'}
      </>
    );
  else
    status =
      m.updatedBy === mySeat && m.seq > 0 ? (
        <>
          You {m.last}. Now it’s <strong>{partner}’s shot</strong>.
        </>
      ) : (
        <>
          Waiting for <strong>{partner}</strong> to shoot.
        </>
      );

  const chip = useMemo(
    () => (s: Seat) => (
      <span className="inline-block" style={{ width: 22, height: 22, borderRadius: '50%', background: COIN_PAL[seatKind(st, s)][0], boxShadow: `inset 0 0 0 3px ${COIN_PAL[seatKind(st, s)][1]}` }} />
    ),
    [st]
  );

  return (
    <GameFrame
      title="Carrom"
      onBack={onBack}
      match={m}
      marker={chip}
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
      <div className="flex flex-col items-center gap-3">
        <div style={{ width: 'min(100%, 540px)', padding: 10, background: '#6b4a2f', boxShadow: '0 0 0 4px #3b2a1e, inset 0 4px 0 #8a6342, inset 0 -4px 0 #4a3020' }}>
          <canvas
            ref={canvas}
            width={SIZE}
            height={SIZE}
            className="pixelated block w-full h-auto"
            style={{ touchAction: 'none', cursor: myTurn && !play ? 'crosshair' : 'default' }}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={() => {
              drag.current = null;
              setAim(null);
            }}
            role="img"
            aria-label={`The carrom board: ${COINS - st.xs.filter((v) => v < 0).length} coins left`}
          />
        </div>
        {myTurn && !play && (
          <label className="flex items-center gap-3 w-full" style={{ maxWidth: 540 }}>
            <span className="text-sm whitespace-nowrap">Striker</span>
            <input
              type="range"
              min={BASE_MIN}
              max={BASE_MAX}
              step={0.1}
              value={flip ? BASE_MIN + BASE_MAX - x : x}
              onChange={(e) => setX(flip ? BASE_MIN + BASE_MAX - +e.target.value : +e.target.value)}
              className="flex-1"
              aria-label="Slide the striker along your line"
            />
            {aim && <span className="text-sm whitespace-nowrap">Power {Math.round(aim.power * 100)}%</span>}
          </label>
        )}
        <div className="text-sm opacity-85 text-center leading-snug">
          You’re {mine === 'w' ? 'white' : 'black'}: {sunkCount(st, mySeat)} of 9 in · {partner}: {sunkCount(st, them)} of 9 · the queen: {queenLine}
        </div>
      </div>
    </GameFrame>
  );
};
