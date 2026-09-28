import React, { useEffect, useRef } from 'react';
import { GLYPHS, GlyphId } from '../../escape/glyphs';

/** One of the escape-room symbols, drawn crisp at any size. */
export const Glyph: React.FC<{ id: GlyphId; color?: string; size?: number; label?: string }> = ({
  id,
  color = '#3a2a26',
  size = 28,
  label,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, 7, 7);
    ctx.fillStyle = color;
    GLYPHS[id].forEach((row, y) => [...row].forEach((k, x) => k === '#' && ctx.fillRect(x, y, 1, 1)));
  }, [id, color]);
  return (
    <canvas
      ref={ref}
      width={7}
      height={7}
      className="pixelated inline-block shrink-0"
      style={{ width: size, height: size }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
};

/** A little pixel door for the corridor, in the room's colour. */
export const DoorSprite: React.FC<{ accent: string; open?: boolean; scale?: number }> = ({ accent, open, scale = 4 }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const W = 22;
  const H = 36;
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const px = (x: number, y: number, w: number, h: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, w, h);
    };
    ctx.clearRect(0, 0, W, H);
    // frame + arch
    px(0, 4, W, H - 4, '#1a1214');
    px(2, 2, W - 4, 2, '#1a1214');
    px(4, 0, W - 8, 2, '#1a1214');
    // door (or the glow beyond it)
    if (open) {
      px(2, 5, W - 4, H - 5, accent);
      px(4, 3, W - 8, 2, accent);
    } else {
      px(2, 5, W - 4, H - 5, '#2a2024');
      px(4, 3, W - 8, 2, '#2a2024');
      for (let y = 8; y < H - 2; y += 9) {
        px(4, y, 6, 7, '#352a2e');
        px(12, y, 6, 7, '#352a2e');
      }
      px(W - 6, 20, 2, 2, accent);
      // light leaking under the door
      px(2, H - 1, W - 4, 1, accent);
    }
  }, [accent, open]);
  return <canvas ref={ref} width={W} height={H} className="pixelated block" style={{ width: W * scale, height: H * scale }} aria-hidden="true" />;
};
