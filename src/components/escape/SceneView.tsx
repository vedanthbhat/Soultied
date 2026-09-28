import React, { useEffect, useRef, useState } from 'react';
import type { RoomDef, Side } from '../../escape/types';
import { Scene, SW, SH } from '../../escape/scene';

interface Props {
  room: RoomDef;
  side: Side;
  step: number;
  selected: string | null;
  /** objects this side hasn't looked at yet since they appeared */
  fresh: Set<string>;
  onObject: (id: string) => void;
}

/** One half of an escape room: the pixel scene with clickable things in it. */
export const SceneView: React.FC<Props> = ({ room, side, step, selected, fresh, onObject }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stepRef = useRef(step);
  stepRef.current = step;
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const scene = new Scene();
    const img = ctx.createImageData(SW, SH);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let last = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      if (document.hidden || now - last < (reduced ? 500 : 100)) return;
      last = now;
      scene.reset();
      room.draw(scene, side, stepRef.current, (now - t0) / 1000);
      img.data.set(scene.data);
      ctx.putImageData(img, 0, 0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [room, side]);

  const objects = room.objects.filter((o) => o.side === side && (o.from ?? 0) <= step);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;

  return (
    <div className="relative w-full select-none" style={{ aspectRatio: `${SW} / ${SH}`, background: '#0d0a0b' }}>
      <canvas ref={canvasRef} width={SW} height={SH} className="pixelated absolute inset-0 w-full h-full" aria-hidden="true" />
      {objects.map((o) => {
        const on = hover === o.id || selected === o.id;
        return (
          <button
            key={o.id}
            className={`absolute border-0 p-0 cursor-pointer bg-transparent ${fresh.has(o.id) ? 'esc-fresh' : ''}`}
            style={{
              left: pct(o.rect.x, SW),
              top: pct(o.rect.y, SH),
              width: pct(o.rect.w, SW),
              height: pct(o.rect.h, SH),
              outline: on ? '3px dashed #f1d27a' : undefined,
              outlineOffset: 2,
            }}
            onMouseEnter={() => setHover(o.id)}
            onMouseLeave={() => setHover((h) => (h === o.id ? null : h))}
            onFocus={() => setHover(o.id)}
            onBlur={() => setHover((h) => (h === o.id ? null : h))}
            onClick={() => onObject(o.id)}
            aria-label={o.label}
          />
        );
      })}
      {hover &&
        (() => {
          const o = objects.find((x) => x.id === hover);
          if (!o) return null;
          const above = o.rect.y > 16;
          const cx = o.rect.x + o.rect.w / 2;
          // keep the label inside the scene near the left / right edges
          const edge = cx < SW * 0.18 ? 'left' : cx > SW * 0.82 ? 'right' : 'mid';
          const x = edge === 'left' ? pct(o.rect.x, SW) : edge === 'right' ? pct(o.rect.x + o.rect.w, SW) : pct(cx, SW);
          const tx = edge === 'left' ? '0' : edge === 'right' ? '-100%' : '-50%';
          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: x,
                top: above ? pct(o.rect.y, SH) : pct(o.rect.y + o.rect.h, SH),
                transform: above ? `translate(${tx}, calc(-100% - 8px))` : `translate(${tx}, 8px)`,
                zIndex: 3,
              }}
            >
              <div className="px-box text-sm font-semibold px-2 py-0.5 whitespace-nowrap">{o.label}</div>
            </div>
          );
        })()}
    </div>
  );
};
