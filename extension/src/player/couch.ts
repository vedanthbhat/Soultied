import { PixelBuffer } from '../../../src/pixel/buffer';
import { renderCharacter } from '../../../src/pixel/character';
import { ICONS, type ReactionKind } from '../../../src/pixel/watchRoom';
import type { AvatarConfig } from '../../../src/types';

/**
 * The couch corner: the two of you, pixel-sized, on a little couch in the
 * corner of the video. You sit as close as you've earned in Soultied, your
 * person dozes when they're not here, and reactions float up from whoever sent them.
 */

const W = 96;
const H = 84;
const SEAT_Y = 66;
const MID = W / 2;

export interface CouchSeat {
  avatar: AvatarConfig | null;
  here: boolean;
}

interface Floater {
  kind: ReactionKind;
  side: 'left' | 'right';
  born: number;
  drift: number;
}

export class CouchCorner {
  readonly canvas: HTMLCanvasElement;
  left: CouchSeat = { avatar: null, here: false };
  right: CouchSeat = { avatar: null, here: false };
  closeness = 0;
  private floaters: Floater[] = [];
  private timer = 0;
  private t0 = performance.now();

  constructor(scale = 2) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    this.canvas.style.width = `${W * scale}px`;
    this.canvas.style.height = `${H * scale}px`;
    this.canvas.style.imageRendering = 'pixelated';
  }

  run(on: boolean) {
    if (on && !this.timer) this.timer = window.setInterval(() => this.draw(), 110);
    if (!on && this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
    if (on) this.draw();
  }

  float(kind: ReactionKind, side: 'left' | 'right') {
    this.floaters.push({ kind, side, born: performance.now(), drift: Math.random() * 6 - 3 });
    if (this.floaters.length > 12) this.floaters.shift();
  }

  private seatX(side: 'left' | 'right') {
    const off = Math.round(22 - 15 * Math.max(0, Math.min(1, this.closeness)));
    return side === 'left' ? MID - off : MID + off;
  }

  private draw() {
    const t = (performance.now() - this.t0) / 1000;
    const b = new PixelBuffer(W, H);
    const ink = '#2b1e1c';
    const base = '#b8674f';
    const dark = '#8f4b3a';
    const hi = '#cf8a6e';
    // back
    b.rect(12, SEAT_Y - 16, W - 24, 12, base);
    b.hline(12, SEAT_Y - 16, W - 24, hi);
    b.rect(12, SEAT_Y - 5, W - 24, 1, dark);
    // seat cushions
    b.rect(14, SEAT_Y - 4, W - 28, 7, hi);
    b.rect(14, SEAT_Y + 3, W - 28, 5, dark);
    b.vline(MID, SEAT_Y - 4, 7, dark);
    // arms
    for (const x of [7, W - 14]) {
      b.rect(x, SEAT_Y - 9, 7, 17, base);
      b.hline(x, SEAT_Y - 9, 7, hi);
      b.rect(x, SEAT_Y + 3, 7, 5, dark);
    }
    // legs
    for (const x of [10, W - 12]) b.rect(x, SEAT_Y + 8, 2, 3, ink);

    for (const side of ['left', 'right'] as const) {
      const seat = side === 'left' ? this.left : this.right;
      if (!seat.avatar) continue;
      const phase = side === 'left' ? 0 : 1.7;
      const blink = (t + phase) % 4.2 < 0.12;
      const bob = Math.sin((t + phase) * 1.6) > 0.55 ? 1 : 0;
      const { buf, anchor } = renderCharacter(seat.avatar, 'sit', { blink, bob, sleepy: !seat.here });
      b.blit(buf, this.seatX(side) - anchor.x, SEAT_Y - anchor.y, side === 'right');
      if (!seat.here) {
        // a little "z"
        const zx = this.seatX(side) + (side === 'left' ? -8 : 5);
        const zy = SEAT_Y - 38 - Math.floor((t * 3) % 4);
        b.sprite(['####', '..#.', '.#..', '####'], { '#': '#f4e8d0' }, zx, zy);
      }
    }

    // reactions drifting up from whoever sent them
    const now = performance.now();
    this.floaters = this.floaters.filter((f) => now - f.born < 2600);
    for (const f of this.floaters) {
      const k = (now - f.born) / 2600;
      const icon = ICONS[f.kind];
      const x = Math.round(this.seatX(f.side) - 3 + f.drift * k + Math.sin(k * 9) * 1.5);
      const y = Math.round(SEAT_Y - 34 - k * 30);
      const alpha = Math.round(255 * (k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3));
      icon.rows.forEach((row, j) => {
        for (let i = 0; i < row.length; i++) {
          const c = icon.pal[row[i]];
          if (c) b.set(x + i, y + j, c, alpha);
        }
      });
    }

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const img = ctx.createImageData(W, H);
    img.data.set(b.data);
    ctx.putImageData(img, 0, 0);
  }
}

/** A small pixel face for the chat. */
const faces = new Map<string, string>();
export function faceURL(avatar: AvatarConfig) {
  const k = JSON.stringify(avatar);
  const hit = faces.get(k);
  if (hit) return hit;
  const { buf, headTop } = renderCharacter(avatar, 'stand');
  const box = { x: 3, y: headTop - 7, w: 18, h: 18 };
  const c = document.createElement('canvas');
  c.width = box.w;
  c.height = box.h;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const img = ctx.createImageData(box.w, box.h);
  for (let y = 0; y < box.h; y++) {
    const sy = y + box.y;
    if (sy < 0 || sy >= buf.h) continue;
    const from = (sy * buf.w + box.x) * 4;
    img.data.set(buf.data.subarray(from, from + box.w * 4), y * box.w * 4);
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL();
  faces.set(k, url);
  return url;
}

/** One reaction icon as a data URL (for the buttons). */
export function iconURL(kind: ReactionKind, scale = 4) {
  const icon = ICONS[kind];
  const w = Math.max(...icon.rows.map((r) => r.length));
  const h = icon.rows.length;
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  icon.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const col = icon.pal[row[i]];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(i * scale, j * scale, scale, scale);
    }
  });
  return c.toDataURL();
}
