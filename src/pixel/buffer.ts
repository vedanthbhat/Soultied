/**
 * Tiny software pixel buffer. Everything in Soultied's world is drawn into one
 * of these at native pixel resolution, then blitted to a <canvas> and scaled up
 * with `image-rendering: pixelated`. No image files, no smoothing, no blur.
 */

export type RGB = [number, number, number];

const colorCache = new Map<string, RGB>();

export function hex(c: string): RGB {
  let v = colorCache.get(c);
  if (v) return v;
  const h = c.replace('#', '');
  v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  colorCache.set(c, v);
  return v;
}

export function mix(a: string, b: string, t: number): string {
  const A = hex(a);
  const B = hex(b);
  const r = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t);
  return '#' + [r(0), r(1), r(2)].map((n) => n.toString(16).padStart(2, '0')).join('');
}

/** Map of single-character keys to colors used by ASCII sprites. */
export type Palette = Record<string, string | undefined>;

export class PixelBuffer {
  readonly w: number;
  readonly h: number;
  /** RGBA, row-major */
  readonly data: Uint8ClampedArray;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  clear() {
    this.data.fill(0);
  }

  set(x: number, y: number, c: string | RGB, alpha = 255) {
    x |= 0;
    y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const rgb = typeof c === 'string' ? hex(c) : c;
    const i = (y * this.w + x) * 4;
    if (alpha >= 255) {
      this.data[i] = rgb[0];
      this.data[i + 1] = rgb[1];
      this.data[i + 2] = rgb[2];
      this.data[i + 3] = 255;
    } else {
      const a = alpha / 255;
      this.data[i] = this.data[i] * (1 - a) + rgb[0] * a;
      this.data[i + 1] = this.data[i + 1] * (1 - a) + rgb[1] * a;
      this.data[i + 2] = this.data[i + 2] * (1 - a) + rgb[2] * a;
      this.data[i + 3] = Math.max(this.data[i + 3], alpha);
    }
  }

  alphaAt(x: number, y: number) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  rect(x: number, y: number, w: number, h: number, c: string, alpha = 255) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, alpha);
  }

  hline(x: number, y: number, w: number, c: string) {
    this.rect(x, y, w, 1, c);
  }

  vline(x: number, y: number, h: number, c: string) {
    this.rect(x, y, 1, h, c);
  }

  /**
   * Draw an ASCII sprite. Each char is looked up in the palette; '.' and ' '
   * and unknown keys are transparent.
   */
  sprite(rows: string[], pal: Palette, x: number, y: number, flip = false) {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const k = row[i];
        if (k === '.' || k === ' ') continue;
        const c = pal[k];
        if (!c) continue;
        const px = flip ? x + row.length - 1 - i : x + i;
        this.set(px, y + j, c);
      }
    }
  }

  /** Copy another buffer onto this one (alpha-tested). */
  blit(src: PixelBuffer, x: number, y: number, flip = false) {
    for (let j = 0; j < src.h; j++) {
      for (let i = 0; i < src.w; i++) {
        const si = (j * src.w + i) * 4;
        const a = src.data[si + 3];
        if (a === 0) continue;
        const dx = flip ? x + src.w - 1 - i : x + i;
        this.set(dx, y + j, [src.data[si], src.data[si + 1], src.data[si + 2]], a);
      }
    }
  }

  /**
   * Selective outline: every transparent pixel touching an opaque one becomes a
   * darkened version of that neighbour. Gives sprites a soft, consistent edge.
   */
  outline(darken = 0.42, tint: RGB = [40, 22, 30]) {
    const { w, h, data } = this;
    const out: Array<[number, number, RGB]> = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (data[(y * w + x) * 4 + 3] !== 0) continue;
        let n = -1;
        const nb = [
          [x, y - 1],
          [x - 1, y],
          [x + 1, y],
          [x, y + 1],
        ];
        for (const [nx, ny] of nb) {
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = (ny * w + nx) * 4;
          if (data[ni + 3] === 255) {
            n = ni;
            break;
          }
        }
        if (n < 0) continue;
        const c: RGB = [
          Math.round(data[n] * darken + tint[0] * (1 - darken) * 0.6),
          Math.round(data[n + 1] * darken + tint[1] * (1 - darken) * 0.6),
          Math.round(data[n + 2] * darken + tint[2] * (1 - darken) * 0.6),
        ];
        out.push([x, y, c]);
      }
    }
    for (const [x, y, c] of out) this.set(x, y, c);
  }
}

/** 4x4 Bayer matrix, values 0..1, for ordered dithering. */
export const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((r) => r.map((v) => (v + 0.5) / 16));

/** Deterministic hash noise. */
export function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
