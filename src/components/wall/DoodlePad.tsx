import React, { useEffect, useRef, useState } from 'react';
import { DOODLE_H, DOODLE_PAL, DOODLE_W } from '../../together/wall';

/** A doodle (48 × 36, one hex digit a pixel), drawn crisp at any size. */
export const DoodleImage: React.FC<{ px: string; width?: number | string; className?: string; label?: string }> = ({ px, width = '100%', className = '', label }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const g = c?.getContext('2d');
    if (!c || !g) return;
    paint(g, px);
  }, [px]);
  return (
    <canvas
      ref={ref}
      width={DOODLE_W}
      height={DOODLE_H}
      className={`pixelated block ${className}`}
      style={{ width, aspectRatio: `${DOODLE_W} / ${DOODLE_H}`, height: 'auto' }}
      role="img"
      aria-label={label || 'A doodle'}
    />
  );
};

const rgb = DOODLE_PAL.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

function paint(g: CanvasRenderingContext2D, px: string | Uint8Array) {
  const img = g.createImageData(DOODLE_W, DOODLE_H);
  for (let i = 0; i < DOODLE_W * DOODLE_H; i++) {
    const k = typeof px === 'string' ? parseInt(px[i] || '0', 16) : px[i];
    const [r, gg, b] = rgb[k] || rgb[0];
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = gg;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}

type Tool = 'pen' | 'eraser' | 'fill';

const NAMES = ['Paper', 'Ink', 'White', 'Red', 'Pink', 'Orange', 'Mustard', 'Yellow', 'Sage', 'Green', 'Sky', 'Blue', 'Lilac', 'Brown', 'Peach', 'Grey'];

/** A little pixel pad to draw on. */
export const DoodlePad: React.FC<{
  partnerName: string;
  onSend: (px: string, hang: boolean) => void;
  onCancel?: () => void;
}> = ({ partnerName, onSend, onCancel }) => {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const pix = useRef<Uint8Array>(new Uint8Array(DOODLE_W * DOODLE_H));
  const history = useRef<Uint8Array[]>([]);
  const last = useRef<[number, number] | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [ink, setInk] = useState(1);
  const [size, setSize] = useState<1 | 2>(1);
  const [hang, setHang] = useState(true);
  const [empty, setEmpty] = useState(true);
  const [, bump] = useState(0);

  const redraw = () => {
    const g = canvas.current?.getContext('2d');
    if (g) paint(g, pix.current);
    setEmpty(pix.current.every((v) => v === 0));
  };
  useEffect(redraw, []);

  const cellAt = (e: React.PointerEvent): [number, number] => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.floor(((e.clientX - r.left) / r.width) * DOODLE_W), Math.floor(((e.clientY - r.top) / r.height) * DOODLE_H)];
  };
  const dab = (x: number, y: number) => {
    const v = tool === 'eraser' ? 0 : ink;
    for (let j = 0; j < size; j++)
      for (let i = 0; i < size; i++) {
        const xx = x + i;
        const yy = y + j;
        if (xx >= 0 && yy >= 0 && xx < DOODLE_W && yy < DOODLE_H) pix.current[yy * DOODLE_W + xx] = v;
      }
  };
  const line = (x0: number, y0: number, x1: number, y1: number) => {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      dab(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  };
  const fill = (x: number, y: number) => {
    const p = pix.current;
    const from = p[y * DOODLE_W + x];
    if (from === ink) return;
    const stack = [[x, y]];
    while (stack.length) {
      const [cx, cy] = stack.pop()!;
      if (cx < 0 || cy < 0 || cx >= DOODLE_W || cy >= DOODLE_H || p[cy * DOODLE_W + cx] !== from) continue;
      p[cy * DOODLE_W + cx] = ink;
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
  };
  const remember = () => {
    history.current = [...history.current.slice(-29), pix.current.slice()];
    bump((n) => n + 1);
  };

  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    remember();
    const [x, y] = cellAt(e);
    if (tool === 'fill') {
      if (x >= 0 && y >= 0 && x < DOODLE_W && y < DOODLE_H) fill(x, y);
      redraw();
      return;
    }
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    last.current = [x, y];
    dab(x, y);
    redraw();
  };
  const move = (e: React.PointerEvent) => {
    if (!last.current || tool === 'fill') return;
    const [x, y] = cellAt(e);
    line(last.current[0], last.current[1], x, y);
    last.current = [x, y];
    redraw();
  };
  const up = () => {
    last.current = null;
  };

  const encode = () => Array.from(pix.current, (v) => v.toString(16)).join('');

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 flex-wrap items-start">
        <canvas
          ref={canvas}
          width={DOODLE_W}
          height={DOODLE_H}
          className="pixelated block touch-none cursor-crosshair shadow-[0_0_0_3px_#3a2a26]"
          style={{ width: 'min(100%, 432px)', aspectRatio: `${DOODLE_W} / ${DOODLE_H}`, height: 'auto' }}
          aria-label="Your doodle. Draw with the mouse or your finger."
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onPointerLeave={up}
        />
        <div className="flex flex-col gap-2 min-w-[150px] flex-1">
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Tool">
            {(['pen', 'eraser', 'fill'] as Tool[]).map((t) => (
              <button key={t} type="button" className={`px-btn px-btn--small ${tool === t ? '' : 'px-btn--paper'}`} aria-pressed={tool === t} onClick={() => setTool(t)}>
                {t === 'pen' ? 'Pen' : t === 'eraser' ? 'Rubber' : 'Fill'}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Pen size">
            {([1, 2] as const).map((s) => (
              <button key={s} type="button" className={`px-btn px-btn--small ${size === s ? '' : 'px-btn--paper'}`} aria-pressed={size === s} onClick={() => setSize(s)}>
                {s === 1 ? 'Fine' : 'Thick'}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-1.5 max-w-[240px]" role="group" aria-label="Colours">
            {DOODLE_PAL.slice(1).map((c, i) => (
              <button
                key={c}
                type="button"
                title={NAMES[i + 1]}
                aria-label={NAMES[i + 1]}
                aria-pressed={ink === i + 1}
                onClick={() => {
                  setInk(i + 1);
                  if (tool === 'eraser') setTool('pen');
                }}
                className="w-6 h-6 border-0 cursor-pointer p-0"
                style={{ background: c, boxShadow: ink === i + 1 ? '0 0 0 2px #3a2a26, 0 0 0 4px #fff1c9' : '0 0 0 2px #3a2a26' }}
              />
            ))}
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              className="px-btn px-btn--paper px-btn--small"
              disabled={!history.current.length}
              onClick={() => {
                const prev = history.current.pop();
                if (prev) pix.current = prev;
                redraw();
                bump((n) => n + 1);
              }}
            >
              Undo
            </button>
            <button
              type="button"
              className="px-btn px-btn--paper px-btn--small"
              disabled={empty}
              onClick={() => {
                remember();
                pix.current = new Uint8Array(DOODLE_W * DOODLE_H);
                redraw();
              }}
            >
              Clear
            </button>
          </div>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input type="checkbox" checked={hang} onChange={(e) => setHang(e.target.checked)} />
        Hang it in the frame over the couch too
      </label>
      <div className="flex gap-3 flex-wrap items-center">
        <button
          className="px-btn"
          disabled={empty}
          onClick={() => {
            onSend(encode(), hang);
            pix.current = new Uint8Array(DOODLE_W * DOODLE_H);
            history.current = [];
            redraw();
          }}
        >
          Pin it up for {partnerName}
        </button>
        {onCancel && (
          <button className="px-btn px-btn--paper px-btn--small" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};

