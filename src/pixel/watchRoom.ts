import { PixelBuffer, BAYER4, hash, mix } from './buffer';
import { renderCharacterBack } from './characterBack';
import type { AvatarConfig } from '../types';

/**
 * Watch-party view: the camera has swung round behind the couch. The two of
 * you are seen from behind, looking at a big TV on the wall. The YouTube
 * player is a real <iframe> laid exactly over TV_SCREEN, so nothing here is
 * ever drawn on top of the video.
 */

export const WATCH_W = 320;
export const WATCH_H = 180;
export const TV_SCREEN = { x: 80, y: 14, w: 160, h: 90 };

export type ReactionKind = 'heart' | 'laugh' | 'wow' | 'cry';

export interface WatchSeat {
  avatar: AvatarConfig | null;
}

export interface WatchState {
  left: WatchSeat;
  right: WatchSeat;
  /** 'idle' = no video loaded, 'paused', 'playing' */
  tv: 'idle' | 'paused' | 'playing';
  reactions: Array<{ kind: ReactionKind; seat: 'left' | 'right'; t0: number }>;
}

const SEAT_L = 136;
const SEAT_R = 184;
const COUCH_TOP = 150;

class Layer extends PixelBuffer {
  emit: Uint8Array;
  constructor(w: number, h: number) {
    super(w, h);
    this.emit = new Uint8Array(w * h);
  }
  glow(x: number, y: number, c: string, a = 255) {
    this.set(x, y, c, a);
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.emit[y * this.w + x] = 1;
  }
  copyFrom(o: Layer) {
    this.data.set(o.data);
    this.emit.set(o.emit);
  }
}

const C = {
  wall: '#4f5f53',
  stripe: '#4c5b50',
  crown: '#3f2e29',
  wains: '#6a4a3a',
  wainsL: '#7d5a47',
  wainsD: '#523829',
  floorA: '#7a5337',
  floorB: '#6f4b31',
  seam: '#4e3322',
  wood: '#6b4633',
  woodL: '#845a42',
  woodD: '#4d3224',
  couch: '#b8674f',
  couchL: '#cc7c62',
  couchD: '#95513e',
  couchDD: '#763f31',
  bezel: '#1f1b1d',
  bezelL: '#3a3437',
  brass: '#b48c4a',
  brassL: '#d6ad63',
  frame: '#e6d6b8',
  frameD: '#bba888',
  leaf: '#6f8f4e',
  leafL: '#8fae62',
  leafD: '#4f6e38',
  pot: '#b8674f',
};

function drawStatic(L: Layer) {
  // wall + wallpaper
  L.rect(0, 0, WATCH_W, 120, C.wall);
  for (let x = 0; x < WATCH_W; x += 8) L.rect(x, 4, 3, 92, C.stripe);
  L.rect(0, 0, WATCH_W, 4, C.crown);
  L.hline(0, 3, WATCH_W, '#57403a');
  // wainscot
  L.rect(0, 96, WATCH_W, 24, C.wains);
  L.hline(0, 96, WATCH_W, C.wainsL);
  L.hline(0, 97, WATCH_W, C.wainsD);
  for (let x = 4; x < WATCH_W; x += 24) {
    L.rect(x, 101, 18, 12, C.wainsD);
    L.rect(x + 1, 102, 16, 10, C.wains);
  }
  L.rect(0, 116, WATCH_W, 4, '#432e22');
  // floor
  let y = 120;
  let row = 0;
  for (const h of [4, 5, 6, 7, 8, 9, 10, 12, 14]) {
    if (y >= WATCH_H) break;
    const col = row % 2 ? C.floorA : C.floorB;
    L.rect(0, y, WATCH_W, h, col);
    L.hline(0, y, WATCH_W, C.seam);
    for (let x = (row * 29) % 48; x < WATCH_W; x += 48 + row * 6) L.vline(x, y, h, C.seam);
    y += h;
    row++;
  }
  // rug peeking out under the couch
  for (let yy = 150; yy < WATCH_H; yy++)
    for (let x = 40 - (yy - 150); x < 280 + (yy - 150); x++) {
      const border = yy < 152 || x < 43 - (yy - 150) || x > 276 + (yy - 150);
      L.set(x, yy, border ? '#7d8b69' : (x + yy) % 9 === 0 ? '#b8674f' : '#e3cfa7');
    }

  // window with snow (left)
  const wx = 8, wy = 20, ww = 42, wh = 56;
  L.rect(wx - 3, wy - 3, ww + 6, wh + 6, C.frameD);
  L.rect(wx - 2, wy - 2, ww + 4, wh + 4, C.frame);
  for (let j = 0; j < wh; j++)
    for (let i = 0; i < ww; i++) {
      const t = (j / wh) * 3 + BAYER4[j & 3][i & 3] * 0.9;
      L.glow(wx + i, wy + j, t < 1 ? '#1b2340' : t < 2 ? '#232d52' : '#2e3a64');
    }
  for (let i = 0; i < ww; i++) {
    const hh = Math.round(5 + Math.sin(i * 0.2 + 1) * 3);
    for (let j = 0; j < hh; j++) L.glow(wx + i, wy + wh - 1 - j, j === hh - 1 ? '#dfe6f0' : '#3b4668');
  }
  for (let k = 0; k < 10; k++) L.glow(wx + ((hash(k * 5.1) * ww) | 0), wy + ((hash(k * 2.3) * wh * 0.5) | 0), '#c9d2ea');
  L.rect(wx + ww / 2 - 1, wy, 2, wh, C.frame);
  L.rect(wx, wy + 26, ww, 2, C.frame);
  for (let j = wy; j < wy + wh; j++) {
    L.emit[j * WATCH_W + wx + ww / 2 - 1] = 0;
    L.emit[j * WATCH_W + wx + ww / 2] = 0;
  }
  for (let i = wx; i < wx + ww; i++) {
    L.emit[(wy + 26) * WATCH_W + i] = 0;
    L.emit[(wy + 27) * WATCH_W + i] = 0;
  }
  // curtains
  for (const [cx, dir] of [
    [2, 1],
    [56, -1],
  ] as const)
    for (let j = 0; j < 84; j++)
      for (let i = 0; i < 8 + Math.round(Math.max(0, j - 40) * 0.06); i++) {
        const f = (i + (j > 44 ? 1 : 0)) % 4;
        L.set(cx + i * dir, 14 + j, f === 0 ? '#b8a37f' : f === 1 ? '#d8c6a3' : f === 2 ? '#e7d8ba' : '#cdb994');
      }
  L.rect(0, 13, 64, 2, C.brass);

  // floor lamp between window and TV
  const lx = 67;
  L.vline(lx, 58, 62, C.brass);
  L.rect(lx - 4, 118, 9, 2, C.brass);
  for (let j = 0; j < 12; j++) {
    const half = 4 + Math.floor(j / 2.5);
    for (let i = -half; i <= half; i++) L.glow(lx + i, 46 + j, i === -half || i === half || j === 11 ? '#e8c787' : '#f6e0a8');
  }

  // TV: bezel, stand shadow, LED
  const s = TV_SCREEN;
  L.rect(s.x - 5, s.y - 5, s.w + 10, s.h + 10, '#141113');
  L.rect(s.x - 4, s.y - 4, s.w + 8, s.h + 8, C.bezel);
  L.hline(s.x - 4, s.y - 4, s.w + 8, C.bezelL);
  L.vline(s.x - 4, s.y - 4, s.h + 8, '#2c2729');
  L.rect(s.x + s.w - 6, s.y + s.h + 1, 2, 1, '#d44b3a');
  // soundbar under the TV
  L.rect(s.x + 40, s.y + s.h + 6, 80, 3, '#262124');
  L.hline(s.x + 40, s.y + s.h + 6, 80, '#3a3437');
  for (let x = s.x + 42; x < s.x + 118; x += 2) L.set(x, s.y + s.h + 7, '#1a1618');

  // media console
  L.rect(78, 112, 164, 14, C.wood);
  L.hline(78, 112, 164, C.woodL);
  L.rect(78, 125, 164, 2, C.woodD);
  for (const dx of [0, 41, 82, 123]) {
    L.rect(81 + dx, 115, 37, 9, C.woodD);
    L.rect(82 + dx, 116, 35, 7, C.wood);
    L.rect(98 + dx, 118, 3, 1, C.brassL);
  }
  // console decor: plant, candle, books, a little framed photo
  L.rect(84, 104, 8, 8, C.pot);
  for (const [px, py] of [[83, 101], [86, 99], [89, 100], [91, 102], [85, 103], [88, 97], [92, 99]]) {
    L.set(px, py, C.leaf);
    L.set(px + 1, py, C.leafL);
    L.set(px, py + 1, C.leafD);
  }
  L.rect(226, 106, 3, 6, '#efe3cb');
  L.rect(230, 108, 3, 4, '#efe3cb');
  L.rect(213, 104, 10, 8, C.woodD);
  L.rect(214, 105, 8, 6, '#e6d6b8');
  L.rect(215, 106, 6, 4, '#c6a489');

  // bookshelf (right)
  const bx = 262;
  L.rect(bx, 28, 40, 92, C.woodD);
  L.rect(bx + 2, 30, 36, 88, C.wood);
  const cols = ['#7a5068', '#4f6583', '#d09a3e', '#8a9a72', '#b8674f', '#efe3cb', '#4d6b52'];
  for (let sh = 0; sh < 4; sh++) {
    const sy = 30 + sh * 22;
    L.rect(bx + 2, sy + 20, 36, 2, C.woodL);
    let x = bx + 3;
    let k = sh * 5;
    while (x < bx + 36) {
      const w = 2 + ((hash(k + 3) * 3) | 0);
      const h = 11 + ((hash(k + 11) * 7) | 0);
      if (hash(k * 7) > 0.85) {
        x += w + 2;
        k++;
        continue;
      }
      const c = cols[k % cols.length];
      L.rect(x, sy + 20 - h, Math.min(w, bx + 37 - x), h, c);
      L.hline(x, sy + 22 - h, Math.min(w, bx + 37 - x), mix(c, '#ffffff', 0.25));
      x += w;
      k++;
    }
  }
  // edge of the chimney (fire is just off-screen right)
  for (let y2 = 4; y2 < 120; y2 += 4)
    for (let x2 = 306 + ((y2 / 4) % 2 ? 0 : 4); x2 < WATCH_W; x2 += 8) {
      L.rect(x2, y2, 7, 3, hash(x2 + y2) > 0.6 ? '#ad6a51' : '#9a5a44');
    }
  L.vline(305, 4, 116, '#814736');
}

function drawCouchBack(L: Layer) {
  // the couch from behind: long rounded back, arms lower at each end
  const x0 = 72;
  const x1 = 248;
  for (let y = COUCH_TOP; y < WATCH_H; y++) {
    const inset = y === COUCH_TOP ? 4 : y === COUCH_TOP + 1 ? 2 : y === COUCH_TOP + 2 ? 1 : 0;
    for (let x = x0 + inset; x < x1 - inset; x++) {
      let c = C.couch;
      const r = y - COUCH_TOP;
      if (r < 2) c = C.couchL;
      else if (r < 5) c = C.couch;
      else if (r > 16) c = C.couchDD;
      else c = r % 7 === 0 ? C.couchD : C.couch;
      if (x === Math.floor((x0 + x1) / 2)) c = C.couchD; // seam between cushions
      L.set(x, y, c);
    }
  }
  // arms
  for (const ax of [x0 - 14, x1 - 2]) {
    for (let y = COUCH_TOP + 7; y < WATCH_H; y++) {
      const r = y - COUCH_TOP - 7;
      for (let x = ax; x < ax + 16; x++) {
        const edge = r === 0 && (x === ax || x === ax + 15);
        if (edge) continue;
        L.set(x, y, r < 2 ? C.couchL : r > 12 ? C.couchDD : C.couchD);
      }
    }
  }
  // blanket draped over the back, just to the right
  for (let j = 0; j < 16; j++)
    for (let i = 0; i < 18 - Math.floor(j / 4); i++) {
      const c = ((j >> 1) + (i >> 2)) % 2 ? '#8a9a72' : '#6a7856';
      L.set(214 + i + Math.floor(j / 3), COUCH_TOP - 1 + j, j === 0 ? '#a2b187' : c);
    }
}

let STATIC: Layer | null = null;
function staticLayer() {
  if (!STATIC) {
    STATIC = new Layer(WATCH_W, WATCH_H);
    drawStatic(STATIC);
  }
  return STATIC;
}

function drawScreenStandby(L: Layer, t: number, state: WatchState['tv']) {
  const s = TV_SCREEN;
  // what shows before a video loads / behind the iframe while it boots
  for (let j = 0; j < s.h; j++)
    for (let i = 0; i < s.w; i++) {
      const v = 0.5 + 0.5 * Math.sin(i * 0.05 + t * 0.6) * Math.cos(j * 0.07 - t * 0.4);
      const c = state === 'idle' ? (v + BAYER4[j & 3][i & 3] * 0.4 > 0.8 ? '#1c2438' : '#141a2a') : '#0b0b10';
      L.glow(s.x + i, s.y + j, c);
    }
  if (state === 'idle') {
    // little pixel "play" glyph in the middle
    const cx = s.x + s.w / 2 - 3;
    const cy = s.y + s.h / 2 - 12;
    for (let j = 0; j < 9; j++) for (let i = 0; i <= Math.min(j, 8 - j); i++) L.glow(cx + i, cy + j, '#e9d7b7');
  }
}

export const ICONS: Record<ReactionKind, { rows: string[]; pal: Record<string, string> }> = {
  heart: {
    rows: ['.##.##.', '#######', '#h#####', '.#####.', '..###..', '...#...'],
    pal: { '#': '#d9534f', h: '#f3a19c' },
  },
  laugh: {
    rows: ['.yyyyy.', 'yyyyyyy', 'yeyyyey', 'yyyyyyy', 'yeeeeey', 'yyeeeyy', '.yyyyy.'],
    pal: { y: '#f2c14e', e: '#5a3a2c' },
  },
  wow: {
    rows: ['.yyyyy.', 'yyyyyyy', 'yeyyyey', 'yyyyyyy', 'yyyeyyy', 'yyyeyyy', '.yyyyy.'],
    pal: { y: '#f2c14e', e: '#5a3a2c' },
  },
  cry: {
    rows: ['.yyyyy.', 'yyyyyyy', 'yeyyyey', 'byyyyyy', 'byyeyyy', 'yyeyeyy', '.yyyyy.'],
    pal: { y: '#f2c14e', e: '#5a3a2c', b: '#6fa8dc' },
  },
};

function drawReactions(L: Layer, state: WatchState, now: number, seatTop: Record<'left' | 'right', number>) {
  for (const r of state.reactions) {
    const age = (now - r.t0) / 1000;
    if (age < 0 || age > 1.8) continue;
    const icon = ICONS[r.kind];
    // pop up beside the head (outer side), never up into the TV screen
    const x = (r.seat === 'left' ? SEAT_L - 24 : SEAT_R + 17) + Math.round(Math.sin(age * 5) * 1.5);
    const y = Math.round(seatTop[r.seat] + 8 - Math.min(age, 1) * 8);
    const alpha = Math.round(255 * Math.min(1, (1.8 - age) / 0.6));
    for (let j = 0; j < icon.rows.length; j++)
      for (let i = 0; i < icon.rows[j].length; i++) {
        const c = icon.pal[icon.rows[j][i]];
        if (!c) continue;
        L.glow(x + i, y + j, c, alpha);
      }
  }
}

/* lighting ---------------------------------------------------------------- */

interface Light {
  x: number;
  y: number;
  r: number;
  c: [number, number, number];
}
const LIGHTS: Light[] = [
  { x: 160, y: 60, r: 240, c: [0.62, 0.72, 0.98] }, // TV
  { x: 345, y: 120, r: 175, c: [1.08, 0.7, 0.42] }, // fire, off-screen right
  { x: 67, y: 52, r: 62, c: [0.95, 0.78, 0.52] }, // lamp
];
let DIST: Float32Array[] | null = null;
function dists() {
  if (DIST) return DIST;
  DIST = LIGHTS.map((l) => {
    const a = new Float32Array(WATCH_W * WATCH_H);
    for (let y = 0; y < WATCH_H; y++)
      for (let x = 0; x < WATCH_W; x++) a[y * WATCH_W + x] = Math.hypot(x - l.x, (y - l.y) * 1.2);
    return a;
  });
  return DIST;
}

function light(L: Layer, t: number, tv: WatchState['tv']) {
  const d = dists();
  // TV light flickers with "the picture" while playing
  const tvK = tv === 'playing' ? 0.62 + 0.18 * hash(Math.floor(t * 3)) + 0.08 * Math.sin(t * 5) : tv === 'paused' ? 0.55 : 0.4;
  const fireK = 0.85 + Math.sin(t * 7.3) * 0.04 + (hash(Math.floor(t * 12)) - 0.5) * 0.06;
  const ks = [tvK, fireK, 0.6];
  const amb = [0.3, 0.29, 0.42];
  const levels = 5;
  const data = L.data;
  for (let y = 0; y < WATCH_H; y++)
    for (let x = 0; x < WATCH_W; x++) {
      const p = y * WATCH_W + x;
      if (L.emit[p]) continue;
      let tot = 0;
      let tr = 0;
      let tg = 0;
      let tb = 0;
      for (let i = 0; i < LIGHTS.length; i++) {
        let v = 1 - d[i][p] / LIGHTS[i].r;
        if (v <= 0) continue;
        v = Math.pow(v, 1.4) * ks[i];
        tot += v;
        tr += LIGHTS[i].c[0] * v;
        tg += LIGHTS[i].c[1] * v;
        tb += LIGHTS[i].c[2] * v;
      }
      let r = amb[0];
      let g = amb[1];
      let b = amb[2];
      if (tot > 0) {
        const th = (BAYER4[y & 3][x & 3] - 0.5) * 0.24;
        const q = Math.floor(tot * levels + 0.5 + th) / levels;
        r += (tr / tot) * q;
        g += (tg / tot) * q;
        b += (tb / tot) * q;
      }
      const o = p * 4;
      data[o] = Math.min(255, data[o] * r);
      data[o + 1] = Math.min(255, data[o + 1] * g);
      data[o + 2] = Math.min(255, data[o + 2] * b);
    }
}

/* ------------------------------------------------------------------------- */

const FRAME = new Layer(WATCH_W, WATCH_H);
const RIM: Array<[number, number]> = [];

function rimLight(L: Layer, tv: WatchState['tv'], t: number) {
  // cool glow from the screen catching the tops of heads and shoulders
  const k = tv === 'playing' ? 0.55 + 0.2 * hash(Math.floor(t * 3)) : tv === 'paused' ? 0.5 : 0.35;
  for (const [x, y] of RIM) {
    if (x < 0 || y < 0 || x >= WATCH_W || y >= COUCH_TOP) continue;
    const o = (y * WATCH_W + x) * 4;
    L.data[o] = Math.min(255, L.data[o] + 70 * k);
    L.data[o + 1] = Math.min(255, L.data[o + 1] + 85 * k);
    L.data[o + 2] = Math.min(255, L.data[o + 2] + 115 * k);
  }
  RIM.length = 0;
}

export function renderWatchRoom(state: WatchState, t: number, now = Date.now()): PixelBuffer {
  const L = FRAME;
  L.copyFrom(staticLayer());
  drawScreenStandby(L, t, state.tv);

  // snow in the window
  for (let k = 0; k < 18; k++) {
    const sy = ((hash(k * 3.7) * 56 + t * (5 + hash(k) * 5)) % 56) | 0;
    const sx = (8 + ((hash(k * 1.3) * 42 + Math.sin(t + k) * 2 + 42) % 42)) | 0;
    if (sx === 28 || sx === 29 || (sy >= 26 && sy <= 27)) continue;
    L.glow(sx, 20 + sy, '#e8eef6');
  }
  // candle flicker on the console
  const f = Math.sin(t * 11) > 0.3 ? 1 : 0;
  L.glow(227, 104 - f, '#ffd36b');
  L.glow(231, 106 - f, '#ffd36b');

  // the two of you, from behind
  const both = !!(state.left.avatar && state.right.avatar);
  const seatTop: Record<'left' | 'right', number> = { left: 120, right: 120 };
  const draw = (seat: WatchSeat, cx: number, side: 'left' | 'right', phase: number) => {
    if (!seat.avatar) {
      // a plumped cushion saving the spot
      for (let j = 0; j < 9; j++)
        for (let i = -8; i <= 8; i++) {
          if ((j === 0 || j === 8) && Math.abs(i) > 6) continue;
          L.set(cx + i, COUCH_TOP - 8 + j, j < 2 ? '#f6ecd8' : j > 6 ? '#c9b894' : '#eadcc0');
        }
      seatTop[side] = COUCH_TOP - 8;
      return;
    }
    const lean = both ? (side === 'left' ? 1 : -1) : 0;
    const bob = Math.sin(t * 1.4 + phase) > 0.7 ? 1 : 0;
    const { buf, anchor, headTop } = renderCharacterBack(seat.avatar, { lean, bob });
    const x = cx - anchor.x;
    const y = COUCH_TOP + 9 - anchor.y;
    L.blit(buf, x, y);
    seatTop[side] = y + headTop;
    // remember the top edge so the TV can rim-light it after the room is lit
    for (let i = 0; i < buf.w; i++)
      for (let j = 0; j < buf.h; j++)
        if (buf.alphaAt(i, j) > 0) {
          RIM.push([x + i, y + j], [x + i, y + j + 1]);
          if (buf.alphaAt(i - 1, j + 2) === 0 || buf.alphaAt(i + 1, j + 2) === 0) RIM.push([x + i, y + j + 2]);
          break;
        }
  };
  draw(state.left, SEAT_L, 'left', 0);
  draw(state.right, SEAT_R, 'right', 1.9);
  drawCouchBack(L);

  light(L, t, state.tv);
  rimLight(L, state.tv, t);
  drawReactions(L, state, now, seatTop);
  return L;
}
