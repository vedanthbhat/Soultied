import React, { useEffect, useRef } from 'react';
import { AvatarConfig } from '../types';
import { renderCharacter, Pose, CHAR_W, CHAR_H } from '../pixel/character';
import { PixelBuffer } from '../pixel/buffer';

export function paintBuffer(
  canvas: HTMLCanvasElement,
  buf: PixelBuffer,
  crop?: { x: number; y: number; w: number; h: number }
) {
  const c = crop || { x: 0, y: 0, w: buf.w, h: buf.h };
  if (canvas.width !== c.w) canvas.width = c.w;
  if (canvas.height !== c.h) canvas.height = c.h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const img = ctx.createImageData(c.w, c.h);
  for (let y = 0; y < c.h; y++) {
    const sy = y + c.y;
    if (sy < 0 || sy >= buf.h) continue;
    const from = (sy * buf.w + c.x) * 4;
    img.data.set(buf.data.subarray(from, from + c.w * 4), y * c.w * 4);
  }
  ctx.putImageData(img, 0, 0);
}

interface PixelAvatarProps {
  config: AvatarConfig;
  /** CSS height in px. Width follows the 1:2 sprite ratio. */
  size?: number;
  animate?: boolean;
  className?: string;
  flipped?: boolean;
  pose?: Pose;
}

/** A single character, standing (default) or sitting, with a gentle blink. */
export const PixelAvatarRenderer: React.FC<PixelAvatarProps> = ({
  config,
  size = 180,
  animate = true,
  className = '',
  flipped = false,
  pose = 'stand',
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const draw = (blink = false, bob = 0) => paintBuffer(canvas, renderCharacter(config, pose, { blink, bob }).buf);
    draw();
    if (!animate) return;
    let t = 0;
    const id = window.setInterval(() => {
      t += 1;
      const blink = t % 34 === 0;
      const bob = Math.floor(t / 6) % 2;
      draw(blink, bob);
    }, 120);
    return () => window.clearInterval(id);
  }, [config, animate, pose]);

  return (
    <canvas
      ref={ref}
      width={CHAR_W}
      height={CHAR_H}
      aria-hidden="true"
      className={`pixelated select-none ${className}`}
      style={{
        height: size,
        width: (size * CHAR_W) / CHAR_H,
        transform: flipped ? 'scaleX(-1)' : undefined,
      }}
    />
  );
};

export type ThumbRegion = 'head' | 'torso' | 'legs' | 'feet' | 'full';

/** Cropped render of an avatar, used for wardrobe option buttons. */
export const AvatarThumb: React.FC<{ config: AvatarConfig; region: ThumbRegion; size?: number }> = ({
  config,
  region,
  size = 48,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!ref.current) return;
    const { buf, headTop } = renderCharacter(config, 'stand');
    const box =
      region === 'head'
        ? { x: 3, y: headTop - 7, w: 18, h: 18 }
        : region === 'torso'
        ? { x: 3, y: headTop + 8, w: 18, h: 18 }
        : region === 'legs'
        ? { x: 3, y: headTop + 18, w: 18, h: 18 }
        : region === 'feet'
        ? { x: 3, y: CHAR_H - 12, w: 18, h: 12 }
        : { x: 0, y: 0, w: CHAR_W, h: CHAR_H };
    paintBuffer(ref.current, buf, box);
  }, [config, region]);
  const ratio = region === 'feet' ? 12 / 18 : region === 'full' ? 2 : 1;
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      className="pixelated block"
      style={{ width: region === 'full' ? size / 2 : size, height: region === 'full' ? size : size * ratio }}
    />
  );
};
