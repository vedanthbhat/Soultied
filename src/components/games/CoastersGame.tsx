import React, { useEffect, useRef, useState } from 'react';
import { useLiveGame } from '../../games/live/useLiveGame';
import type { LiveGame } from '../../games/live/useLiveGame';
import { COASTERS, CoastersAct, CoastersState, GOAL_X0, GOAL_X1, MALLET_R, MID, PUCK_R, TABLE_H, TABLE_W, TO_WIN, glide, reach } from '../../games/coasters';
import type { Body } from '../../games/coasters';
import type { Seat } from '../../games/types';
import { tone } from '../../escape/sfx';
import { LiveFrame, useNow } from './LiveFrame';

/** coasters move at most this fast (the same as the rules), for drawing them between updates */
const MALLET_SPEED = 330;

const WOOD = ['#8a5a3c', '#83553a', '#8f5f40', '#7d5036'];

/** The coffee table, drawn once: planks, rails, the goal slots, the centre line and circle. */
function drawTable(ctx: CanvasRenderingContext2D) {
  for (let y = 0; y < TABLE_H; y++) {
    const plank = Math.floor(y / 10);
    ctx.fillStyle = WOOD[plank % WOOD.length];
    ctx.fillRect(0, y, TABLE_W, 1);
    if (y % 10 === 0) {
      ctx.fillStyle = '#5e3c28';
      ctx.fillRect(0, y, TABLE_W, 1);
    }
  }
  // grain
  ctx.fillStyle = 'rgba(60,36,24,.35)';
  for (let k = 0; k < 140; k++) {
    const x = (k * 37) % TABLE_W;
    const y = (k * 53 + Math.floor(k / 3)) % TABLE_H;
    if (y % 10 !== 0) ctx.fillRect(x, y, 2 + (k % 3), 1);
  }
  // the play markings
  ctx.fillStyle = 'rgba(239,227,203,.55)';
  for (let x = 2; x < TABLE_W - 2; x += 4) ctx.fillRect(x, MID, 2, 1);
  for (let a = 0; a < 48; a++) {
    const t = (a / 48) * Math.PI * 2;
    if (a % 2) continue;
    ctx.fillRect(Math.round(TABLE_W / 2 + Math.cos(t) * 13), Math.round(MID + Math.sin(t) * 13), 1, 1);
  }
  ctx.fillStyle = 'rgba(239,227,203,.3)';
  for (let a = 0; a <= 24; a++) {
    const t = (a / 24) * Math.PI;
    const x = Math.round(TABLE_W / 2 + Math.cos(t) * 20);
    ctx.fillRect(x, Math.round(Math.sin(t) * 18), 1, 1);
    ctx.fillRect(x, Math.round(TABLE_H - 1 - Math.sin(t) * 18), 1, 1);
  }
  // rails, and the goal slots in the ends
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(0, 0, 2, TABLE_H);
  ctx.fillRect(TABLE_W - 2, 0, 2, TABLE_H);
  ctx.fillRect(0, 0, TABLE_W, 2);
  ctx.fillRect(0, TABLE_H - 2, TABLE_W, 2);
  ctx.fillStyle = '#140c0e';
  ctx.fillRect(GOAL_X0, 0, GOAL_X1 - GOAL_X0, 3);
  ctx.fillRect(GOAL_X0, TABLE_H - 3, GOAL_X1 - GOAL_X0, 3);
  ctx.fillStyle = '#e2b359';
  ctx.fillRect(GOAL_X0 - 1, 0, 1, 4);
  ctx.fillRect(GOAL_X1, 0, 1, 4);
  ctx.fillRect(GOAL_X0 - 1, TABLE_H - 4, 1, 4);
  ctx.fillRect(GOAL_X1, TABLE_H - 4, 1, 4);
}

/** a filled pixel circle (row by row) */
function disc(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string) {
  ctx.fillStyle = col;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  for (let j = -r; j <= r; j++) {
    const w = Math.floor(Math.sqrt(r * r - (j + 0.5 * Math.sign(j)) ** 2 + r * 0.6));
    if (w >= 0) ctx.fillRect(x0 - w, y0 + j, w * 2 + 1, 1);
  }
}

function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string) {
  ctx.fillStyle = col;
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    ctx.fillRect(x0 + Math.round(Math.cos(t) * r), y0 + Math.round(Math.sin(t) * r), 1, 1);
  }
}

function coaster(ctx: CanvasRenderingContext2D, x: number, y: number, band: string) {
  disc(ctx, x + 1, y + 1, MALLET_R, 'rgba(20,10,8,.45)');
  disc(ctx, x, y, MALLET_R, '#6b4a2f');
  disc(ctx, x, y, MALLET_R - 1, '#c89a5c');
  ring(ctx, x, y, MALLET_R - 3, band);
  ctx.fillStyle = '#a87a44';
  ctx.fillRect(Math.round(x) - 4, Math.round(y) + 2, 1, 1);
  ctx.fillRect(Math.round(x) + 3, Math.round(y) - 4, 1, 1);
  ctx.fillRect(Math.round(x) + 2, Math.round(y) + 4, 1, 1);
  disc(ctx, x, y, 1, band);
}

function cap(ctx: CanvasRenderingContext2D, x: number, y: number) {
  disc(ctx, x + 1, y + 1, PUCK_R, 'rgba(20,10,8,.45)');
  disc(ctx, x, y, PUCK_R, '#8f2f2b');
  disc(ctx, x, y, PUCK_R - 1, '#c4453f');
  ctx.fillStyle = '#f08a80';
  ctx.fillRect(Math.round(x) - 1, Math.round(y) - 2, 2, 1);
}

/** Move a coaster from where it was towards where it's going, as far as it could have got in `dt`. */
const towards = (m: { x: number; y: number }, tx: number, ty: number, dt: number) => {
  const dx = tx - m.x;
  const dy = ty - m.y;
  const d = Math.hypot(dx, dy);
  const most = MALLET_SPEED * Math.max(0, Math.min(0.2, dt));
  const k = d > most ? most / d : 1;
  return { x: m.x + dx * k, y: m.y + dy * k };
};

/**
 * The table on screen. Your own goal is always at the bottom (the other seat sees it turned round).
 * Your coaster follows your finger or mouse straight away; everything else is the host's last word,
 * moved on to now.
 */
const Table: React.FC<{
  state: CoastersState | null;
  mySeat: Seat;
  clock: (t: number) => number;
  live: boolean;
  onAim?: (a: CoastersAct) => void;
}> = ({ state, mySeat, clock, live, onAim }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const table = useRef<HTMLCanvasElement | null>(null);
  const sRef = useRef(state);
  sRef.current = state;
  const aim = useRef<{ x: number; y: number } | null>(null);
  const flip = mySeat === 'b';
  const view = (x: number, y: number) => (flip ? { x: TABLE_W - x, y: TABLE_H - y } : { x, y });

  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    if (!table.current) {
      const t = document.createElement('canvas');
      t.width = TABLE_W;
      t.height = TABLE_H;
      const tc = t.getContext('2d');
      if (tc) drawTable(tc);
      table.current = t;
    }
    let raf = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      ctx.drawImage(table.current!, 0, 0);
      const s = sRef.current;
      const them: Seat = mySeat === 'a' ? 'b' : 'a';
      if (!s) {
        const a = view(TABLE_W / 2, TABLE_H - 22);
        const b = view(TABLE_W / 2, 22);
        coaster(ctx, mySeat === 'a' ? a.x : b.x, mySeat === 'a' ? a.y : b.y, '#b8674f');
        coaster(ctx, mySeat === 'a' ? b.x : a.x, mySeat === 'a' ? b.y : a.y, '#8a9a72');
        const p = view(TABLE_W / 2, MID);
        cap(ctx, p.x, p.y);
        return;
      }
      const age = Math.max(0, (Date.now() - clock(s.t)) / 1000);
      const p: Body = Date.now() < clock(s.serveAt) ? s.puck : glide(s.puck, age);
      const mine = s.mal[mySeat];
      const want = aim.current && live ? aim.current : { x: mine.tx, y: mine.ty };
      const m1 = towards(mine, want.x, want.y, age + 0.05);
      const other = s.mal[them];
      const m2 = towards(other, other.tx, other.ty, age);
      const pv = view(p.x, p.y);
      const v1 = view(m1.x, m1.y);
      const v2 = view(m2.x, m2.y);
      cap(ctx, pv.x, pv.y);
      coaster(ctx, v2.x, v2.y, '#8a9a72');
      coaster(ctx, v1.x, v1.y, '#b8674f');
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mySeat, clock, live]);

  // where your finger or mouse is, on the table: sent at most once a frame
  const pending = useRef(false);
  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!live || !onAim) return;
    const r = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * TABLE_W;
    const vy = ((e.clientY - r.top) / r.height) * TABLE_H;
    const t = view(vx, vy);
    aim.current = reach(mySeat, t.x, t.y);
    if (pending.current) return;
    pending.current = true;
    requestAnimationFrame(() => {
      pending.current = false;
      if (aim.current) onAim(aim.current);
    });
  };

  return (
    <canvas
      ref={ref}
      width={TABLE_W}
      height={TABLE_H}
      className="pixelated block mx-auto select-none"
      style={{
        height: 'min(62vh, 640px)',
        aspectRatio: `${TABLE_W} / ${TABLE_H}`,
        maxWidth: '100%',
        boxShadow: '0 0 0 4px #1b1411, 8px 8px 0 4px rgba(0,0,0,.35)',
        touchAction: 'none',
        cursor: live ? 'none' : 'default',
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        point(e);
      }}
      onPointerMove={point}
      aria-label="The coffee table. Move your mouse or finger on your half to move your coaster."
      role="img"
    />
  );
};

export const CoastersGame: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const game = useLiveGame<CoastersState, CoastersAct>('coasters', COASTERS);
  const { state: s, mySeat, them, partner, act, stage, clock } = game;
  const now = useNow(stage === 'play' || stage === 'count', 200);
  const live = stage === 'play' && !!s && !s.winner;

  // sounds: a tap for every touch of a coaster, a little tune for a goal
  const heard = useRef({ hits: 0, goals: -1 });
  const [flash, setFlash] = useState<{ who: Seat; at: number } | null>(null);
  useEffect(() => {
    if (!s) return;
    const h = heard.current;
    if (s.hits > h.hits) tone(420 + (s.hits % 4) * 60, 0.04, 0, 'square', 0.03);
    h.hits = s.hits;
    const goals = s.score.a + s.score.b;
    if (h.goals >= 0 && goals > h.goals && s.lastGoal) {
      setFlash({ who: s.lastGoal, at: Date.now() });
      if (s.lastGoal === mySeat) [660, 880, 1100].forEach((f, i) => tone(f, 0.1, i * 0.08, 'triangle', 0.05));
      else [330, 247].forEach((f, i) => tone(f, 0.14, i * 0.1, 'triangle', 0.05));
    }
    h.goals = goals;
  }, [s, mySeat]);
  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1000);
    return () => window.clearTimeout(t);
  }, [flash]);

  const pips = (seat: Seat) => (
    <span className="flex gap-1.5 flex-wrap">
      {[...Array(TO_WIN).keys()].map((i) => (
        <span key={i} style={{ width: 12, height: 12, background: (s?.score[seat] || 0) > i ? '#ffd76a' : 'rgba(239,227,203,.18)', boxShadow: '0 0 0 2px #1b1411' }} />
      ))}
    </span>
  );
  const serving = !!s && now < clock(s.serveAt) && s.score.a + s.score.b > 0;

  return (
    <LiveFrame
      title="Coasters"
      onBack={onBack}
      game={game as unknown as LiveGame<unknown, unknown>}
      howTo={
        <>
          Air hockey on the coffee table. Move your mouse (or finger) on your half to move your coaster, and knock the bottle cap into {partner}’s goal. First to {TO_WIN}.
        </>
      }
      playing={
        <>
          <strong>
            You {s?.score[mySeat] ?? 0} · {s?.score[them] ?? 0} {partner}
          </strong>
          {serving ? ' · next serve in a moment…' : ''}
        </>
      }
      poster={<Table state={null} mySeat={mySeat} clock={clock} live={false} />}
      width={720}
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center justify-between w-full max-w-[420px] font-bold gap-3">
          <span className="flex items-center gap-2">
            {partner} {pips(them)}
          </span>
          <span className="opacity-70 text-sm">their goal ↑</span>
        </div>
        <div className="relative">
          <Table state={s} mySeat={mySeat} clock={clock} live={live} onAim={(a) => act(a, true)} />
          {flash && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="px-box px-shadow px-pop px-5 py-2 text-3xl font-bold" style={{ color: 'var(--ink-soft)' }}>
                {flash.who === mySeat ? 'Goal!' : `${partner} scores`}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between w-full max-w-[420px] font-bold gap-3">
          <span className="flex items-center gap-2">You {pips(mySeat)}</span>
          <span className="opacity-70 text-sm">your goal ↓</span>
        </div>
      </div>
    </LiveFrame>
  );
};

