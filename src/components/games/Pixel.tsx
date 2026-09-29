import React, { useEffect, useRef } from 'react';

/** Paint a little pixel picture at native size; it's shown scaled up, crisp. */
export type Painter = (px: (x: number, y: number, w: number, h: number, c: string) => void, dot: (x: number, y: number, c: string) => void) => void;

export const PixelArt: React.FC<{
  w: number;
  h: number;
  paint: Painter;
  scale?: number;
  className?: string;
  style?: React.CSSProperties;
  label?: string;
  /** anything the picture depends on, so it redraws when that changes */
  deps?: unknown[];
}> = ({ w, h, paint, scale = 4, className = '', style, label, deps = [] }) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, w, h);
    const px = (x: number, y: number, ww: number, hh: number, col: string) => {
      ctx.fillStyle = col;
      ctx.fillRect(x, y, ww, hh);
    };
    paint(px, (x, y, col) => px(x, y, 1, 1, col));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, ...deps]);
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      className={`pixelated block ${className}`}
      style={{ width: w * scale, height: h * scale, ...style }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
};

/** An ASCII sprite: each character is a colour from the palette; '.' is see-through. */
export const Sprite: React.FC<{ rows: string[]; pal: Record<string, string>; scale?: number; className?: string; style?: React.CSSProperties; label?: string }> = ({
  rows,
  pal,
  scale = 4,
  className,
  style,
  label,
}) => (
  <PixelArt
    w={rows[0].length}
    h={rows.length}
    scale={scale}
    className={className}
    style={style}
    label={label}
    deps={[rows.join('|'), JSON.stringify(pal)]}
    paint={(_, dot) => rows.forEach((row, y) => [...row].forEach((k, x) => pal[k] && dot(x, y, pal[k])))}
  />
);
