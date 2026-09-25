import React, { useCallback, useEffect, useRef, useState } from 'react';
import { renderRoom, ROOM_W, ROOM_H, ROOM_FOCUS_X, hitTest, hotspotRect, HotspotId, RoomState, Seat } from '../pixel/room';

interface Props {
  left: Seat;
  right: Seat;
  letterUnread: boolean;
  /** Labels shown above a hotspot on hover. Omit a key to disable that hotspot. */
  labels: Partial<Record<HotspotId, string>>;
  onHotspot?: (id: HotspotId) => void;
  /** Dim + blur-free darken the room (e.g. behind onboarding). 0..1 */
  dim?: number;
}

interface Fit {
  scale: number;
  left: number;
  top: number;
}

function computeFit(w: number, h: number): Fit {
  const scale = Math.max(w / ROOM_W, h / ROOM_H);
  const cw = ROOM_W * scale;
  const ch = ROOM_H * scale;
  // centre on the couch/fireplace area; clamp so we never show past the edges
  let left = w / 2 - ROOM_FOCUS_X * scale;
  if (cw <= w * 1.25) left = (w - cw) / 2; // near 16:9: just centre
  left = Math.min(0, Math.max(w - cw, left));
  const top = Math.min(0, Math.max(h - ch, (h - ch) * 0.6));
  return { scale, left, top };
}

/**
 * The whole screen is the room. The canvas is 320x180 real pixels, scaled
 * to cover the viewport with nearest-neighbour upscaling.
 */
export const RoomCanvas: React.FC<Props> = ({ left, right, letterUnread, labels, onHotspot, dim = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fit, setFit] = useState<Fit>(() => computeFit(window.innerWidth, window.innerHeight));
  const [hover, setHover] = useState<HotspotId | null>(null);
  const stateRef = useRef<RoomState>({ left, right, letterUnread, fire: 0.6, hover: null });
  const fireBoost = useRef(0);

  stateRef.current.left = left;
  stateRef.current.right = right;
  stateRef.current.letterUnread = letterUnread;
  stateRef.current.hover = hover;

  useEffect(() => {
    const onResize = () => setFit(computeFit(window.innerWidth, window.innerHeight));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

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
      last = now;
      const t = (now - start) / 1000;
      fireBoost.current = Math.max(0, fireBoost.current - 0.012);
      stateRef.current.fire = Math.min(1, 0.6 + fireBoost.current);
      const buf = renderRoom(stateRef.current, reduced ? t * 0.3 : t);
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
    const id = hitTest(p.x, p.y);
    return id && labels[id] ? id : null;
  };

  const activate = (id: HotspotId) => {
    if (id === 'fire') fireBoost.current = 0.6;
    onHotspot?.(id);
  };

  const tag = hover ? hotspotRect(hover) : null;

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
        <div
          className="absolute pointer-events-none px-ui"
          style={{
            left: fit.left + (tag.x + tag.w / 2) * fit.scale,
            top: fit.top + tag.y * fit.scale - 10,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="px-box px-shadow px-fade text-sm font-semibold whitespace-nowrap px-2.5 py-1">{labels[hover!]}</div>
        </div>
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
