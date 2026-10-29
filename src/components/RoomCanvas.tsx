import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { renderRoom, ROOM_W, ROOM_H, ROOM_FOCUS_X, TOUCH_LEN, hitTest, hotspotRect, HotspotId, RoomState, RoomTouch, Seat } from '../pixel/room';
import type { Decor } from '../decor/catalogue';
import type { Glyph } from '../together/moods';

interface Props {
  left: Seat;
  right: Seat;
  letterUnread: boolean;
  /** a game is waiting on you */
  gamesWaiting?: boolean;
  /** a record is playing */
  music?: boolean;
  /** Labels shown above a hotspot on hover. Omit a key to disable that hotspot. */
  labels: Partial<Record<HotspotId, string>>;
  onHotspot?: (id: HotspotId) => void;
  /** Dim + blur-free darken the room (e.g. behind onboarding). 0..1 */
  dim?: number;
  /** how close they sit on the couch, 0..1 */
  closeness?: number;
  /** when true, a change in closeness plays as a little scoot; otherwise they just sit there */
  scoot?: boolean;
  /** called when a scoot finishes, with the closeness they ended up at */
  onScooted?: (closeness: number) => void;
  /** what's out in the room (or being tried on) */
  decor?: Decor;
  /** on a narrow screen, keep this x (room pixels) in view instead of the couch */
  focusX?: number;
  /** how each of them is feeling: a little bubble over their head */
  moods?: { left?: Glyph | null; right?: Glyph | null };
  /** a touch to play on the couch, once per id */
  touch?: { id: string; kind: string; together: boolean; from: 'left' | 'right'; glyph: Glyph } | null;
  /** a little card that opens over one of the two seats */
  pop?: { at: 'left' | 'right'; node: React.ReactNode; onClose: () => void } | null;
}

/** one step along the couch (1/7) takes about a second and a half */
const SCOOT_PER_SECOND = 1 / 7 / 1.5;

interface Fit {
  scale: number;
  left: number;
  top: number;
}

function computeFit(w: number, h: number, focusX = ROOM_FOCUS_X): Fit {
  const scale = Math.max(w / ROOM_W, h / ROOM_H);
  const cw = ROOM_W * scale;
  const ch = ROOM_H * scale;
  // centre on the couch/fireplace area; clamp so we never show past the edges
  let left = w / 2 - focusX * scale;
  if (cw <= w * 1.25) left = (w - cw) / 2; // near 16:9: just centre
  left = Math.min(0, Math.max(w - cw, left));
  const top = Math.min(0, Math.max(h - ch, (h - ch) * 0.6));
  return { scale, left, top };
}

/** The little label over whatever you're pointing at, kept inside the window near the edges. */
const HoverTag: React.FC<{ x: number; y: number; text: string }> = ({ x, y, text }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shift, setShift] = useState(0);
  useLayoutEffect(() => {
    const w = ref.current?.offsetWidth || 0;
    const room = window.innerWidth;
    const left = x - w / 2;
    setShift(left < 8 ? 8 - left : left + w > room - 8 ? room - 8 - (left + w) : 0);
  }, [x, text]);
  return (
    <div className="absolute pointer-events-none px-ui" style={{ left: x + shift, top: y, transform: 'translate(-50%, -100%)' }}>
      <div ref={ref} className="px-box px-shadow px-fade text-sm font-semibold whitespace-nowrap px-2.5 py-1">
        {text}
      </div>
    </div>
  );
};

/**
 * A card over one of the seats (or, on a phone, along the bottom). Closes on Escape or a tap
 * anywhere else.
 */
const SeatPop: React.FC<{ x: number; y: number; onClose: () => void; children: React.ReactNode }> = ({ x, y, onClose, children }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const narrow = window.innerWidth < 640;
  // above the seat, kept inside the window (and pushed down if it's taller than the room above)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (narrow || !el) return;
    const place = () => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const left = Math.min(window.innerWidth - 12 - w, Math.max(12, x - w / 2));
      const top = Math.max(12, y - h);
      setPos((p) => (p && p.left === left && p.top === top ? p : { left, top }));
    };
    place();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(place) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [x, y, narrow]);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    // a beat later, so the tap that opened it doesn't close it
    const t = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, []);
  return narrow ? (
    <div ref={ref} className="fixed inset-x-0 bottom-0 z-[35] px-ui p-3">
      <div className="px-box px-shadow px-fade p-4 max-h-[72vh] overflow-y-auto">{children}</div>
    </div>
  ) : (
    <div
      ref={ref}
      className="absolute z-[35] px-ui px-box px-shadow px-fade p-4 w-[430px] max-w-[calc(100vw-24px)] max-h-[calc(100vh-24px)] overflow-y-auto"
      style={{ left: pos?.left ?? x, top: pos?.top ?? y, visibility: pos ? 'visible' : 'hidden' }}
    >
      {children}
    </div>
  );
};

/**
 * The whole screen is the room. The canvas is 320x180 real pixels, scaled
 * to cover the viewport with nearest-neighbour upscaling.
 */
export const RoomCanvas: React.FC<Props> = ({
  left,
  right,
  letterUnread,
  gamesWaiting = false,
  music = false,
  labels,
  onHotspot,
  dim = 0,
  closeness = 0,
  scoot = false,
  onScooted,
  decor,
  focusX = ROOM_FOCUS_X,
  moods,
  touch,
  pop,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fit, setFit] = useState<Fit>(() => computeFit(window.innerWidth, window.innerHeight, focusX));
  const [hover, setHover] = useState<HotspotId | null>(null);
  const stateRef = useRef<RoomState>({ left, right, letterUnread, fire: 0.6, hover: null, closeness, heartAt: -1 });
  const fireBoost = useRef(0);
  const target = useRef(closeness);
  target.current = closeness;
  const scootRef = useRef(scoot);
  scootRef.current = scoot;
  const scootedRef = useRef(onScooted);
  scootedRef.current = onScooted;

  stateRef.current.left = left;
  stateRef.current.right = right;
  stateRef.current.letterUnread = letterUnread;
  stateRef.current.gamesWaiting = gamesWaiting;
  stateRef.current.music = music;
  stateRef.current.hover = hover;
  stateRef.current.decor = decor;
  stateRef.current.moods = moods;

  // a touch plays once, from the moment it arrives (in the room's own clock); one that comes in
  // while another is still playing waits its turn
  const sceneT = useRef(0);
  const playedTouch = useRef<string | null>(null);
  const touchQueue = useRef<Omit<RoomTouch, 'at'>[]>([]);
  useEffect(() => {
    if (!touch || playedTouch.current === touch.id) return;
    playedTouch.current = touch.id;
    touchQueue.current = [...touchQueue.current, { kind: touch.kind, together: touch.together, from: touch.from, glyph: touch.glyph }].slice(-3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touch?.id]);

  const [panning, setPanning] = useState(false);
  useEffect(() => {
    const onResize = () => setFit(computeFit(window.innerWidth, window.innerHeight, focusX));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [focusX]);
  // turning to look at something else in the room (the catalogue, on a phone)
  const firstFocus = useRef(true);
  useEffect(() => {
    if (firstFocus.current) {
      firstFocus.current = false;
      return;
    }
    setPanning(true);
    setFit(computeFit(window.innerWidth, window.innerHeight, focusX));
    const t = window.setTimeout(() => setPanning(false), 450);
    return () => window.clearTimeout(t);
  }, [focusX]);

  // render loop (~12 fps is plenty for pixel animation and easy on laptops)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const interval = reduced ? 400 : 83;
    const img = ctx.createImageData(ROOM_W, ROOM_H);
    let raf = 0;
    let last = 0;
    const start = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < interval) return;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;
      // shuffle along the couch toward where they belong now
      const st = stateRef.current;
      const cur = st.closeness ?? 0;
      const goal = target.current;
      if (Math.abs(goal - cur) > 1e-4 && !scootRef.current && !st.scooting) {
        st.closeness = goal;
      } else if (Math.abs(goal - cur) > 1e-4) {
        if (!st.scooting) {
          st.scooting = true;
          if (goal > cur) st.heartAt = t;
        }
        const step = SCOOT_PER_SECOND * (reduced ? 4 : 1) * dt;
        st.closeness = goal > cur ? Math.min(goal, cur + step) : Math.max(goal, cur - step);
      } else if (st.scooting) {
        st.scooting = false;
        scootedRef.current?.(goal);
      }
      fireBoost.current = Math.max(0, fireBoost.current - 0.012);
      stateRef.current.fire = Math.min(1, 0.6 + fireBoost.current);
      sceneT.current = reduced ? t * 0.3 : t;
      const playing = st.touch;
      if (touchQueue.current.length && (!playing || sceneT.current - playing.at > TOUCH_LEN + 0.15)) st.touch = { ...touchQueue.current.shift()!, at: sceneT.current };
      const buf = renderRoom(stateRef.current, sceneT.current);
      img.data.set(buf.data);
      ctx.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const toScene = useCallback(
    (clientX: number, clientY: number) => ({
      x: Math.floor((clientX - fit.left) / fit.scale),
      y: Math.floor((clientY - fit.top) / fit.scale),
    }),
    [fit]
  );

  const pick = (clientX: number, clientY: number) => {
    const p = toScene(clientX, clientY);
    const id = hitTest(p.x, p.y, stateRef.current.closeness);
    return id && labels[id] ? id : null;
  };

  const activate = (id: HotspotId) => {
    if (id === 'fire') fireBoost.current = 0.6;
    onHotspot?.(id);
  };

  const tag = hover && !pop ? hotspotRect(hover, stateRef.current.closeness) : null;
  const popAt = pop ? hotspotRect(pop.at, stateRef.current.closeness) : null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#1a1214]" aria-hidden={false}>
      <canvas
        ref={canvasRef}
        width={ROOM_W}
        height={ROOM_H}
        role="img"
        aria-label="Your shared living room: a fire crackling in the fireplace, snow outside the window, and a couch for two."
        className="absolute pixelated"
        style={{
          left: fit.left,
          top: fit.top,
          width: ROOM_W * fit.scale,
          height: ROOM_H * fit.scale,
          cursor: hover ? 'pointer' : 'default',
          transition: panning ? 'left 400ms steps(8)' : undefined,
        }}
        onPointerMove={(e) => setHover(pick(e.clientX, e.clientY))}
        onPointerLeave={() => setHover(null)}
        onClick={(e) => {
          const id = pick(e.clientX, e.clientY);
          if (id) activate(id);
        }}
      />

      {/* dim layer for onboarding / panels */}
      {dim > 0 && (
        <div className="absolute inset-0 pointer-events-none transition-opacity duration-300" style={{ background: `rgba(16,10,12,${dim})` }} />
      )}

      {/* hover label, pinned above the hotspot */}
      {tag && labels[hover!] && (
        <HoverTag x={fit.left + (tag.x + tag.w / 2) * fit.scale} y={fit.top + tag.y * fit.scale - 10} text={labels[hover!]!} />
      )}

      {/* the card over a seat: how you're feeling, or a hug for them */}
      {pop && popAt && (
        <SeatPop key={pop.at} x={fit.left + (popAt.x + popAt.w / 2) * fit.scale} y={fit.top + (popAt.y - 20) * fit.scale} onClose={pop.onClose}>
          {pop.node}
        </SeatPop>
      )}

      {/* Keyboard access to the room's hotspots (visually hidden until focused) */}
      <div className="sr-only focus-within:not-sr-only focus-within:absolute focus-within:bottom-4 focus-within:left-4 focus-within:z-40 px-ui flex gap-3">
        {(Object.keys(labels) as HotspotId[]).map((id) => (
          <button key={id} className="px-btn px-btn--paper px-btn--small" onClick={() => activate(id)}>
            {labels[id]}
          </button>
        ))}
      </div>
    </div>
  );
};
