import { PixelBuffer, BAYER4, mix } from '../pixel/buffer';
import { GLYPHS, GlyphId } from './glyphs';

/** Escape-room scenes are painted at 200×120 and scaled up. */
export const SW = 200;
export const SH = 120;

export class Scene extends PixelBuffer {
  emit: Uint8Array;
  constructor() {
    super(SW, SH);
    this.emit = new Uint8Array(SW * SH);
  }
  reset() {
    this.data.fill(0);
    this.emit.fill(0);
  }
  /** a pixel that makes its own light (not darkened by the room) */
  glow(x: number, y: number, c: string, a = 255) {
    this.set(x, y, c, a);
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.emit[y * this.w + x] = 1;
  }
  glowRect(x: number, y: number, w: number, h: number, c: string) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.glow(i, j, c);
  }
  /** a solid block with a lit top edge and shaded bottom/right edges */
  box(x: number, y: number, w: number, h: number, c: string) {
    this.rect(x, y, w, h, c);
    this.hline(x, y, w, mix(c, '#ffffff', 0.18));
    this.hline(x, y + h - 1, w, mix(c, '#000000', 0.35));
    this.vline(x + w - 1, y + 1, h - 1, mix(c, '#000000', 0.25));
  }
  frame(x: number, y: number, w: number, h: number, c: string) {
    this.hline(x, y, w, c);
    this.hline(x, y + h - 1, w, c);
    this.vline(x, y, h, c);
    this.vline(x + w - 1, y, h, c);
  }
  disc(cx: number, cy: number, r: number, c: string, glow = false) {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) (glow ? this.glow(x, y, c) : this.set(x, y, c));
  }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let i = 0; i <= n; i++) this.set(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c);
  }
  glyph(id: GlyphId, x: number, y: number, c: string, glow = false) {
    GLYPHS[id].forEach((row, j) => [...row].forEach((k, i) => k === '#' && (glow ? this.glow(x + i, y + j, c) : this.set(x + i, y + j, c))));
  }
}

/* ---------- common bits of scenery ---------- */

export function planks(s: Scene, y0: number, a: string, b: string, seam: string) {
  let y = y0;
  let row = 0;
  const hs = [3, 4, 4, 5, 6, 7, 8, 9];
  while (y < SH) {
    const h = hs[Math.min(row, hs.length - 1)];
    s.rect(0, y, SW, h, row % 2 ? a : b);
    s.hline(0, y, SW, seam);
    const span = 34 + row * 7;
    for (let x = (row * 19) % span; x < SW; x += span) s.vline(x, y, h, seam);
    y += h;
    row++;
  }
}

export function stoneWall(s: Scene, x0: number, y0: number, w: number, h: number, a: string, b: string, mortar: string) {
  s.rect(x0, y0, w, h, mortar);
  for (let y = y0, r = 0; y < y0 + h; y += 6, r++)
    for (let x = x0 - (r % 2 ? 5 : 0); x < x0 + w; x += 10) {
      const cx = Math.max(x0, x);
      const cw = Math.min(x + 9, x0 + w) - cx;
      if (cw <= 0) continue;
      const c = (x * 7 + y * 3) % 11 > 6 ? a : b;
      s.rect(cx, y, cw, Math.min(5, y0 + h - y), c);
      s.hline(cx, y, cw, mix(c, '#ffffff', 0.12));
    }
}

export function candle(s: Scene, x: number, y: number, wax: string, lit: boolean, t: number, h = 6) {
  s.rect(x, y - h, 3, h, wax);
  s.vline(x + 2, y - h, h, mix(wax, '#000000', 0.25));
  if (!lit) {
    s.set(x + 1, y - h - 1, '#2a2020');
    return;
  }
  const f = Math.sin(t * 9 + x) > 0.2 ? 0 : 1;
  s.glow(x + 1, y - h - 1, '#ffd36b');
  s.glow(x + 1, y - h - 2 - f, '#fff2b8');
  s.glow(x + (f ? 0 : 2), y - h - 2, '#ffb44a');
}

export function clockFace(s: Scene, cx: number, cy: number, r: number, h: number, m: number, face = '#efe3cb', ink = '#3a2a26') {
  s.disc(cx, cy, r + 1, '#5a3a2c');
  s.disc(cx, cy, r, face);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    s.set(Math.round(cx + Math.sin(a) * (r - 1)), Math.round(cy - Math.cos(a) * (r - 1)), mix(face, ink, 0.6));
  }
  const ma = (m / 60) * Math.PI * 2;
  const ha = (((h % 12) + m / 60) / 12) * Math.PI * 2;
  s.line(cx, cy, cx + Math.sin(ma) * (r - 1.5), cy - Math.cos(ma) * (r - 1.5), ink);
  s.line(cx, cy, cx + Math.sin(ha) * (r - 3), cy - Math.cos(ha) * (r - 3), ink);
  s.set(cx, cy, '#a84f4b');
}

/* ---------- lighting ---------- */

export interface Light {
  x: number;
  y: number;
  r: number;
  c: [number, number, number];
  k?: number;
}

/**
 * Darkens everything that doesn't glow, then adds banded light from each
 * source (a few flat steps with a little dither, like the living room).
 */
export function lightScene(s: Scene, lights: Light[], ambient: [number, number, number], levels = 5) {
  const d = s.data;
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const p = y * SW + x;
      if (s.emit[p]) continue;
      let tot = 0;
      let tr = 0;
      let tg = 0;
      let tb = 0;
      for (const l of lights) {
        let v = 1 - Math.hypot(x - l.x, (y - l.y) * 1.15) / l.r;
        if (v <= 0) continue;
        v = v * v * (l.k ?? 1);
        tot += v;
        tr += l.c[0] * v;
        tg += l.c[1] * v;
        tb += l.c[2] * v;
      }
      let r = ambient[0];
      let g = ambient[1];
      let b = ambient[2];
      if (tot > 0) {
        const q = Math.floor(tot * levels + 0.5 + (BAYER4[y & 3][x & 3] - 0.5) * 0.3) / levels;
        r += (tr / tot) * q;
        g += (tg / tot) * q;
        b += (tb / tot) * q;
      }
      const o = p * 4;
      d[o] = Math.min(255, d[o] * r);
      d[o + 1] = Math.min(255, d[o + 1] * g);
      d[o + 2] = Math.min(255, d[o + 2] * b);
    }
}

export const WARM: [number, number, number] = [1.1, 0.82, 0.55];
export const CANDLE: [number, number, number] = [1.15, 0.78, 0.45];
export const MOONLIGHT: [number, number, number] = [0.6, 0.72, 1.0];
export const GHOST: [number, number, number] = [0.55, 1.0, 0.85];
export const MAGIC: [number, number, number] = [0.85, 0.65, 1.15];
