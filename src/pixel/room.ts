import { PixelBuffer, BAYER4, hash, mix, hex } from './buffer';
import { renderCharacter } from './character';
import type { AvatarConfig } from '../types';

/**
 * The living room. 320 x 180 native pixels, drawn from code every frame.
 * Static furniture is cached; fire, snow, candles, steam, cat and the two
 * characters animate on top; then warm banded lighting is applied.
 */

export const ROOM_W = 320;
export const ROOM_H = 180;

export interface Seat {
  avatar: AvatarConfig | null;
  name: string;
  status: 'online' | 'away' | 'offline' | 'empty';
}

export interface RoomState {
  left: Seat;
  right: Seat;
  letterUnread: boolean;
  /** 0..1 fire intensity, lets us "stoke" the fire on click */
  fire: number;
  /** highlight a hotspot (hover) */
  hover?: HotspotId | null;
}

export type HotspotId = 'left' | 'right' | 'letter' | 'fire' | 'photo' | 'remote';

export interface Hotspot {
  id: HotspotId;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Layout constants shared by drawing + hotspots
const FLOOR_Y = 121;
const COUCH = { x: 186, y: 121, w: 92, seatY: 140, baseY: 150 };
const SEAT_LEFT_X = 219;
const SEAT_RIGHT_X = 245;
const FIRE = { x: 128, cx: 128, openX: 114, openW: 29, openY: 78, openB: 116 };
const TABLE = { x: 205, y: 163, w: 54 };

export const HOTSPOTS: Hotspot[] = [
  { id: 'left', x: SEAT_LEFT_X - 10, y: 112, w: 20, h: 38 },
  { id: 'right', x: SEAT_RIGHT_X - 10, y: 112, w: 20, h: 38 },
  { id: 'letter', x: TABLE.x + 19, y: TABLE.y - 9, w: 18, h: 12 },
  { id: 'fire', x: FIRE.openX, y: FIRE.openY, w: FIRE.openW, h: FIRE.openB - FIRE.openY },
  { id: 'photo', x: 138, y: 43, w: 12, h: 12 },
  { id: 'remote', x: TABLE.x + 36, y: TABLE.y - 4, w: 10, h: 6 },
];

/* ------------------------------------------------------------------------ */

const P = {
  crown: '#3f2e29',
  crownL: '#57403a',
  wall: '#4f5f53',
  wallStripe: '#4c5b50',
  wallDot: '#56675a',
  wains: '#6a4a3a',
  wainsL: '#7d5a47',
  wainsD: '#523829',
  wainsDD: '#432e22',
  floorA: '#7a5337',
  floorB: '#6f4b31',
  floorC: '#835a3c',
  floorSeam: '#4e3322',
  brick: '#9a5a44',
  brickL: '#ad6a51',
  brickD: '#814736',
  mortar: '#5f3b30',
  stone: '#a3978a',
  stoneL: '#b8ad9f',
  stoneD: '#817568',
  stoneDD: '#655b51',
  soot: '#221718',
  sootL: '#33221f',
  mantel: '#5a3a2c',
  mantelL: '#7a5540',
  mantelD: '#402920',
  couch: '#b8674f',
  couchL: '#cc7c62',
  couchD: '#95513e',
  couchDD: '#763f31',
  cream: '#efdcb8',
  creamD: '#d2bb93',
  mustard: '#d09a3e',
  mustardD: '#a7772b',
  sage: '#8a9a72',
  sageD: '#6a7856',
  rugA: '#e3cfa7',
  rugB: '#b8674f',
  rugC: '#7d8b69',
  rugD: '#c8b088',
  wood: '#6b4633',
  woodL: '#845a42',
  woodD: '#4d3224',
  leaf: '#6f8f4e',
  leafL: '#8fae62',
  leafD: '#4f6e38',
  pot: '#b8674f',
  potD: '#8f4b3a',
  frame: '#e6d6b8',
  frameD: '#bba888',
  skyA: '#1b2340',
  skyB: '#232d52',
  skyC: '#2e3a64',
  moon: '#f4ecd0',
  brass: '#b48c4a',
  brassL: '#d6ad63',
};

class Layer extends PixelBuffer {
  emit: Uint8Array;
  constructor(w: number, h: number) {
    super(w, h);
    this.emit = new Uint8Array(w * h);
  }
  glow(x: number, y: number, c: string, alpha = 255) {
    this.set(x, y, c, alpha);
    x |= 0;
    y |= 0;
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.emit[y * this.w + x] = 1;
  }
  unglow(x: number, y: number, w: number, h: number) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++) if (i >= 0 && j >= 0 && i < this.w && j < this.h) this.emit[j * this.w + i] = 0;
  }
  copyFrom(o: Layer) {
    this.data.set(o.data);
    this.emit.set(o.emit);
  }
}

/* ------------------------------------------------------------------------ */
/*  Static layer                                                              */
/* ------------------------------------------------------------------------ */

function drawWall(L: Layer) {
  L.rect(0, 0, ROOM_W, FLOOR_Y, P.wall);
  // subtle wallpaper: stripes + tiny sprig motif
  for (let x = 0; x < ROOM_W; x += 8) L.rect(x, 4, 3, 92, P.wallStripe);
  for (let y = 10; y < 92; y += 10) {
    for (let x = (y / 10) % 2 ? 5 : 1; x < ROOM_W; x += 8) {
      L.set(x, y, P.wallDot);
      L.set(x + 1, y + 1, P.wallDot);
      L.set(x - 1, y + 1, P.wallDot);
    }
  }
  // crown moulding
  L.rect(0, 0, ROOM_W, 4, P.crown);
  L.hline(0, 3, ROOM_W, P.crownL);
  L.hline(0, 4, ROOM_W, '#3a4a40');
  // wainscot
  L.rect(0, 94, ROOM_W, FLOOR_Y - 94, P.wains);
  L.hline(0, 94, ROOM_W, P.wainsL);
  L.hline(0, 95, ROOM_W, P.wainsL);
  L.hline(0, 96, ROOM_W, P.wainsD);
  for (let x = 4; x < ROOM_W; x += 24) {
    L.rect(x, 100, 18, 13, P.wainsD);
    L.rect(x + 1, 101, 16, 11, P.wains);
    L.hline(x + 1, 112, 17, P.wainsL);
    L.vline(x + 17, 101, 12, P.wainsL);
  }
  L.rect(0, 116, ROOM_W, 5, P.wainsDD);
  L.hline(0, 116, ROOM_W, P.wainsD);
}

function drawFloor(L: Layer) {
  let y = FLOOR_Y;
  let row = 0;
  const heights = [3, 4, 4, 5, 5, 6, 6, 7, 8, 9, 10];
  while (y < ROOM_H) {
    const h = heights[Math.min(row, heights.length - 1)];
    const col = [P.floorA, P.floorB, P.floorC][row % 3];
    L.rect(0, y, ROOM_W, h, col);
    L.hline(0, y, ROOM_W, P.floorSeam);
    // plank joints, staggered, spaced wider toward the viewer
    const span = 40 + row * 6;
    for (let x = (row * 23) % span; x < ROOM_W; x += span) {
      L.vline(x, y, h, P.floorSeam);
      L.vline(x + 1, y + 1, h - 1, mix(col, '#ffffff', 0.06));
    }
    // grain
    for (let x = 0; x < ROOM_W; x += 3) {
      if (hash(x * 7 + row * 131) > 0.86) L.hline(x, y + 1 + (hash(x + row) * (h - 1)) | 0, 3, mix(col, '#3a2418', 0.18));
    }
    y += h;
    row++;
  }
}

function drawWindow(L: Layer) {
  const x = 22, y = 22, w = 46, h = 58;
  // curtain rod
  L.rect(10, 14, 70, 2, P.brass);
  L.hline(10, 14, 70, P.brassL);
  L.rect(8, 13, 3, 4, P.brassL);
  L.rect(79, 13, 3, 4, P.brassL);
  // frame
  L.rect(x - 3, y - 3, w + 6, h + 6, P.frameD);
  L.rect(x - 2, y - 2, w + 4, h + 4, P.frame);
  // sky (emissive, banded gradient)
  for (let j = 0; j < h; j++) {
    const c = j < h * 0.35 ? P.skyA : j < h * 0.7 ? P.skyB : P.skyC;
    for (let i = 0; i < w; i++) {
      const t = (j / h) * 3 + BAYER4[j & 3][i & 3] * 0.9;
      const band = t < 1 ? P.skyA : t < 2 ? P.skyB : P.skyC;
      L.glow(x + i, y + j, j % 17 === 0 ? c : band);
    }
  }
  // distant hills + snowy rooftops
  for (let i = 0; i < w; i++) {
    const hh = Math.round(6 + Math.sin(i * 0.18) * 3 + Math.sin(i * 0.5) * 1);
    for (let j = 0; j < hh; j++) L.glow(x + i, y + h - 1 - j, j === hh - 1 ? '#dfe6f0' : '#3b4668');
  }
  // tiny lit house in the distance
  L.rect(x + 30, y + h - 14, 7, 5, '#2a3150');
  L.glow(x + 32, y + h - 12, '#f6c46a');
  L.glow(x + 34, y + h - 12, '#f6c46a');
  for (let i = 0; i < 9; i++) L.glow(x + 29 + i, y + h - 15 - Math.min(i, 8 - i) / 2, '#e8eef6');
  // moon
  const mx = x + 34, my = y + 12;
  for (let j = -4; j <= 4; j++)
    for (let i = -4; i <= 4; i++) {
      const d = i * i + j * j;
      if (d <= 17) L.glow(mx + i, my + j, d > 12 ? '#d9d2b8' : P.moon);
    }
  L.glow(mx - 1, my - 1, '#d9d2b8');
  L.glow(mx + 1, my + 2, '#d9d2b8');
  // stars
  for (let k = 0; k < 14; k++) {
    const sx = x + ((hash(k * 3.1) * w) | 0);
    const sy = y + ((hash(k * 7.7) * (h * 0.5)) | 0);
    L.glow(sx, sy, '#c9d2ea');
  }
  // mullions
  L.rect(x + w / 2 - 1, y, 2, h, P.frame);
  L.rect(x, y + 26, w, 2, P.frame);
  L.hline(x, y + 28, w, P.frameD);
  L.unglow(x + w / 2 - 1, y, 2, h);
  L.unglow(x, y + 26, w, 3);
  // sill
  L.rect(x - 5, y + h + 2, w + 10, 3, P.frame);
  L.hline(x - 5, y + h + 4, w + 10, P.frameD);
  // curtains (linen, gathered)
  const curtain = (cx: number, dir: 1 | -1) => {
    for (let j = 0; j < 80; j++) {
      const width = 10 + Math.round(Math.max(0, j - 30) * 0.08) + (j > 60 ? 2 : 0);
      for (let i = 0; i < width; i++) {
        const fold = (i + (j > 40 ? 1 : 0)) % 4;
        const c = fold === 0 ? '#b8a37f' : fold === 1 ? '#d8c6a3' : fold === 2 ? '#e7d8ba' : '#cdb994';
        L.set(cx + i * dir, 16 + j, c);
      }
    }
    // tie-back
    L.rect(dir === 1 ? cx : cx - 11, 56, 12, 2, P.couch);
  };
  curtain(10, 1);
  curtain(80, -1);
}

function drawBricks(L: Layer, x0: number, y0: number, w: number, h: number) {
  L.rect(x0, y0, w, h, P.mortar);
  for (let r = 0; r * 4 < h; r++) {
    const off = r % 2 ? 4 : 0;
    for (let bx = -off; bx < w; bx += 8) {
      const bxx = Math.max(bx, 0);
      const bw = Math.min(bx + 7, w) - bxx;
      if (bw <= 0) continue;
      const n = hash(r * 31 + bx * 7 + x0);
      const col = n > 0.7 ? P.brickL : n < 0.25 ? P.brickD : P.brick;
      L.rect(x0 + bxx, y0 + r * 4, bw, 3, col);
      L.hline(x0 + bxx, y0 + r * 4, bw, mix(col, '#ffffff', 0.08));
    }
  }
}

function drawFireplace(L: Layer) {
  // chimney breast
  drawBricks(L, 100, 5, 56, FLOOR_Y - 5);
  L.vline(100, 5, FLOOR_Y - 5, P.brickD);
  L.vline(155, 5, FLOOR_Y - 5, '#6d3c2e');
  // painting above mantel
  const px = 111, py = 16, pw = 34, ph = 24;
  L.rect(px - 2, py - 2, pw + 4, ph + 4, P.mantelD);
  L.rect(px - 1, py - 1, pw + 2, ph + 2, P.brass);
  for (let j = 0; j < ph; j++)
    for (let i = 0; i < pw; i++) {
      // warm dusk landscape
      const t = j / ph;
      let c = t < 0.3 ? '#e9b97a' : t < 0.5 ? '#e39a6a' : '#d8866a';
      const hill1 = ph * 0.55 + Math.sin(i * 0.25) * 3;
      const hill2 = ph * 0.72 + Math.sin(i * 0.17 + 2) * 2;
      if (j > hill1) c = '#8a9a72';
      if (j > hill2) c = '#6a7856';
      if (j > hill1 && j < hill1 + 1) c = '#a2b187';
      L.set(px + i, py + j, c);
    }
  // sun
  for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 9) L.set(px + 22 + i, py + 10 + j, '#f6dc9c');
  // redraw hills in front of sun
  for (let i = 0; i < pw; i++) {
    const hill1 = Math.ceil(ph * 0.55 + Math.sin(i * 0.25) * 3);
    for (let j = hill1; j < ph; j++) {
      const hill2 = ph * 0.72 + Math.sin(i * 0.17 + 2) * 2;
      L.set(px + i, py + j, j > hill2 ? '#6a7856' : j === hill1 ? '#a2b187' : '#8a9a72');
    }
  }
  // mantel shelf
  L.rect(94, 54, 68, 6, P.mantel);
  L.hline(94, 54, 68, P.mantelL);
  L.hline(94, 59, 68, P.mantelD);
  L.rect(96, 60, 64, 2, P.mantelD);
  // stone surround
  L.rect(104, 62, 48, FLOOR_Y - 62, P.stone);
  L.vline(104, 62, FLOOR_Y - 62, P.stoneL);
  L.vline(151, 62, FLOOR_Y - 62, P.stoneD);
  for (let y = 66; y < FLOOR_Y; y += 7)
    for (let x = 106 + ((y / 7) % 2) * 4; x < 150; x += 9) {
      L.hline(x, y, 6, P.stoneD);
      L.set(x, y - 1, P.stoneL);
    }
  // opening (arched)
  const { openX: ox, openW: ow, openY: oy, openB: ob } = FIRE;
  for (let j = oy; j < ob; j++) {
    const t = j - oy;
    const inset = t < 5 ? [9, 5, 3, 2, 1][t] : 0;
    L.rect(ox + inset, j, ow - inset * 2, 1, P.soot);
    // keystone edge
    L.set(ox + inset - 1, j, P.stoneDD);
    L.set(ox + ow - inset, j, P.stoneDD);
  }
  L.rect(ox + 12, oy - 3, 5, 3, P.stoneL);
  L.hline(ox + 12, oy - 3, 5, '#cbc1b4');
  // back bricks inside, very dark
  for (let y = oy + 8; y < ob - 4; y += 4)
    for (let x = ox + 3 + ((y / 4) % 2) * 3; x < ox + ow - 4; x += 6) L.hline(x, y, 4, P.sootL);
  // hearth slab
  L.rect(96, 116, 64, 6, P.stone);
  L.hline(96, 116, 64, P.stoneL);
  L.hline(96, 121, 64, P.stoneDD);
  L.vline(96, 116, 6, P.stoneL);
  L.vline(159, 116, 6, P.stoneDD);
  // grate
  L.rect(ox + 5, ob - 3, ow - 10, 1, '#2a2020');
  for (let x = ox + 6; x < ox + ow - 6; x += 3) L.vline(x, ob - 6, 3, '#3a2c2a');

  // mantel decor: candles (flames animate later), photo, plant, books
  L.rect(98, 46, 3, 8, '#efe3cb');
  L.vline(100, 46, 8, '#cdbf9f');
  L.rect(103, 49, 3, 5, '#efe3cb');
  L.vline(105, 49, 5, '#cdbf9f');
  // photo frame (the two of you)
  L.rect(137, 42, 14, 12, P.woodD);
  L.rect(138, 43, 12, 10, '#e6d6b8');
  L.rect(139, 44, 10, 8, '#c6a489');
  // books
  L.rect(122, 44, 3, 10, '#7a5068');
  L.rect(125, 46, 3, 8, '#4f6583');
  L.rect(128, 45, 3, 9, P.mustard);
  L.hline(122, 44, 3, '#936580');
  // trailing plant
  L.rect(153, 48, 6, 6, P.pot);
  L.vline(158, 48, 6, P.potD);
  const leaves = [
    [152, 46], [154, 45], [156, 46], [158, 45], [159, 47], [160, 50], [161, 53], [161, 56], [160, 59], [162, 61],
    [151, 47], [155, 44],
  ];
  for (const [lx, ly] of leaves) {
    L.set(lx, ly, P.leaf);
    L.set(lx + 1, ly, P.leafL);
  }
  // firewood basket beside hearth
  L.rect(80, 104, 15, 13, '#8a6a45');
  for (let y = 105; y < 116; y += 2) L.hline(80, y, 15, '#6f5234');
  L.hline(80, 104, 15, '#a3825a');
  for (const [lx, ly] of [[81, 100], [85, 99], [89, 101], [83, 102]]) {
    L.rect(lx, ly, 6, 3, '#7a4f33');
    L.set(lx, ly + 1, '#c9a27a');
    L.set(lx + 5, ly + 1, '#c9a27a');
  }
}

function drawGallery(L: Layer) {
  const frame = (x: number, y: number, w: number, h: number, paint: (i: number, j: number) => string) => {
    L.rect(x - 1, y - 1, w + 2, h + 2, P.woodD);
    L.rect(x, y, w, h, P.frame);
    for (let j = 2; j < h - 2; j++) for (let i = 2; i < w - 2; i++) L.set(x + i, y + j, paint(i - 2, j - 2));
  };
  // botanical print
  frame(192, 30, 18, 24, (i, j) => {
    const stem = i === 6 && j > 3;
    const leaf = (Math.abs(i - 6) === 2 && j % 5 === 2) || (Math.abs(i - 6) === 3 && j % 5 === 3);
    return stem || leaf ? P.sageD : '#efe3cb';
  });
  // "us" — little heart stitched in thread red
  frame(216, 26, 30, 22, (i, j) => {
    const heart = [
      '..##...##..',
      '.####.####.',
      '###########',
      '###########',
      '.#########.',
      '..#######..',
      '...#####...',
      '....###....',
      '.....#.....',
    ];
    const hi = i - 7;
    const hj = j - 4;
    if (hj >= 0 && hj < heart.length && hi >= 0 && hi < 11 && heart[hj][hi] === '#') return '#a84f4b';
    return (i + j) % 2 ? '#e8d9bc' : '#eadcc0';
  });
  // abstract sun
  frame(252, 32, 20, 16, (i, j) => {
    const d = (i - 8) ** 2 + (j - 12) ** 2;
    if (d < 30) return P.mustard;
    return j > 9 ? P.couch : '#e9d7b7';
  });
}

function drawLamp(L: Layer) {
  // floor lamp at the couch's right
  const x = 290;
  L.rect(x - 5, 147, 11, 3, P.brass);
  L.hline(x - 5, 147, 11, P.brassL);
  L.vline(x, 70, 77, P.brass);
  L.vline(x + 1, 70, 77, '#8a6a36');
  // shade (glowing)
  for (let j = 0; j < 16; j++) {
    const half = 6 + Math.floor(j / 2.2);
    for (let i = -half; i <= half; i++) {
      const edge = i === -half || i === half || j === 15;
      L.glow(x + i, 54 + j, edge ? '#e8c787' : j < 3 ? '#fbeec8' : '#f6e0a8');
    }
  }
  L.rect(x - 6, 53, 13, 1, '#d6b577');
  L.unglow(x - 6, 53, 13, 1);
}

function drawBookshelf(L: Layer) {
  const x = 308;
  L.rect(x, 60, 14, 90, P.woodD);
  L.rect(x + 1, 61, 13, 88, P.wood);
  const bookColors = ['#7a5068', '#4f6583', P.mustard, P.sage, P.couch, '#efe3cb', '#4d6b52'];
  for (let s = 0; s < 4; s++) {
    const sy = 62 + s * 22;
    L.rect(x + 1, sy + 19, 13, 2, P.woodL);
    let bx = x + 2;
    let k = s * 3;
    while (bx < x + 13) {
      const bw = 2 + ((hash(k) * 2) | 0);
      const bh = 12 + ((hash(k + 9) * 6) | 0);
      const c = bookColors[k % bookColors.length];
      L.rect(bx, sy + 19 - bh, bw, bh, c);
      L.hline(bx, sy + 19 - bh + 2, bw, mix(c, '#fff', 0.25));
      bx += bw;
      k++;
    }
  }
}

function drawRug(L: Layer) {
  const x0 = 92, x1 = 306, y0 = 140, y1 = 176;
  for (let y = y0; y <= y1; y++) {
    const inset = Math.round((y1 - y) * 0.22); // slight perspective: narrower at the back
    for (let x = x0 + inset; x <= x1 - inset; x++) {
      const bx = x - (x0 + inset);
      const bxR = x1 - inset - x;
      const by = y - y0;
      const byB = y1 - y;
      let c = P.rugA;
      const border = bx < 3 || bxR < 3 || by < 2 || byB < 2;
      const inner = bx === 4 || bxR === 4 || by === 3 || byB === 3;
      if (border) c = P.rugC;
      else if (inner) c = P.rugB;
      else {
        // diamonds
        const u = (x - 199) % 16;
        const v = (y - 158) % 10;
        const du = Math.abs(((u + 16) % 16) - 8);
        const dv = Math.abs(((v + 10) % 10) - 5);
        if (du * 0.62 + dv < 3.2) c = (du + dv) % 3 < 1 ? P.rugB : P.rugD;
      }
      L.set(x, y, c);
    }
  }
  // fringe
  for (let x = x0 + 1; x <= x1; x += 2) {
    L.set(x, y1 + 1, P.rugD);
    L.set(x, y1 + 2, P.cream);
  }
}

function drawCouch(L: Layer) {
  const { x, y, w, seatY, baseY } = COUCH;
  const armW = 12;
  const armTop = seatY - 7;
  // shadow on rug
  for (let i = -1; i < w + 2; i++) L.set(x + i, baseY + 1, mix(P.rugA, '#3a2418', 0.4));
  for (let i = 2; i < w - 1; i++) L.set(x + i, baseY + 2, mix(P.rugA, '#3a2418', 0.2));
  // back rest
  for (let j = 0; j <= seatY - y; j++) {
    const inset = j === 0 ? 3 : j === 1 ? 1 : 0;
    for (let i = 4 + inset; i < w - 4 - inset; i++) {
      let c = P.couch;
      if (j < 2) c = P.couchL;
      else if (j > seatY - y - 3) c = P.couchD;
      L.set(x + i, y + j, c);
    }
  }
  // two back cushions
  const mid = Math.floor(w / 2);
  L.vline(x + mid, y + 2, seatY - y - 2, P.couchD);
  L.vline(x + mid + 1, y + 2, seatY - y - 2, P.couchL);
  // seat cushions (front face)
  for (let j = 0; j < 6; j++)
    for (let i = armW - 1; i < w - armW + 1; i++) {
      let c = j < 2 ? P.couchL : j < 4 ? P.couch : P.couchD;
      if (i === mid || i === mid + 1) c = j < 4 ? P.couchD : P.couchDD;
      L.set(x + i, seatY + j, c);
    }
  // base
  L.rect(x + 2, seatY + 6, w - 4, baseY - seatY - 8, P.couchDD);
  L.hline(x + 2, seatY + 6, w - 4, P.couchD);
  // legs
  for (const lx of [x + 4, x + w - 7]) {
    L.rect(lx, baseY - 2, 3, 3, P.woodD);
    L.set(lx, baseY - 2, P.woodL);
  }
  // rolled arms
  const arm = (ax: number, flip: boolean) => {
    for (let j = 0; j < baseY - 2 - armTop; j++) {
      const inset = j === 0 ? 2 : j === 1 ? 1 : 0;
      for (let i = inset; i < armW - inset; i++) {
        const ii = flip ? armW - 1 - i : i;
        let c = P.couch;
        if (j < 2) c = P.couchL;
        else if (ii > armW - 3) c = P.couchD;
        else if (ii < 2) c = P.couchL;
        if (j > baseY - armTop - 7) c = P.couchDD;
        L.set(ax + i, armTop + j, c);
      }
    }
    L.hline(ax + 3, armTop + 3, armW - 6, P.couchD);
  };
  arm(x, false);
  arm(x + w - armW, true);
  // throw pillows tucked against the arms
  const pillow = (px: number, c: string, cd: string, pattern: boolean) => {
    for (let j = 0; j < 10; j++)
      for (let i = 0; i < 11; i++) {
        if ((j === 0 || j === 9) && (i === 0 || i === 10)) continue;
        let cc = j > 6 || i > 8 ? cd : c;
        if (pattern && (i + j * 2) % 5 === 0 && j > 1 && j < 8) cc = P.couch;
        L.set(px + i, seatY - 9 + j, cc);
      }
  };
  pillow(x + armW - 2, P.mustard, P.mustardD, false);
  pillow(x + w - armW - 9, P.cream, P.creamD, true);
  // knitted blanket draped over the right arm
  const bx = x + w - armW - 1;
  for (let j = 0; j < 14; j++) {
    const from = j < 3 ? 2 : 0;
    const to = j < 3 ? armW + 1 : armW - 3 + Math.min(j, 3);
    for (let i = from; i < to; i++) {
      const c = ((j >> 1) + (i >> 2)) % 2 ? P.sage : P.sageD;
      L.set(bx + i, armTop - 1 + j, j === 0 ? '#a2b187' : c);
    }
  }
  for (let i = 0; i < armW; i += 2) L.set(bx + i, armTop + 13, P.cream);
}

function drawTable(L: Layer) {
  const { x, y, w } = TABLE;
  L.rect(x, y, w, 3, P.woodL);
  L.hline(x, y, w, '#9a6d50');
  L.rect(x + 1, y + 3, w - 2, 2, P.woodD);
  for (const lx of [x + 3, x + w - 6]) L.rect(lx, y + 5, 3, 10, P.wood);
  L.rect(x + 6, y + 11, w - 12, 2, P.woodD);
  // rug shadow
  L.hline(x + 2, y + 15, w - 4, mix(P.rugA, '#3a2418', 0.3));
  // mugs
  L.rect(x + 6, y - 5, 5, 5, P.cream);
  L.vline(x + 10, y - 5, 5, P.creamD);
  L.rect(x + 4, y - 4, 2, 2, P.creamD);
  L.hline(x + 6, y - 5, 5, '#6b4633');
  // TV remote: click it to watch something together
  L.rect(x + 38, y - 2, 7, 2, '#2c2527');
  L.set(x + 39, y - 2, '#c4453f');
  L.set(x + 41, y - 2, '#8a9a72');
  L.set(x + 43, y - 2, '#e6d6b8');
  L.rect(x + w - 14, y - 5, 5, 5, P.sage);
  L.vline(x + w - 10, y - 5, 5, P.sageD);
  L.rect(x + w - 16, y - 4, 2, 2, P.sageD);
  L.hline(x + w - 14, y - 5, 5, '#6b4633');
}

function drawPlant(L: Layer) {
  // big leafy plant, front-left, partly out of frame
  L.rect(4, 150, 20, 18, P.pot);
  L.rect(3, 149, 22, 3, '#cf7f64');
  L.vline(22, 152, 16, P.potD);
  L.vline(23, 152, 16, P.potD);
  const leaf = (cx: number, cy: number, len: number, ang: number) => {
    for (let t = 0; t < len; t++) {
      const px = cx + Math.cos(ang) * t;
      const py = cy + Math.sin(ang) * t;
      const wdt = Math.sin((t / len) * Math.PI) * 3.2;
      for (let k = -wdt; k <= wdt; k += 0.5) {
        const nx = px + Math.cos(ang + Math.PI / 2) * k;
        const ny = py + Math.sin(ang + Math.PI / 2) * k;
        L.set(nx, ny, k > 1.5 ? P.leafL : k < -1.5 ? P.leafD : P.leaf);
      }
      L.set(px, py, P.leafD);
    }
  };
  const leaves: Array<[number, number, number, number]> = [
    [14, 150, 26, -1.9], [14, 150, 28, -1.35], [14, 150, 24, -0.9], [14, 150, 22, -2.4], [14, 150, 20, -0.5],
    [13, 150, 30, -1.6], [15, 150, 18, -0.2], [13, 150, 16, -2.9],
  ];
  for (const l of leaves) leaf(...l);
}

let STATIC: Layer | null = null;
function staticLayer(): Layer {
  if (STATIC) return STATIC;
  const L = new Layer(ROOM_W, ROOM_H);
  drawWall(L);
  drawFloor(L);
  drawWindow(L);
  drawFireplace(L);
  drawGallery(L);
  drawBookshelf(L);
  drawLamp(L);
  drawRug(L);
  drawCouch(L);
  STATIC = L;
  return L;
}

/* ------------------------------------------------------------------------ */
/*  Animated bits                                                             */
/* ------------------------------------------------------------------------ */

const FIRE_COLS = ['#fff4c2', '#ffd36b', '#f7a23e', '#e66a2c', '#b8402a'];

function drawFire(L: Layer, t: number, intensity: number) {
  const { openX: ox, openW: ow, openB: ob } = FIRE;
  const base = ob - 6;
  // logs
  L.rect(ox + 6, base, ow - 12, 3, '#4a2e20');
  L.hline(ox + 6, base, ow - 12, '#6a4430');
  L.rect(ox + 9, base - 2, 11, 3, '#3a2418');
  L.set(ox + 6, base + 1, '#c9a27a');
  L.set(ox + ow - 7, base + 1, '#c9a27a');
  // embers
  for (let i = ox + 7; i < ox + ow - 7; i++) {
    if (hash(i * 3 + Math.floor(t * 6)) > 0.55) L.glow(i, base + 2, hash(i + t) > 0.5 ? '#ff8a3d' : '#e0582a');
  }
  // flames: a column height field that wobbles
  const cx = ox + ow / 2;
  const maxH = 18 + intensity * 8;
  for (let i = ox + 6; i < ox + ow - 6; i++) {
    const d = Math.abs(i - cx) / (ow / 2 - 6);
    const wob =
      Math.sin(t * 9 + i * 0.9) * 2.2 + Math.sin(t * 13.7 + i * 1.7) * 1.4 + (hash(i * 13 + Math.floor(t * 10)) - 0.5) * 3;
    const hgt = Math.max(0, maxH * (1 - d * d) + wob);
    for (let j = 0; j < hgt; j++) {
      const r = j / hgt; // 0 bottom -> 1 tip
      const k = r < 0.25 ? 0 : r < 0.45 ? 1 : r < 0.7 ? 2 : r < 0.9 ? 3 : 4;
      const inner = d < 0.35 ? Math.max(0, k - 1) : k;
      L.glow(i, base - 1 - j, FIRE_COLS[Math.min(4, inner)]);
    }
  }
  // sparks
  for (let s = 0; s < 5; s++) {
    const life = (t * 0.9 + s * 0.21) % 1;
    const sx = cx + Math.sin(s * 12.3 + t * 2) * 8;
    const sy = base - 10 - life * 26;
    if (life < 0.85 && sy > FIRE.openY + 2) L.glow(sx, sy, life < 0.5 ? '#ffd36b' : '#f7a23e');
  }
}

function drawCandles(L: Layer, t: number) {
  for (const [cx, cy] of [
    [99, 45],
    [104, 48],
  ]) {
    const f = Math.sin(t * 11 + cx) > 0.3 ? 1 : 0;
    L.glow(cx, cy - 1 - f, '#fff4c2');
    L.glow(cx, cy, '#ffd36b');
    L.glow(cx + (f ? 0 : 1), cy - 2 - f, '#f7a23e');
  }
}

function drawSnow(L: Layer, t: number) {
  const x = 22, y = 22, w = 46, h = 58;
  for (let k = 0; k < 26; k++) {
    const speed = 5 + hash(k) * 6;
    const sy = ((hash(k * 3.7) * h + t * speed) % h) | 0;
    const sx = (x + ((hash(k * 1.3) * w + Math.sin(t * 1.3 + k) * 2 + w) % w)) | 0;
    // skip mullions
    if (sx === x + w / 2 || sx === x + w / 2 - 1 || (sy >= 26 && sy <= 28)) continue;
    L.glow(sx, y + sy, hash(k * 9) > 0.5 ? '#e8eef6' : '#b7c3db');
  }
}

function drawSteam(L: Layer, t: number) {
  for (const mx of [TABLE.x + 8, TABLE.x + TABLE.w - 12]) {
    for (let k = 0; k < 3; k++) {
      const life = (t * 0.6 + k / 3 + mx * 0.01) % 1;
      const sy = TABLE.y - 7 - life * 12;
      const sx = mx + Math.sin(life * 6 + mx) * 1.5;
      if (life < 0.8) L.set(sx, sy, '#e9e0d0', Math.round(200 * (1 - life)));
    }
  }
}

function drawLetter(L: Layer, t: number, unread: boolean, hover: boolean) {
  const x = TABLE.x + 21;
  const y = TABLE.y - 6;
  const lift = unread ? (Math.sin(t * 3) > 0.6 ? 1 : 0) : 0;
  const paper = unread ? L.glow.bind(L) : L.set.bind(L);
  for (let j = 0; j < 6; j++) for (let i = 0; i < 14; i++) paper(x + i, y - lift + j, j === 5 ? '#d8c9ad' : '#f4ead6');
  // flap
  for (let i = 0; i < 7; i++) {
    paper(x + i, y - lift + Math.floor(i / 2), '#d6c5a6');
    paper(x + 13 - i, y - lift + Math.floor(i / 2), '#d6c5a6');
  }
  // wax seal in thread red
  L.rect(x + 6, y - lift + 3, 2, 2, '#a84f4b');
  L.unglow(x + 6, y - lift + 3, 2, 2);
  if (unread) {
    const s = Math.floor(t * 2) % 2;
    L.glow(x + 15, y - 3 - s, '#ffe7a3');
    L.glow(x + 16, y - 4 - s, '#fff4c2');
    L.glow(x + 14, y - 4 - s, '#ffe7a3');
    L.glow(x + 15, y - 5 - s, '#ffe7a3');
  }
  if (hover) {
    for (let i = -1; i <= 14; i++) {
      L.glow(x + i, y - lift - 1, '#fff4c2');
      L.glow(x + i, y - lift + 6, '#fff4c2');
    }
    L.glow(x - 1, y - lift + 2, '#fff4c2');
    L.glow(x + 14, y - lift + 2, '#fff4c2');
  }
}

function drawCat(L: Layer, t: number) {
  // sleeping ginger cat on a cushion by the hearth
  const x = 118;
  const y = 131;
  // cushion
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 26; i++) {
      const corner = (j === 0 || j === 5) && (i < 2 || i > 23);
      if (corner) continue;
      L.set(x - 3 + i, y + 4 + j, j < 2 ? '#a2b187' : j > 3 ? P.sageD : P.sage);
    }
  const breath = Math.sin(t * 2.2) > 0 ? 1 : 0;
  const body = [
    '.....oooooooo.......',
    '...ooOOOOOOOOoo.....',
    '..oOOOoooOOOOOOo..o.',
    '.oOOOooOOOoOOOOOooOo',
    'oOOOOOOOOOOOOOOOOOo.',
    'oOOOOOOOOOOOOOOOOOo.',
    '.ooooooooooooooooo..',
  ];
  const pal: Record<string, string> = { o: '#b86e33', O: '#d98c4a' };
  for (let j = 0; j < body.length; j++)
    for (let i = 0; i < body[j].length; i++) {
      const k = body[j][i];
      if (k === '.') continue;
      L.set(x + i, y - 2 + j + (j < 2 ? -breath : 0), pal[k]);
    }
  // head tucked in on the left
  L.rect(x - 1, y + 1, 6, 4, '#d98c4a');
  L.set(x - 1, y, '#b86e33');
  L.set(x + 3, y, '#b86e33');
  L.set(x, y + 3, '#5a3a2c');
  L.set(x + 2, y + 3, '#5a3a2c');
  L.set(x + 1, y + 4, '#e9a0a0');
  // tail tip swish
  const sw = Math.sin(t * 1.3) > 0.7 ? 1 : 0;
  L.set(x + 20, y + 4 - sw, '#b86e33');
  // zzz
  const zl = (t * 0.5) % 1;
  if (zl < 0.7) {
    const zx = x - 2 - zl * 3;
    const zy = y - 4 - zl * 10;
    L.set(zx, zy, '#e9e0d0', Math.round(220 * (1 - zl)));
    L.set(zx + 1, zy, '#e9e0d0', Math.round(220 * (1 - zl)));
    L.set(zx + 1, zy + 1, '#e9e0d0', Math.round(220 * (1 - zl)));
    L.set(zx, zy + 2, '#e9e0d0', Math.round(220 * (1 - zl)));
    L.set(zx + 1, zy + 2, '#e9e0d0', Math.round(220 * (1 - zl)));
  }
}

function drawPhotoPortrait(L: Layer, state: RoomState) {
  // tiny portrait of the couple in the mantel frame
  const put = (seat: Seat, x: number) => {
    if (!seat.avatar) {
      L.rect(x, 47, 3, 3, '#b39278');
      return;
    }
    const { buf, headTop } = renderCharacter(seat.avatar, 'stand');
    // sample head colours: hair + skin
    const hairPx = pickColor(buf, 12, headTop - 1) || '#4a3129';
    const skinPx = pickColor(buf, 9, headTop + 7) || '#dca77c';
    const topPx = pickColor(buf, 12, headTop + 14) || '#8a9a72';
    L.rect(x, 45, 4, 2, hairPx);
    L.rect(x, 47, 4, 2, skinPx);
    L.rect(x - 1, 49, 6, 3, topPx);
  };
  put(state.left, 140);
  put(state.right, 145);
}

function pickColor(b: PixelBuffer, x: number, y: number) {
  const i = (y * b.w + x) * 4;
  if (b.data[i + 3] === 0) return null;
  return '#' + [b.data[i], b.data[i + 1], b.data[i + 2]].map((n) => n.toString(16).padStart(2, '0')).join('');
}

function seatCharacter(L: Layer, seat: Seat, cx: number, t: number, phase: number, hover: boolean) {
  if (!seat.avatar || seat.status === 'empty') return;
  const blink = (t + phase) % 4.2 < 0.12;
  const bob = Math.sin((t + phase) * 1.6) > 0.55 ? 1 : 0;
  const asleep = seat.status === 'offline' || seat.status === 'away';
  const { buf, anchor } = renderCharacter(seat.avatar, 'sit', { blink, bob, sleepy: asleep });
  const x = cx - anchor.x;
  const y = COUCH.seatY - anchor.y;
  L.blit(buf, x, y);
  if (hover) {
    // soft rim highlight
    for (let j = 0; j < buf.h; j++)
      for (let i = 0; i < buf.w; i++) {
        if (buf.alphaAt(i, j) === 0) continue;
        const edge = buf.alphaAt(i - 1, j) === 0 || buf.alphaAt(i + 1, j) === 0 || buf.alphaAt(i, j - 1) === 0;
        if (edge) L.glow(x + i, y + j, '#fff1c9', 150);
      }
  }
  if (asleep) {
    const zl = (t * 0.45 + phase) % 1;
    const zx = cx + 7 + zl * 4;
    const zy = y + 6 - zl * 12;
    const a = Math.round(230 * (1 - zl));
    for (const [dx, dy] of [
      [0, 0], [1, 0], [2, 0], [1, 1], [0, 2], [1, 2], [2, 2],
    ])
      L.set(zx + dx, zy + dy, '#f1e6cf', a);
  }
}

function drawEmptySeat(L: Layer, cx: number, t: number, hover: boolean) {
  // a dotted silhouette + blinking "+" that says: this spot is waiting
  const y = COUCH.seatY - 28;
  const pulse = Math.sin(t * 2.5) > 0 ? 1 : 0;
  const col = hover ? '#fff1c9' : '#f1e3c4';
  for (let j = 0; j < 27; j++)
    for (let i = -8; i <= 8; i++) {
      const inHead = j < 11 && (i + 0.5) ** 2 / 36 + (j - 5.5) ** 2 / 30 <= 1;
      const inBody = j >= 12 && Math.abs(i) <= 7 - (j < 14 ? 1 : 0);
      if (!inHead && !inBody) continue;
      const edgeHead =
        inHead && ((i + 1.5) ** 2 / 36 + (j - 5.5) ** 2 / 30 > 1 || (i - 0.5) ** 2 / 36 + (j - 5.5) ** 2 / 30 > 1 || (i + 0.5) ** 2 / 36 + (j - 6.5) ** 2 / 30 > 1 || (i + 0.5) ** 2 / 36 + (j - 4.5) ** 2 / 30 > 1);
      const edgeBody = inBody && (Math.abs(i) === 7 - (j < 14 ? 1 : 0) || j === 12);
      if ((edgeHead || edgeBody) && (i + j + Math.floor(t * 4)) % 2 === 0) L.glow(cx + i, y + j, col, hover ? 255 : 170);
    }
  // plus badge
  const bx = cx;
  const by = y + 17 - pulse;
  L.rect(bx - 3, by - 3, 7, 7, '#a84f4b');
  L.unglow(bx - 3, by - 3, 7, 7);
  L.glow(bx, by - 2, '#fff1c9');
  L.glow(bx, by - 1, '#fff1c9');
  L.glow(bx, by, '#fff1c9');
  L.glow(bx, by + 1, '#fff1c9');
  L.glow(bx, by + 2, '#fff1c9');
  L.glow(bx - 2, by, '#fff1c9');
  L.glow(bx - 1, by, '#fff1c9');
  L.glow(bx + 1, by, '#fff1c9');
  L.glow(bx + 2, by, '#fff1c9');
}

function drawThread(L: Layer, state: RoomState, t: number) {
  if (!state.left.avatar || !state.right.avatar || state.right.status === 'empty' || state.left.status === 'empty') return;
  // the red thread — from one lap to the other, gently sagging
  const x0 = SEAT_LEFT_X + 5;
  const x1 = SEAT_RIGHT_X - 5;
  const y0 = COUCH.seatY - 1;
  const sag = 3 + Math.sin(t * 1.2) * 0.6;
  let prev = -1;
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    const y = Math.round(y0 + Math.sin(u * Math.PI) * sag);
    L.set(x, y, '#c4453f');
    if (prev >= 0 && Math.abs(y - prev) > 1) L.set(x, (y + prev) >> 1, '#c4453f');
    prev = y;
  }
}

function drawForeground(L: Layer) {
  drawPlant(L);
}

/* ------------------------------------------------------------------------ */
/*  Lighting                                                                  */
/* ------------------------------------------------------------------------ */

interface Light {
  x: number;
  y: number;
  r: number;
  c: [number, number, number];
  k: number;
}

const AMBIENT: [number, number, number] = [0.38, 0.36, 0.5];
let DIST: Float32Array[] | null = null;
const LIGHTS: Light[] = [
  { x: FIRE.cx, y: 100, r: 190, c: [1.08, 0.72, 0.44], k: 1 },
  { x: 290, y: 66, r: 115, c: [0.95, 0.78, 0.52], k: 0.85 },
  { x: 45, y: 50, r: 70, c: [0.42, 0.5, 0.72], k: 0.55 },
  { x: 101, y: 44, r: 30, c: [0.9, 0.6, 0.35], k: 0.5 },
];

function lightDistances() {
  if (DIST) return DIST;
  DIST = LIGHTS.map((l) => {
    const a = new Float32Array(ROOM_W * ROOM_H);
    for (let y = 0; y < ROOM_H; y++)
      for (let x = 0; x < ROOM_W; x++) {
        const dx = x - l.x;
        const dy = (y - l.y) * 1.25; // light pools a bit wider than tall
        a[y * ROOM_W + x] = Math.sqrt(dx * dx + dy * dy);
      }
    return a;
  });
  return DIST;
}

function applyLighting(L: Layer, t: number, fire: number) {
  const dist = lightDistances();
  const flick = 1 + Math.sin(t * 7.3) * 0.025 + Math.sin(t * 17.1) * 0.02 + (hash(Math.floor(t * 12)) - 0.5) * 0.03;
  const radii = LIGHTS.map((l, i) => l.r * (i === 0 ? flick * (0.85 + fire * 0.25) : i === 3 ? flick : 1));
  const levels = 5;
  const d = L.data;
  for (let y = 0; y < ROOM_H; y++) {
    for (let x = 0; x < ROOM_W; x++) {
      const p = y * ROOM_W + x;
      if (L.emit[p]) continue;
      // accumulate continuous light, then quantise the total once so there is
      // a single set of soft bands (with a thin dithered seam between them)
      let tot = 0;
      let tr = 0;
      let tg = 0;
      let tb = 0;
      for (let i = 0; i < LIGHTS.length; i++) {
        const l = LIGHTS[i];
        let v = 1 - dist[i][p] / radii[i];
        if (v <= 0) continue;
        v = Math.pow(v, 1.35) * l.k;
        tot += v;
        tr += l.c[0] * v;
        tg += l.c[1] * v;
        tb += l.c[2] * v;
      }
      let r = AMBIENT[0];
      let g = AMBIENT[1];
      let b = AMBIENT[2];
      if (tot > 0) {
        const th = (BAYER4[y & 3][x & 3] - 0.5) * 0.24;
        const qv = Math.floor(tot * levels + 0.5 + th) / levels;
        r += (tr / tot) * qv;
        g += (tg / tot) * qv;
        b += (tb / tot) * qv;
      }
      const q = p * 4;
      d[q] = Math.min(255, d[q] * r);
      d[q + 1] = Math.min(255, d[q + 1] * g);
      d[q + 2] = Math.min(255, d[q + 2] * b);
    }
  }
  // bloom halo around fire mouth + lamp shade (additive, dithered)
  const halo = (hx: number, hy: number, rad: number, col: [number, number, number], str: number) => {
    for (let y = Math.max(0, hy - rad); y < Math.min(ROOM_H, hy + rad); y++)
      for (let x = Math.max(0, hx - rad); x < Math.min(ROOM_W, hx + rad); x++) {
        const dd = Math.hypot(x - hx, (y - hy) * 1.3) / rad;
        if (dd >= 1) continue;
        const v = (1 - dd) * (1 - dd) * str;
        if (v < BAYER4[y & 3][x & 3] * 0.5) continue;
        const q = (y * ROOM_W + x) * 4;
        d[q] = Math.min(255, d[q] + col[0] * v);
        d[q + 1] = Math.min(255, d[q + 1] + col[1] * v);
        d[q + 2] = Math.min(255, d[q + 2] + col[2] * v);
      }
  };
  halo(FIRE.cx, 104, 26, [255, 150, 60], 0.35 * flick * (0.7 + fire * 0.4));
  halo(290, 66, 16, [255, 214, 140], 0.28);
}

/* ------------------------------------------------------------------------ */

const FRAME = new Layer(ROOM_W, ROOM_H);

/** Draw one frame of the room for time `t` (seconds). */
export function renderRoom(state: RoomState, t: number): PixelBuffer {
  const L = FRAME;
  L.copyFrom(staticLayer());
  drawFire(L, t, state.fire);
  drawCandles(L, t);
  drawSnow(L, t);
  drawPhotoPortrait(L, state);
  drawCat(L, t);

  // characters on the couch (left seat first so the right one overlaps on lean)
  const leftEmpty = !state.left.avatar || state.left.status === 'empty';
  const rightEmpty = !state.right.avatar || state.right.status === 'empty';
  if (leftEmpty) drawEmptySeat(L, SEAT_LEFT_X, t, state.hover === 'left');
  else seatCharacter(L, state.left, SEAT_LEFT_X, t, 0, state.hover === 'left');
  if (rightEmpty) drawEmptySeat(L, SEAT_RIGHT_X, t, state.hover === 'right');
  else seatCharacter(L, state.right, SEAT_RIGHT_X, t, 1.7, state.hover === 'right');
  drawThread(L, state, t);

  drawTable(L);
  drawSteam(L, t);
  drawLetter(L, t, state.letterUnread, state.hover === 'letter');
  drawForeground(L);

  applyLighting(L, t, state.fire);
  return L;
}

/** Focal point to keep in view when the screen is narrower than 16:9. */
export const ROOM_FOCUS_X = 232;

export function hitTest(x: number, y: number): HotspotId | null {
  for (const h of HOTSPOTS) if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h.id;
  return null;
}

export function hotspotRect(id: HotspotId) {
  return HOTSPOTS.find((h) => h.id === id)!;
}

void hex;
