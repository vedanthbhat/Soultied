import { PixelBuffer, BAYER4, hash, mix, hex } from './buffer';
import { renderCharacter } from './character';
import type { AvatarConfig } from '../types';
import { START_DECOR, type Decor, type SlotId } from '../decor/catalogue';

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
  /** how close the two sit on the couch: 0 = the two ends, 1 = side by side (fractional mid-scoot) */
  closeness?: number;
  /** true while they're shuffling along the couch */
  scooting?: boolean;
  /** scene time a little heart started floating up between them (-1 for none) */
  heartAt?: number;
  /** a game is waiting on you: the stack of board games twinkles */
  gamesWaiting?: boolean;
  /** a record is going round on the turntable */
  music?: boolean;
  /** what's out in the room: wallpaper, couch, rug, pet, view, painting, plant (see decor/catalogue.ts) */
  decor?: Decor;
  /** just the room, nobody on the couch (the catalogue's thumbnails) */
  bare?: boolean;
}

export type HotspotId = 'left' | 'right' | 'letter' | 'fire' | 'photo' | 'remote' | 'door' | 'games' | 'music' | 'decor';

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
const COUCH_MID = COUCH.x + COUCH.w / 2;
/** half the gap between the two seats: at the two ends of the couch, and side by side */
const SEAT_FAR = 26;
const SEAT_NEAR = 7;

/** Where the two sit, given how close they've grown (0..1). */
export function seatXs(closeness = 0) {
  const c = Math.max(0, Math.min(1, closeness));
  const d = Math.round(SEAT_FAR + (SEAT_NEAR - SEAT_FAR) * c);
  return { left: COUCH_MID - d, right: COUCH_MID + d };
}
const FIRE = { x: 128, cx: 128, openX: 114, openW: 29, openY: 78, openB: 116 };
const TABLE = { x: 205, y: 163, w: 54 };
const DOOR = { x: 160, y: 64, w: 24 };
/** the stack of board games on the floor beside the couch */
const GAMES_STACK = { x: 168, y: 133, w: 14, h: 17 };
/** the little side table at the couch's right arm, in front of the lamp, with the record player on it */
const SIDE_TABLE = { x: 279, y: 130, w: 20 };
const DECK = { x: 280, y: 125, w: 18 };

const HOTSPOTS: Hotspot[] = [
  { id: 'letter', x: TABLE.x + 19, y: TABLE.y - 9, w: 18, h: 12 },
  { id: 'fire', x: FIRE.openX, y: FIRE.openY, w: FIRE.openW, h: FIRE.openB - FIRE.openY },
  { id: 'photo', x: 138, y: 43, w: 12, h: 12 },
  { id: 'remote', x: TABLE.x + 36, y: TABLE.y - 4, w: 10, h: 6 },
  { id: 'music', x: SIDE_TABLE.x - 1, y: DECK.y - 10, w: SIDE_TABLE.w + 2, h: 151 - (DECK.y - 10) },
  { id: 'door', x: DOOR.x - 1, y: DOOR.y - 2, w: DOOR.w + 2, h: FLOOR_Y - DOOR.y + 2 },
  { id: 'games', x: GAMES_STACK.x - 1, y: GAMES_STACK.y - 2, w: GAMES_STACK.w + 2, h: GAMES_STACK.h + 2 },
  // the painting over the mantel: decorate the room
  { id: 'decor', x: 109, y: 14, w: 38, h: 28 },
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

/** The wallpaper, between the crown moulding and the wainscot. */
function drawWallpaper(L: Layer, wall: string) {
  const top = 4;
  const bottom = 94;
  switch (wall) {
    case 'blush': {
      // dusty rose with a small damask lozenge
      L.rect(0, 0, ROOM_W, FLOOR_Y, '#a27a73');
      for (let y = 8, row = 0; y < bottom - 4; y += 12, row++)
        for (let x = row % 2 ? 6 : 0; x < ROOM_W; x += 12) {
          const c = '#b38b83';
          L.set(x + 2, y, c);
          L.hline(x + 1, y + 1, 3, c);
          L.hline(x, y + 2, 5, c);
          L.hline(x + 1, y + 3, 3, c);
          L.set(x + 2, y + 4, c);
          L.set(x + 2, y + 2, '#93685f');
        }
      return;
    }
    case 'gingham': {
      // cream checks: two bands that cross
      for (let y = 0; y < FLOOR_Y; y++)
        for (let x = 0; x < ROOM_W; x++) {
          const v = x % 8 < 4;
          const h = y % 8 < 4;
          L.set(x, y, v && h ? '#a98e68' : v || h ? '#b9a07a' : '#c8b18b');
        }
      return;
    }
    case 'midnight': {
      // deep blue, faint dots and little gold stars
      L.rect(0, 0, ROOM_W, FLOOR_Y, '#2e3650');
      for (let y = top + 3; y < bottom; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < ROOM_W; x += 6) L.set(x, y, '#38415e');
      for (let y = 10, row = 0; y < bottom - 4; y += 15, row++)
        for (let x = row % 2 ? 10 : 2; x < ROOM_W; x += 16) {
          const sx = x + Math.floor(hash(x * 3 + row * 41) * 4) - 2;
          const sy = y + Math.floor(hash(x * 7 + row * 13) * 4) - 2;
          if (hash(x + row * 97) > 0.55) {
            // a little four-pointed star
            L.set(sx, sy - 1, '#8f7c4e');
            L.hline(sx - 1, sy, 3, '#8f7c4e');
            L.set(sx, sy + 1, '#8f7c4e');
            L.set(sx, sy, '#d9bd72');
          } else L.set(sx, sy, '#a99258');
        }
      return;
    }
    case 'clay': {
      // terracotta with rows of soft arches
      L.rect(0, 0, ROOM_W, FLOOR_Y, '#7e4e40');
      for (let row = 0, y0 = top + 6; y0 < bottom - 10; y0 += 24, row++)
        for (let x0 = row % 2 ? 8 : 0; x0 < ROOM_W; x0 += 16) {
          for (let j = 0; j < 16; j++)
            for (let i = 0; i < 10; i++) {
              const dx = i - 4.5;
              const inArch = j >= 5 || dx * dx + (j - 5) * (j - 5) <= 25;
              if (!inArch) continue;
              const edge = i === 0 || i === 9 || (j < 5 && dx * dx + (j - 5) * (j - 5) > 14);
              L.set(x0 + i, y0 + j, edge ? '#93604f' : '#855343');
            }
        }
      return;
    }
    case 'forest': {
      // dark green scattered with little leaves
      L.rect(0, 0, ROOM_W, FLOOR_Y, '#3c5140');
      for (let gy = 0; gy < 9; gy++)
        for (let gx = 0; gx < 32; gx++) {
          const x = gx * 10 + Math.floor(hash(gx * 7 + gy * 31) * 6);
          const y = top + 4 + gy * 10 + Math.floor(hash(gx * 13 + gy * 3) * 4);
          const flip = hash(gx + gy * 17) > 0.5;
          const d = flip ? 1 : -1;
          L.set(x, y, '#5a7a5a');
          L.set(x + d, y + 1, '#4c664e');
          L.set(x, y + 1, '#5a7a5a');
          L.set(x + d, y + 2, '#4c664e');
          L.set(x + d * 2, y + 2, '#4c664e');
          L.set(x + d, y + 3, '#456048');
        }
      return;
    }
    default: {
      // sage: subtle stripes + tiny sprig motif
      L.rect(0, 0, ROOM_W, FLOOR_Y, P.wall);
      for (let x = 0; x < ROOM_W; x += 8) L.rect(x, 4, 3, 92, P.wallStripe);
      for (let y = 10; y < 92; y += 10) {
        for (let x = (y / 10) % 2 ? 5 : 1; x < ROOM_W; x += 8) {
          L.set(x, y, P.wallDot);
          L.set(x + 1, y + 1, P.wallDot);
          L.set(x - 1, y + 1, P.wallDot);
        }
      }
    }
  }
}

function drawWall(L: Layer, wall: string) {
  drawWallpaper(L, wall);
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

/** The window, and what you see through it (the moving parts are drawWeather). */
const WIN = { x: 22, y: 22, w: 46, h: 58 };
const SKIES: Record<string, [string, string, string]> = {
  snow: [P.skyA, P.skyB, P.skyC],
  rain: ['#1d2330', '#242b3a', '#2c3445'],
  summer: ['#141d3a', '#1c2a4f', '#27406a'],
  blossom: ['#3d3561', '#6b4a74', '#a8647a'],
  city: ['#171d35', '#1f2744', '#2a3354'],
  aurora: ['#0e1726', '#132136', '#1a2c45'],
};
/** the glass is split by a cross of frame */
const onMullion = (wx: number, wy: number) => wx === WIN.w / 2 || wx === WIN.w / 2 - 1 || (wy >= 26 && wy <= 28);

/** the little skyline in the city view: [x, top, width] of each building, and where its windows are */
const CITY = (() => {
  const blocks: Array<[number, number, number]> = [
    [0, 30, 7], [7, 38, 6], [13, 24, 8], [21, 34, 5], [26, 20, 7], [33, 32, 6], [39, 27, 7],
  ];
  const windows: Array<[number, number]> = [];
  for (const [bx, bt, bw] of blocks) for (let y = bt + 3; y < WIN.h - 2; y += 4) for (let x = bx + 1; x < bx + bw - 1; x += 2) windows.push([x, y]);
  return { blocks, windows };
})();

function drawWindow(L: Layer, view: string) {
  const { x, y, w, h } = WIN;
  // curtain rod
  L.rect(10, 14, 70, 2, P.brass);
  L.hline(10, 14, 70, P.brassL);
  L.rect(8, 13, 3, 4, P.brassL);
  L.rect(79, 13, 3, 4, P.brassL);
  // frame
  L.rect(x - 3, y - 3, w + 6, h + 6, P.frameD);
  L.rect(x - 2, y - 2, w + 4, h + 4, P.frame);
  // sky (emissive, banded gradient)
  const [sa, sb, sc] = SKIES[view] || SKIES.snow;
  for (let j = 0; j < h; j++) {
    const c = j < h * 0.35 ? sa : j < h * 0.7 ? sb : sc;
    for (let i = 0; i < w; i++) {
      const t = (j / h) * 3 + BAYER4[j & 3][i & 3] * 0.9;
      const band = t < 1 ? sa : t < 2 ? sb : sc;
      L.glow(x + i, y + j, j % 17 === 0 ? c : band);
    }
  }
  const stars = (n: number, c = '#c9d2ea') => {
    for (let k = 0; k < n; k++) L.glow(x + ((hash(k * 3.1) * w) | 0), y + ((hash(k * 7.7) * (h * 0.5)) | 0), c);
  };
  const moon = (mx: number, my: number, crescent = false) => {
    for (let j = -4; j <= 4; j++)
      for (let i = -4; i <= 4; i++) {
        const d = i * i + j * j;
        if (d > 17) continue;
        if (crescent && (i + 2) * (i + 2) + (j - 1) * (j - 1) <= 13) continue;
        L.glow(x + mx + i, y + my + j, d > 12 ? '#d9d2b8' : P.moon);
      }
  };
  const hills = (cap: string, body: string, k = 0) => {
    for (let i = 0; i < w; i++) {
      const hh = Math.round(6 + Math.sin(i * 0.18 + k) * 3 + Math.sin(i * 0.5 + k) * 1);
      for (let j = 0; j < hh; j++) L.glow(x + i, y + h - 1 - j, j === hh - 1 ? cap : body);
    }
  };
  const cottage = (snowy: boolean) => {
    L.rect(x + 30, y + h - 14, 7, 5, '#2a3150');
    L.glow(x + 32, y + h - 12, '#f6c46a');
    L.glow(x + 34, y + h - 12, '#f6c46a');
    for (let i = 0; i < 9; i++) L.glow(x + 29 + i, y + h - 15 - Math.min(i, 8 - i) / 2, snowy ? '#e8eef6' : '#3a3346');
  };

  if (view === 'rain') {
    // low clouds, wet hills, a lit window far away
    for (const [cx, cy, r] of [[8, 6, 9], [22, 4, 11], [38, 7, 9], [30, 12, 7]] as const)
      for (let j = -r; j <= r; j++)
        for (let i = -r * 1.6; i <= r * 1.6; i++) if ((i / 1.6) ** 2 + j * j <= r * r && cy + j >= 0 && cx + i >= 0 && cx + i < w) L.glow(x + cx + i, y + cy + j, j < -r / 3 ? '#454e60' : '#3a4253');
    hills('#3a4656', '#283240');
    cottage(false);
  } else if (view === 'summer') {
    stars(18);
    moon(34, 11, true);
    hills('#3d5c46', '#22392d');
    cottage(false);
  } else if (view === 'blossom') {
    // a low pink sun, far hills, and a branch of blossom across the top
    for (let j = -5; j <= 5; j++) for (let i = -5; i <= 5; i++) if (i * i + j * j <= 25) L.glow(x + 30 + i, y + h - 14 + j, '#f3c6a5');
    hills('#5c4066', '#45304f', 2);
    for (let t = 0; t < 34; t++) {
      const bx = x + t;
      const by = y + 3 + Math.round(t * 0.35 + Math.sin(t * 0.4));
      L.glow(bx, by, '#4a2e2a');
      if (t % 5 === 2) L.glow(bx, by + 1, '#4a2e2a');
    }
    for (let k = 0; k < 16; k++) {
      const t = (hash(k * 5.3) * 34) | 0;
      const bx = x + t + Math.round((hash(k) - 0.5) * 4);
      const by = y + 2 + Math.round(t * 0.35) + Math.round((hash(k * 2.1) - 0.5) * 5);
      L.glow(bx, by, '#fbe0e6');
      L.glow(bx + 1, by, '#f2b8c6');
      L.glow(bx, by + 1, '#e895ab');
      L.glow(bx - 1, by, '#f2b8c6');
    }
  } else if (view === 'city') {
    stars(8);
    moon(8, 9);
    for (const [bx, bt, bw] of CITY.blocks) for (let j = bt; j < h; j++) for (let i = 0; i < bw; i++) L.glow(x + bx + i, y + j, i === 0 ? '#2d3352' : '#262b45');
    for (const [wx, wy] of CITY.windows) L.glow(x + wx, y + wy, '#353a57');
  } else if (view === 'aurora') {
    stars(20);
    hills('#dfe6f0', '#3b4668', 1);
    for (let i = 0; i < 9; i++) L.glow(x + 6 + i, y + h - 10 - Math.min(i, 8 - i) / 2, '#e8eef6');
  } else {
    // snow: distant hills, snowy rooftops, a moon and stars
    hills('#dfe6f0', '#3b4668');
    cottage(true);
    moon(34, 12);
    L.glow(x + 33, y + 11, '#d9d2b8');
    L.glow(x + 35, y + 14, '#d9d2b8');
    stars(14);
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
  // (the painting above the mantel is drawPainting, since it can change)
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

/** A small, very dark door between the chimney and the pictures. */
function drawDarkDoor(L: Layer) {
  const { x, y, w } = DOOR;
  const h = FLOOR_Y - y;
  // frame with a rounded top
  for (let j = 0; j < h; j++)
    for (let i = -2; i < w + 2; i++) {
      const top = j < 6 && (i + 0.5 - w / 2) ** 2 + ((j - 6) * 2) ** 2 > (w / 2 + 2) ** 2;
      if (top) continue;
      const frame = i < 0 || i >= w || j < 2;
      L.set(x + i, y + j, frame ? '#2a1f1a' : '#1d1519');
    }
  // panels
  for (const [px, py] of [
    [3, 8],
    [13, 8],
    [3, 30],
    [13, 30],
  ])
    L.rect(x + px, y + py, 8, 18, '#241b22');
  L.vline(x + w - 1, y + 3, h - 3, '#140f12');
  // iron hinges and handle
  for (const hy of [12, h - 14]) L.rect(x, y + hy, 4, 2, '#3a3437');
  L.rect(x + w - 5, y + 30, 2, 3, '#4a4046');
}

function drawDoorGlow(L: Layer, t: number, hover: boolean) {
  const { x, y, w } = DOOR;
  const pulse = 0.5 + 0.5 * Math.sin(t * 1.6);
  const leak = hover ? '#d9c2ff' : pulse > 0.5 ? '#9d7ad6' : '#7e5fb3';
  for (let i = 1; i < w - 1; i++) L.glow(x + i, FLOOR_Y - 1, leak);
  // a faint puddle of light on the floor boards
  for (let i = 2; i < w - 2; i++) if ((i + Math.floor(t * 2)) % 3) L.glow(x + i, FLOOR_Y, mix(leak, '#6f4b31', 0.55));
  // keyhole
  L.glow(x + w - 5, y + 35, hover ? '#fff4ff' : '#c9a8ff');
  L.glow(x + w - 5, y + 36, hover ? '#e8d8ff' : '#9d7ad6');
  if (hover) {
    for (let j = 2; j < FLOOR_Y - y; j += 2) {
      L.glow(x - 3, y + j, '#e8d8ff');
      L.glow(x + w + 2, y + j, '#e8d8ff');
    }
  }
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

function drawRug(L: Layer, rug: string) {
  const x0 = 92, x1 = 306, y0 = 140, y1 = 176;
  if (rug === 'braided') {
    // a braided oval: rings of colour, with a little twist in each
    const cx = 199, cy = 158, rx = 104, ry = 18;
    const rings = [P.rugB, P.rugA, P.rugC, P.mustard, P.rugD, P.rugB, P.rugA, P.rugC];
    for (let y = y0 - 2; y <= y1 + 1; y++)
      for (let x = x0; x <= x1; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d > 1) continue;
        const ring = Math.min(rings.length - 1, Math.floor((1 - Math.sqrt(d)) * rings.length));
        const c = rings[ring];
        L.set(x, y, (x + ring * 2) % 4 === 0 ? mix(c, '#3a2418', 0.15) : c);
      }
    return;
  }
  for (let y = y0; y <= y1; y++) {
    const inset = Math.round((y1 - y) * 0.22); // slight perspective: narrower at the back
    for (let x = x0 + inset; x <= x1 - inset; x++) {
      const bx = x - (x0 + inset);
      const bxR = x1 - inset - x;
      const by = y - y0;
      const byB = y1 - y;
      const border = bx < 3 || bxR < 3 || by < 2 || byB < 2;
      const inner = bx === 4 || bxR === 4 || by === 3 || byB === 3;
      let c = P.rugA;
      if (rug === 'moss') {
        c = border ? P.rugA : inner ? P.sageD : hash(x * 3 + y * 7) > 0.8 ? '#7f8f68' : P.sage;
      } else if (rug === 'kilim') {
        const bands = [P.rugB, P.rugA, P.sage, P.mustard];
        const band = Math.floor((by - 3) / 4);
        const zig = (by - 3) % 4 === 0 && ((x >> 1) + band) % 2 === 0;
        c = border ? P.rugB : inner ? P.rugA : bands[(((zig ? band - 1 : band) % 4) + 4) % 4];
      } else if (rug === 'checker') {
        const sq = (Math.floor((x - 99) / 9) + Math.floor((y - 140) / 5)) % 2;
        c = border ? P.sageD : inner ? P.rugA : sq ? P.rugA : P.sage;
      } else {
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

/** Darken whatever is already there (so shadows work on any rug). */
function shade(L: Layer, x: number, y: number, k: number) {
  x |= 0;
  y |= 0;
  if (x < 0 || y < 0 || x >= L.w || y >= L.h) return;
  const i = (y * L.w + x) * 4;
  L.data[i] = L.data[i] * (1 - k) + 58 * k;
  L.data[i + 1] = L.data[i + 1] * (1 - k) + 36 * k;
  L.data[i + 2] = L.data[i + 2] * (1 - k) + 24 * k;
}

interface CouchLook {
  c: string;
  l: string;
  d: string;
  dd: string;
  pillowA: [string, string];
  pillowB: [string, string];
  dots: string;
  blanket: [string, string, string];
}
const RUST: [string, string, string] = ['#b8674f', '#95513e', '#cc7c62'];
const SAGE_THROW: [string, string, string] = [P.sage, P.sageD, '#a2b187'];
const COUCHES: Record<string, CouchLook> = {
  terracotta: { c: P.couch, l: P.couchL, d: P.couchD, dd: P.couchDD, pillowA: [P.mustard, P.mustardD], pillowB: [P.cream, P.creamD], dots: P.couch, blanket: SAGE_THROW },
  sage: { c: '#7f9068', l: '#94a57c', d: '#66754f', dd: '#4f5b3d', pillowA: [P.mustard, P.mustardD], pillowB: [P.cream, P.creamD], dots: '#b8674f', blanket: RUST },
  mustard: { c: '#c48f3a', l: '#d8a64e', d: '#a1742a', dd: '#7e5a20', pillowA: [P.sage, P.sageD], pillowB: [P.cream, P.creamD], dots: P.sageD, blanket: RUST },
  linen: { c: '#d6c3a0', l: '#e6d6b6', d: '#b9a483', dd: '#978265', pillowA: ['#b8674f', '#95513e'], pillowB: [P.sage, P.sageD], dots: P.cream, blanket: RUST },
  navy: { c: '#3e5277', l: '#51678f', d: '#2f405f', dd: '#233049', pillowA: [P.mustard, P.mustardD], pillowB: [P.cream, P.creamD], dots: '#3e5277', blanket: RUST },
  plum: { c: '#7a4a62', l: '#8f5d77', d: '#613a4e', dd: '#4a2c3c', pillowA: [P.mustard, P.mustardD], pillowB: [P.cream, P.creamD], dots: '#7a4a62', blanket: SAGE_THROW },
};

function drawCouch(L: Layer, look: string) {
  const k = COUCHES[look] || COUCHES.terracotta;
  const { x, y, w, seatY, baseY } = COUCH;
  const armW = 12;
  const armTop = seatY - 7;
  // shadow on rug
  for (let i = -1; i < w + 2; i++) shade(L, x + i, baseY + 1, 0.4);
  for (let i = 2; i < w - 1; i++) shade(L, x + i, baseY + 2, 0.2);
  // back rest
  for (let j = 0; j <= seatY - y; j++) {
    const inset = j === 0 ? 3 : j === 1 ? 1 : 0;
    for (let i = 4 + inset; i < w - 4 - inset; i++) {
      let c = k.c;
      if (j < 2) c = k.l;
      else if (j > seatY - y - 3) c = k.d;
      L.set(x + i, y + j, c);
    }
  }
  // two back cushions
  const mid = Math.floor(w / 2);
  L.vline(x + mid, y + 2, seatY - y - 2, k.d);
  L.vline(x + mid + 1, y + 2, seatY - y - 2, k.l);
  // seat cushions (front face)
  for (let j = 0; j < 6; j++)
    for (let i = armW - 1; i < w - armW + 1; i++) {
      let c = j < 2 ? k.l : j < 4 ? k.c : k.d;
      if (i === mid || i === mid + 1) c = j < 4 ? k.d : k.dd;
      L.set(x + i, seatY + j, c);
    }
  // base
  L.rect(x + 2, seatY + 6, w - 4, baseY - seatY - 8, k.dd);
  L.hline(x + 2, seatY + 6, w - 4, k.d);
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
        let c = k.c;
        if (j < 2) c = k.l;
        else if (ii > armW - 3) c = k.d;
        else if (ii < 2) c = k.l;
        if (j > baseY - armTop - 7) c = k.dd;
        L.set(ax + i, armTop + j, c);
      }
    }
    L.hline(ax + 3, armTop + 3, armW - 6, k.d);
  };
  arm(x, false);
  arm(x + w - armW, true);
  // throw pillows tucked against the arms
  const pillow = (px: number, c: string, cd: string, pattern: boolean) => {
    for (let j = 0; j < 10; j++)
      for (let i = 0; i < 11; i++) {
        if ((j === 0 || j === 9) && (i === 0 || i === 10)) continue;
        let cc = j > 6 || i > 8 ? cd : c;
        if (pattern && (i + j * 2) % 5 === 0 && j > 1 && j < 8) cc = k.dots;
        L.set(px + i, seatY - 9 + j, cc);
      }
  };
  pillow(x + armW - 2, k.pillowA[0], k.pillowA[1], false);
  pillow(x + w - armW - 9, k.pillowB[0], k.pillowB[1], true);
  // knitted blanket draped over the right arm
  const bx = x + w - armW - 1;
  for (let j = 0; j < 14; j++) {
    const from = j < 3 ? 2 : 0;
    const to = j < 3 ? armW + 1 : armW - 3 + Math.min(j, 3);
    for (let i = from; i < to; i++) {
      const c = ((j >> 1) + (i >> 2)) % 2 ? k.blanket[0] : k.blanket[1];
      L.set(bx + i, armTop - 1 + j, j === 0 ? k.blanket[2] : c);
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
  for (let i = 2; i < w - 2; i++) shade(L, x + i, y + 15, 0.3);
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

function drawPlant(L: Layer, plant: string) {
  const pot = (c: string, cl: string, cd: string) => {
    L.rect(4, 150, 20, 18, c);
    L.rect(3, 149, 22, 3, cl);
    L.vline(22, 152, 16, cd);
    L.vline(23, 152, 16, cd);
  };
  if (plant === 'snake') {
    pot('#e6d6b8', '#f0e3c8', '#bba888');
    // back blades first; each is lit on one edge, banded across the middle, a thin yellow margin
    const blades: Array<[number, number, number]> = [[12, 30, -0.22], [17, 33, 0.14], [8, 37, -0.1], [11, 46, -0.03], [15, 41, 0.06]];
    for (const [bx, len, lean] of blades)
      for (let j = 0; j < len; j++) {
        const cx = Math.round(bx + lean * j);
        const y = 149 - j;
        if (j > len - 4) {
          L.set(cx, y, '#4f6e3a');
          continue;
        }
        L.set(cx - 1, y, '#b9bf6e');
        L.set(cx, y, (j + bx) % 7 < 2 ? '#6f8f4e' : '#3f5e30');
        L.set(cx + 1, y, (j + bx) % 7 < 2 ? '#56763e' : '#2f4a25');
        L.set(cx + 2, y, '#a4a95c');
      }
    return;
  }
  if (plant === 'fern') {
    pot(P.sage, '#a2b187', P.sageD);
    // arching fronds, each lined with little leaflets that shrink toward the tip
    for (let f = 0; f < 9; f++) {
      const dir = (f - 4) / 4;
      const len = 28 - Math.abs(f - 4) * 1.5;
      let x = 14 + dir * 2, y = 149;
      let vx = dir * 0.85, vy = -(1 - Math.abs(dir) * 0.45);
      for (let s = 0; s < len; s++) {
        x += vx;
        y += vy;
        vy += 0.012 + Math.abs(dir) * 0.03;
        const n = Math.hypot(vx, vy);
        const nx = -vy / n, ny = vx / n;
        if (s > 2) {
          const leaflet = 1 + Math.round(3 * (1 - s / len));
          for (let k = 1; k <= leaflet; k++) {
            const c = k === leaflet ? P.leafL : P.leaf;
            L.set(x + nx * k - (vx / n) * k * 0.4, y + ny * k - (vy / n) * k * 0.4, c);
            L.set(x - nx * k - (vx / n) * k * 0.4, y - ny * k - (vy / n) * k * 0.4, c);
          }
        }
        L.set(x, y, P.leafD);
      }
    }
    return;
  }
  if (plant === 'cactus') {
    pot(P.pot, '#cf7f64', P.potD);
    const green = '#5f8a4e', light = '#7aa462', dark = '#466b39';
    const column = (x: number, top: number, bottom: number, wdt: number) => {
      for (let j = top; j < bottom; j++)
        for (let i = 0; i < wdt; i++) {
          const round = j === top && (i === 0 || i === wdt - 1);
          if (round) continue;
          L.set(x + i, j, i === 0 ? light : i === wdt - 1 ? dark : (i + j) % 4 === 0 ? '#c9d8a0' : green);
        }
    };
    column(10, 112, 149, 7);
    // arms
    column(4, 124, 132, 4);
    L.rect(6, 131, 5, 3, green);
    column(18, 118, 128, 4);
    L.rect(16, 127, 4, 3, green);
    // a pink flower on top
    L.set(13, 110, '#e895ab');
    L.set(12, 111, '#e895ab');
    L.set(14, 111, '#e895ab');
    L.set(13, 111, '#f6d36b');
    return;
  }
  if (plant === 'lemon') {
    pot('#e6d6b8', '#f0e3c8', '#bba888');
    L.rect(13, 118, 2, 32, P.woodD);
    L.vline(13, 118, 32, P.wood);
    for (let j = -14; j <= 14; j++)
      for (let i = -15; i <= 15; i++) {
        const d = (i / 15) ** 2 + (j / 13) ** 2;
        if (d > 1 || (d > 0.55 && hash(i * 7 + j * 13) > 0.9)) continue;
        L.set(14 + i, 106 + j, d > 0.7 ? P.leafD : hash(i * 3 + j) > 0.6 ? P.leafL : P.leaf);
      }
    for (const [lx, ly] of [[6, 104], [18, 98], [22, 110], [11, 113], [15, 104], [3, 110]]) {
      L.rect(lx, ly, 2, 2, '#f1e35a');
      L.set(lx, ly, '#fff6a8');
      L.set(lx + 1, ly + 1, '#cfbf3e');
    }
    return;
  }
  // the big leafy plant (front-left, partly out of frame)
  pot(P.pot, '#cf7f64', P.potD);
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

/** The parts that never move, drawn once per look of the room. */
const STATIC = new Map<string, Layer>();
function staticLayer(d: Decor): Layer {
  const key = `${d.wall}|${d.view}|${d.rug}|${d.couch}`;
  const hit = STATIC.get(key);
  if (hit) return hit;
  const L = new Layer(ROOM_W, ROOM_H);
  drawWall(L, d.wall);
  drawFloor(L);
  drawWindow(L, d.view);
  drawFireplace(L);
  drawGallery(L);
  drawDarkDoor(L);
  drawBookshelf(L);
  drawLamp(L);
  drawRug(L, d.rug);
  drawSideTable(L);
  drawCouch(L, d.couch);
  // trying things on (and the catalogue's thumbnails) makes a few of these; keep the latest
  if (STATIC.size >= 12) STATIC.delete(STATIC.keys().next().value as string);
  STATIC.set(key, L);
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

/** What moves outside the window. */
function drawWeather(L: Layer, t: number, view: string) {
  const { x, y, w, h } = WIN;
  const put = (wx: number, wy: number, c: string, a = 255) => {
    wx |= 0;
    wy |= 0;
    if (wx < 0 || wy < 0 || wx >= w || wy >= h || onMullion(wx, wy)) return;
    if (a >= 255) L.glow(x + wx, y + wy, c);
    else L.set(x + wx, y + wy, c, a);
  };
  if (view === 'rain') {
    // streaks falling at a slant, and a few drops running down the glass
    for (let k = 0; k < 30; k++) {
      const speed = 70 + hash(k) * 30;
      const sy = (hash(k * 3.7) * h + t * speed) % (h + 6);
      const sx = (hash(k * 1.3) * w + sy * 0.3) % w;
      for (let d = 0; d < 3; d++) put(sx - d * 0.3, sy - d, d === 0 ? '#a9bad3' : '#7f91ad', d === 0 ? 255 : 170);
    }
    for (let k = 0; k < 4; k++) {
      const life = (t * 0.08 + hash(k * 9)) % 1;
      put(4 + hash(k * 2.3) * (w - 8), life * h, '#b7c6dd');
      put(4 + hash(k * 2.3) * (w - 8), life * h - 1, '#8fa0bb', 160);
    }
  } else if (view === 'summer') {
    // fireflies drifting low over the hills, blinking
    for (let k = 0; k < 8; k++) {
      if (Math.sin(t * 2.1 + k * 2.7) < 0.1) continue;
      const fx = hash(k * 4.1) * w + Math.sin(t * 0.5 + k) * 4;
      const fy = h * 0.55 + hash(k * 6.3) * h * 0.38 + Math.cos(t * 0.7 + k * 1.3) * 3;
      put(fx, fy, '#f3fbb0');
      put(fx - 1, fy, '#b9d65a', 200);
      put(fx + 1, fy, '#b9d65a', 200);
      put(fx, fy - 1, '#b9d65a', 160);
    }
  } else if (view === 'blossom') {
    // petals on the breeze
    for (let k = 0; k < 12; k++) {
      const life = (t * (0.05 + hash(k) * 0.04) + hash(k * 2.9)) % 1;
      const px = (hash(k * 1.7) * w + life * 30 + Math.sin(t * 1.5 + k) * 2) % w;
      const py = life * h;
      put(px, py, k % 3 ? '#f2b8c6' : '#fbe0e6');
      if (k % 2) put(px + 1, py, '#e895ab', 200);
    }
  } else if (view === 'city') {
    // windows going on and off
    CITY.windows.forEach(([wx, wy], k) => {
      if (hash(k * 1.9 + Math.floor(t / 4 + hash(k) * 4)) > 0.42) put(wx, wy, k % 7 ? '#f6c46a' : '#f3e2b0');
    });
  } else if (view === 'aurora') {
    // rippling curtains of light: brightest along the bottom edge, rays fading upward
    for (let i = 0; i < w; i++) {
      const top = 4 + Math.sin(i * 0.16 + t * 0.6) * 4 + Math.sin(i * 0.05 - t * 0.35) * 3;
      const len = 10 + Math.sin(i * 0.3 + t) * 3 + hash(i) * 2;
      const ray = 0.6 + 0.4 * Math.sin(i * 0.9 + t * 1.7) * Math.sin(i * 0.37 - t * 0.8);
      for (let j = 0; j < len; j++) {
        const f = j / len;
        const c = f < 0.45 ? '#2c8f78' : f < 0.85 ? '#4fdc9c' : '#b4ffdc';
        put(i, top + j, c, Math.round(ray * (50 + 190 * f)));
      }
    }
  } else {
    // snow
    for (let k = 0; k < 26; k++) {
      const speed = 5 + hash(k) * 6;
      const sy = ((hash(k * 3.7) * h + t * speed) % h) | 0;
      const sx = ((hash(k * 1.3) * w + Math.sin(t * 1.3 + k) * 2 + w) % w) | 0;
      put(sx, sy, hash(k * 9) > 0.5 ? '#e8eef6' : '#b7c3db');
    }
  }
}

/** The picture over the mantel. */
function drawPainting(L: Layer, painting: string, state: RoomState) {
  const px = 111, py = 16, pw = 34, ph = 24;
  L.rect(px - 2, py - 2, pw + 4, ph + 4, P.mantelD);
  L.rect(px - 1, py - 1, pw + 2, ph + 2, P.brass);
  const paint = (fn: (i: number, j: number) => string) => {
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) L.set(px + i, py + j, fn(i, j));
  };
  const disc = (cx: number, cy: number, r: number, c: string) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) if (i * i + j * j <= r * r) L.set(px + cx + i, py + cy + j, c);
  };
  switch (painting) {
    case 'sea': {
      paint((i, j) => {
        if (j < 13) return j < 5 ? '#cfe0e6' : j < 10 ? '#e2dcc4' : '#efd5ad';
        return (i * 2 + j * 5) % 11 === 0 ? '#8fb0c4' : j > 19 ? '#4f7592' : '#5f86a3';
      });
      for (let j = -3; j <= 0; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 9) L.set(px + 24 + i, py + 12 + j, '#f6dc9c');
      // a little boat
      L.hline(px + 7, py + 15, 8, '#6b4633');
      L.hline(px + 8, py + 16, 6, '#4d3224');
      for (let j = 0; j < 6; j++) L.hline(px + 11 - Math.floor(j / 2), py + 9 + j, Math.floor(j / 2) + 1, '#efe3cb');
      L.vline(px + 11, py + 8, 7, '#4d3224');
      return;
    }
    case 'peaks': {
      paint((_i, j) => (j < 8 ? '#1f2a48' : j < 15 ? '#26325a' : '#2f3b52'));
      disc(26, 5, 3, '#f4ecd0');
      for (const [sx, sy] of [[4, 3], [12, 2], [19, 6], [31, 11], [8, 9]]) L.set(px + sx, py + sy, '#c9d2ea');
      const peak = (cx: number, top: number, half: number) => {
        for (let j = top; j < ph; j++) {
          const span = Math.round(((j - top) / (ph - top)) * half * 1.8);
          for (let i = cx - span; i <= cx + span; i++) {
            if (i < 0 || i >= pw) continue;
            L.set(px + i, py + j, j - top < 4 ? '#e6ecf2' : (i + j) % 5 === 0 ? '#5d6e8a' : '#4f5f7a');
          }
        }
      };
      peak(11, 7, 9);
      peak(24, 10, 8);
      for (let i = 0; i < pw; i++) for (let j = 21; j < ph; j++) L.set(px + i, py + j, '#2a3448');
      return;
    }
    case 'flowers': {
      // a still life: a terracotta jug of flowers on a table, against a cream wall
      paint((i, j) => (j < 17 ? ((i * 3 + j * 7) % 13 === 0 ? '#dcc7a2' : '#e7d6b4') : j === 17 ? '#7a4f38' : (i + j) % 7 === 0 ? '#9a6748' : '#8c5b3f'));
      // jug
      for (let j = 0; j < 8; j++) {
        const half = j < 1 ? 2 : j < 2 ? 3 : j < 6 ? 4 : 3;
        for (let i = -half; i <= half; i++) L.set(px + 17 + i, py + 11 + j, i === -half ? '#d98f70' : i >= half - 1 ? '#95513e' : '#b8674f');
      }
      L.hline(px + 15, py + 13, 5, '#efe3cb');
      // stems and leaves
      for (const [sx, sy] of [[12, 5], [17, 2], [22, 5], [14, 8], [20, 8]]) L.vline(px + sx, py + sy + 1, 11 - sy, '#5f7550');
      for (const [lx, ly, d] of [[13, 9, -1], [21, 9, 1], [16, 6, -1], [18, 6, 1]]) {
        L.set(px + lx, py + ly, '#7d9468');
        L.set(px + lx + d, py + ly - 1, '#7d9468');
      }
      const bloom = (cx: number, cy: number, c: string, mid: string) => {
        L.set(px + cx, py + cy - 1, c);
        L.set(px + cx - 1, py + cy, c);
        L.set(px + cx + 1, py + cy, c);
        L.set(px + cx, py + cy + 1, c);
        L.set(px + cx, py + cy, mid);
      };
      bloom(12, 5, '#e8b04a', '#a7772b');
      bloom(17, 2, '#d9566a', '#8e2f3e');
      bloom(22, 5, '#f6efe0', '#e8b04a');
      bloom(14, 8, '#e98a9c', '#b8674f');
      bloom(20, 8, '#e8b04a', '#a7772b');
      // a lemon beside it
      L.rect(px + 25, py + 16, 3, 2, '#e8c64a');
      L.set(px + 28, py + 17, '#c9a83a');
      return;
    }
    case 'shapes': {
      paint(() => '#efe3cb');
      for (let j = 8; j < ph; j++)
        for (let i = 0; i < 15; i++) {
          const dx = i - 7;
          if (j < 15 && dx * dx + (j - 15) * (j - 15) > 49) continue;
          L.set(px + i, py + j, '#b8674f');
        }
      disc(25, 7, 5, P.mustard);
      for (let i = 15; i < pw; i++) {
        const top = Math.round(17 + Math.sin((i - 15) * 0.25) * 2);
        for (let j = top; j < ph; j++) L.set(px + i, py + j, P.sage);
      }
      L.rect(px + 2, py + 2, 5, 3, '#3e5277');
      return;
    }
    case 'us': {
      // a portrait of the two of you, under a soft arch
      paint((i, j) => {
        const dx = i - pw / 2 + 0.5;
        const inArch = j > 6 ? Math.abs(dx) < 13 : dx * dx + (j - 7) * (j - 7) * 2.6 < 169;
        return inArch ? '#d9b98e' : '#ead6b5';
      });
      const head = (seat: Seat, ox: number) => {
        if (!seat.avatar || seat.status === 'empty') return;
        const { buf, headTop } = renderCharacter(seat.avatar, 'stand');
        const top = Math.max(0, headTop - 3);
        for (let j = 0; j < ph - 1; j++)
          for (let i = 2; i < 22; i++) {
            const k = ((top + j) * buf.w + i) * 4;
            if (top + j >= buf.h || !buf.data[k + 3]) continue;
            L.set(px + ox + i - 2, py + 1 + j, [buf.data[k], buf.data[k + 1], buf.data[k + 2]]);
          }
      };
      head(state.left, -1);
      head(state.right, 14);
      return;
    }
    default: {
      // dusk hills
      for (let j = 0; j < ph; j++)
        for (let i = 0; i < pw; i++) {
          const t = j / ph;
          let c = t < 0.3 ? '#e9b97a' : t < 0.5 ? '#e39a6a' : '#d8866a';
          const hill1 = ph * 0.55 + Math.sin(i * 0.25) * 3;
          const hill2 = ph * 0.72 + Math.sin(i * 0.17 + 2) * 2;
          if (j > hill1) c = '#8a9a72';
          if (j > hill2) c = '#6a7856';
          if (j > hill1 && j < hill1 + 1) c = '#a2b187';
          L.set(px + i, py + j, c);
        }
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (i * i + j * j <= 9) L.set(px + 22 + i, py + 10 + j, '#f6dc9c');
      for (let i = 0; i < pw; i++) {
        const hill1 = Math.ceil(ph * 0.55 + Math.sin(i * 0.25) * 3);
        for (let j = hill1; j < ph; j++) {
          const hill2 = ph * 0.72 + Math.sin(i * 0.17 + 2) * 2;
          L.set(px + i, py + j, j > hill2 ? '#6a7856' : j === hill1 ? '#a2b187' : '#8a9a72');
        }
      }
    }
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

/** Board games stacked on the floor beside the couch, with a die on top. */
function drawGameStack(L: Layer, t: number, waiting: boolean, hover: boolean) {
  const box = (x: number, y: number, w: number, h: number, c: string, stripe?: string) => {
    L.rect(x - 1, y - 1, w + 2, h + 2, '#2b1e1c');
    L.rect(x, y, w, h, c);
    L.hline(x, y, w, mix(c, '#fff8ea', 0.35));
    L.vline(x + w - 1, y + 1, h - 1, mix(c, '#2b1e1c', 0.3));
    if (stripe) L.hline(x + 1, y + Math.floor(h / 2), w - 3, stripe);
  };
  const { x, y } = GAMES_STACK;
  box(x + 1, y + 13, 12, 3, '#d4775b', '#f4e3c0');
  box(x + 2, y + 9, 10, 3, '#9fb087');
  L.set(x + 4, y + 10, '#f0b84d');
  L.set(x + 6, y + 10, '#f0b84d');
  box(x + 1, y + 5, 12, 3, '#6a86ad', '#f0b84d');
  // a die on top
  L.rect(x + 5, y + 1, 4, 3, '#2b1e1c');
  L.rect(x + 5, y + 1, 3, 3, '#f7eedb');
  L.set(x + 6, y + 2, '#3a2a26');
  if (waiting) {
    // a firefly hovering over the stack: something's waiting for you
    const bob = Math.floor(t * 2) % 2;
    const fx = x + 11;
    const fy = y - 3 - bob;
    L.glow(fx, fy, '#fff4c2');
    L.glow(fx - 1, fy, '#ffcf5a');
    L.glow(fx + 1, fy, '#ffcf5a');
    L.glow(fx, fy - 1, '#ffcf5a');
    L.glow(fx, fy + 1, '#e2a33a');
  }
  if (hover) {
    for (let i = -1; i <= GAMES_STACK.w; i++) {
      L.glow(x + i, y - 2, '#fff4c2');
      L.glow(x + i, y + GAMES_STACK.h, '#fff4c2');
    }
    for (let j = -1; j < GAMES_STACK.h; j += 2) {
      L.glow(x - 2, y + j, '#fff4c2');
      L.glow(x + GAMES_STACK.w + 1, y + j, '#fff4c2');
    }
  }
}

/** A little side table by the couch's right arm, with records on its shelf. */
function drawSideTable(L: Layer) {
  const { x, y, w } = SIDE_TABLE;
  // shadow on the rug
  for (let i = 0; i < w; i++) shade(L, x + i, 150, 0.35);
  // legs
  for (const lx of [x + 1, x + w - 3]) {
    L.rect(lx, y + 3, 2, 17, P.woodD);
    L.vline(lx, y + 3, 17, P.wood);
  }
  // a shelf of records: sleeves standing on end, and one leaning
  const spines = [P.cream, P.rugB, P.sage, P.mustard, '#5a79a3', P.creamD, '#3a2a26', P.rugB, P.cream];
  spines.forEach((c, i) => {
    const h = 7 - (i % 3 === 1 ? 1 : 0);
    L.rect(x + 3 + i * 1.6, y + 11 - h + 7, 2, h, c);
  });
  L.rect(x + 3, y + 18, w - 6, 2, P.wood);
  L.hline(x + 3, y + 18, w - 6, P.woodL);
  // table top
  L.rect(x, y, w, 3, P.wood);
  L.hline(x, y, w, P.woodL);
  L.hline(x + 1, y + 2, w - 2, P.woodD);
}

/** The record player on the side table; the record turns and notes drift up while it plays. */
function drawTurntable(L: Layer, t: number, playing: boolean, hover: boolean) {
  const { x, y, w } = DECK;
  // the lid, propped open behind (clear plastic catching the lamp light)
  for (let i = 1; i < w - 1; i++) {
    L.set(x + i, y - 9, '#e6d6b8', 150);
    L.set(x + i, y - 8, '#e6d6b8', 40);
  }
  for (let j = y - 8; j < y - 2; j++) {
    L.set(x + 1, j, '#e6d6b8', 120);
    L.set(x + w - 2, j, '#e6d6b8', 120);
    for (let i = 2; i < w - 2; i++) L.set(x + i, j, '#e6d6b8', 22);
  }
  // plinth: a pale top plate on a wooden box
  L.rect(x, y, w, 2, '#b9a98f');
  L.hline(x, y, w, '#d8c7a4');
  L.rect(x, y + 2, w, 3, '#7a5540');
  L.hline(x, y + 2, w, '#8f6649');
  L.hline(x, y + 4, w, '#4d3224');
  // a brass knob, and a little light that's on while it plays
  L.set(x + w - 3, y + 3, P.brassL);
  if (playing) L.glow(x + 2, y + 3, '#ffb347');
  else L.set(x + 2, y + 3, '#3a2a26');
  // the record (seen from a little above)
  const cx = x + 7;
  const rows: Array<[number, number]> = [
    [y - 2, 3],
    [y - 1, 5],
    [y, 6],
    [y + 1, 5],
  ];
  for (const [ry, half] of rows) {
    L.hline(cx - half, ry, half * 2 + 1, '#1f1718');
    L.set(cx - half, ry, '#3a3035');
    L.set(cx + half, ry, '#3a3035');
  }
  // grooves catch the lamp light
  L.hline(cx - 4, y - 1, 2, '#3a3035');
  L.hline(cx + 3, y + 1, 2, '#3a3035');
  // the label
  L.set(cx, y - 1, P.rugB);
  L.set(cx + 1, y - 1, P.cream);
  L.set(cx, y, P.cream);
  if (playing) {
    // a glint going round
    const a = t * 3.5;
    const gx = Math.round(cx + Math.cos(a) * 5);
    const gy = Math.round(y - 0.5 + Math.sin(a) * 1.4);
    L.set(gx, gy, '#8a7f86');
  }
  // tonearm: resting at the side, or across the record
  const px = x + w - 4;
  const py = y - 1;
  L.set(px, py, P.brassL);
  L.set(px + 1, py, P.brass);
  if (playing) {
    L.set(px - 1, py, '#cfc3b0');
    L.set(px - 2, py, '#cfc3b0');
    L.set(px - 3, py + 1, '#cfc3b0');
    L.set(px - 4, py + 1, '#e6d6b8');
  } else {
    L.set(px, py + 1, '#cfc3b0');
    L.set(px + 1, py + 2, '#cfc3b0');
    L.set(px + 1, py + 3, '#e6d6b8');
  }
  if (playing) {
    // notes drifting up and fading
    for (let k = 0; k < 3; k++) {
      const life = (t * 0.45 + k / 3) % 1;
      const nx = Math.round(cx - 2 + k * 4 + Math.sin((t + k) * 2) * 1.5 + life * 3);
      const ny = Math.round(y - 5 - life * 16);
      const alpha = Math.round(255 * (life < 0.2 ? life / 0.2 : 1 - (life - 0.2) / 0.8));
      const c = k === 1 ? '#fff4c2' : '#f4d9a8';
      L.set(nx, ny, c, alpha);
      L.set(nx + 1, ny, c, alpha);
      L.set(nx + 1, ny - 1, c, alpha);
      L.set(nx + 1, ny - 2, c, alpha);
      L.set(nx + 2, ny - 2, c, alpha);
    }
  }
  if (hover) {
    const hx = SIDE_TABLE.x - 2;
    const hw = SIDE_TABLE.w + 3;
    for (let i = 0; i <= hw; i++) {
      L.glow(hx + i, y - 11, '#fff4c2');
      L.glow(hx + i, 151, '#fff4c2');
    }
    for (let j = y - 11; j <= 151; j += 2) {
      L.glow(hx, j, '#fff4c2');
      L.glow(hx + hw, j, '#fff4c2');
    }
  }
}

/** the cushion by the hearth, and whoever's asleep on it */
const PET = { x: 118, y: 131 };

const PET_SPRITES: Record<string, { rows: string[]; pal: Record<string, string>; dx: number; dy: number }> = {
  pug: {
    rows: [
      '.kk.....oooooooo......',
      'kOOk..ooOOOOOOOOoo....',
      'OOOOooOOOOOOOOOOOOo...',
      'OkOOOOOOOOOOOOOOOOOo.t',
      'mmmOOOOOOOOOOOOOOOOOot',
      'kmnmOOOOOOOOOOOOOOOo..',
      '.kk.oooooooooooooooo..',
    ],
    pal: { o: '#a87c4c', O: '#d1a56c', k: '#2b2224', m: '#463739', n: '#141012', t: '#a87c4c' },
    dx: -2,
    dy: -2,
  },
  bunny: {
    rows: [
      '...eeeeeee............',
      '..eppppppee..wwwww....',
      '.wweeeeeeewwwWWWWWw...',
      'wWWWWWWWWWWWWWWWWWWw..',
      'wkWWWWWWWWWWWWWWWWWWw.',
      'nWWWWWWWWWWWWWWWWWWWcc',
      '.wwwwwwwwwwwwwwwwwwwcc',
    ],
    pal: { w: '#bfb5a8', W: '#eee7db', e: '#d3c8b9', p: '#e3a9a9', n: '#d98c8c', k: '#4e4240', c: '#fbf8f2' },
    dx: -2,
    dy: -2,
  },
  corgi: {
    rows: [
      '.o...o................',
      'oOo.oOo..ooooooooo....',
      'oOOOOOOoOOOOOOOOOOOo..',
      'OOkOkOOOOOOOOOOOOOOOo.',
      'WWWWWWOOOOOOOOOOOOOOOo',
      '.nWWWWWWWWWOOOOOOOOOo.',
      '..WWWWWWWWWWWWWoooo...',
    ],
    pal: { o: '#b86e33', O: '#d98c4a', W: '#f3ebdf', k: '#3a2a26', n: '#2b2224' },
    dx: -2,
    dy: -2,
  },
};

/** The cat's curl: shared by the ginger and the tuxedo. */
function drawCatCurl(L: Layer, t: number, dark: string, light: string, face: string, tuxedo: boolean) {
  const { x, y } = PET;
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
  const pal: Record<string, string> = { o: dark, O: light };
  for (let j = 0; j < body.length; j++)
    for (let i = 0; i < body[j].length; i++) {
      const k = body[j][i];
      if (k === '.') continue;
      L.set(x + i, y - 2 + j + (j < 2 ? -breath : 0), pal[k]);
      if (breath && j === 1) L.set(x + i, y - 1, pal[k]);
    }
  // head tucked in on the left
  L.rect(x - 1, y + 1, 6, 4, face);
  L.set(x - 1, y, dark);
  L.set(x + 3, y, dark);
  if (tuxedo) {
    // white muzzle and bib, and white front paws
    L.rect(x, y + 3, 4, 2, '#efe8dc');
    L.rect(x + 4, y + 3, 3, 2, '#efe8dc');
    L.set(x + 6, y + 4, '#efe8dc');
    L.set(x + 1, y + 2, '#5a4c4e');
    L.set(x + 3, y + 2, '#5a4c4e');
  } else {
    L.set(x, y + 3, '#5a3a2c');
    L.set(x + 2, y + 3, '#5a3a2c');
  }
  L.set(x + 1, y + 4, '#e9a0a0');
  // tail tip swish
  const sw = Math.sin(t * 1.3) > 0.7 ? 1 : 0;
  L.set(x + 20, y + 4 - sw, dark);
}

function drawPet(L: Layer, t: number, pet: string) {
  const { x, y } = PET;
  // cushion
  for (let j = 0; j < 6; j++)
    for (let i = 0; i < 26; i++) {
      const corner = (j === 0 || j === 5) && (i < 2 || i > 23);
      if (corner) continue;
      L.set(x - 3 + i, y + 4 + j, j < 2 ? '#a2b187' : j > 3 ? P.sageD : P.sage);
    }
  if (pet === 'none') return;
  if (pet === 'tuxedo') drawCatCurl(L, t, '#26201f', '#3b3334', '#3b3334', true);
  else if (PET_SPRITES[pet]) {
    const sp = PET_SPRITES[pet];
    const breath = Math.sin(t * 2.2) > 0 ? 1 : 0;
    // the back rises and falls; the head stays put
    sp.rows.forEach((row, j) =>
      [...row].forEach((k, i) => {
        if (k === '.') return;
        const lift = j < 2 && i >= 10 ? breath : 0;
        L.set(x + sp.dx + i, y + sp.dy + j - lift, sp.pal[k]);
        // breathing in: the back gets a pixel taller rather than floating off
        if (lift && j === 1) L.set(x + sp.dx + i, y + sp.dy + j, sp.pal[k]);
      })
    );
    if (pet === 'pug' && Math.sin(t * 1.3) > 0.7) L.set(x + sp.dx + 21, y + sp.dy + 3, sp.pal.t);
  } else drawCatCurl(L, t, '#b86e33', '#d98c4a', '#d98c4a', false);
  // zzz
  const zl = (t * 0.5) % 1;
  if (zl < 0.7) {
    const zx = x - 2 - zl * 3;
    const zy = y - 4 - zl * 10;
    const a = Math.round(220 * (1 - zl));
    L.set(zx, zy, '#e9e0d0', a);
    L.set(zx + 1, zy, '#e9e0d0', a);
    L.set(zx + 1, zy + 1, '#e9e0d0', a);
    L.set(zx, zy + 2, '#e9e0d0', a);
    L.set(zx + 1, zy + 2, '#e9e0d0', a);
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

/**
 * One person on the couch. `lift` hops them up a pixel while they scoot along;
 * `lean` tips their head a pixel toward the other person once they're side by side.
 */
function seatCharacter(L: Layer, seat: Seat, cx: number, t: number, phase: number, hover: boolean, lift = 0, lean = 0) {
  if (!seat.avatar || seat.status === 'empty') return;
  const blink = (t + phase) % 4.2 < 0.12;
  const bob = lift ? 0 : Math.sin((t + phase) * 1.6) > 0.55 ? 1 : 0;
  const asleep = seat.status === 'offline' || seat.status === 'away';
  const { buf, anchor, headTop } = renderCharacter(seat.avatar, 'sit', { blink, bob, sleepy: asleep });
  const x = cx - anchor.x;
  const y = COUCH.seatY - anchor.y - lift;
  if (lean) {
    // the head (everything above the shoulders) shifts; the body stays put
    const neck = headTop + 9;
    const head = new PixelBuffer(buf.w, buf.h);
    const body = new PixelBuffer(buf.w, buf.h);
    for (let j = 0; j < buf.h; j++)
      for (let i = 0; i < buf.w; i++) {
        const k = (j * buf.w + i) * 4;
        if (!buf.data[k + 3]) continue;
        const dst = j < neck ? head : body;
        for (let c = 0; c < 4; c++) dst.data[k + c] = buf.data[k + c];
      }
    L.blit(body, x, y);
    L.blit(head, x + lean, y);
  } else L.blit(buf, x, y);
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

function drawThread(L: Layer, state: RoomState, t: number, lx: number, rx: number) {
  if (!state.left.avatar || !state.right.avatar || state.right.status === 'empty' || state.left.status === 'empty') return;
  // the red thread — from one lap to the other, gently sagging (less as they sit closer)
  const x0 = lx + 5;
  const x1 = rx - 5;
  const y0 = COUCH.seatY - 1;
  if (x1 - x0 < 6) {
    // side by side: the thread is just a little knot between their hands
    const kx = Math.round((x0 + x1) / 2);
    L.set(kx - 1, y0, '#c4453f');
    L.set(kx, y0 + 1, '#c4453f');
    L.set(kx + 1, y0, '#c4453f');
    L.set(kx, y0, '#e0685f');
    return;
  }
  const sag = Math.min(3, (x1 - x0) / 6) + Math.sin(t * 1.2) * 0.6;
  let prev = -1;
  for (let x = x0; x <= x1; x++) {
    const u = (x - x0) / (x1 - x0);
    const y = Math.round(y0 + Math.sin(u * Math.PI) * sag);
    L.set(x, y, '#c4453f');
    if (prev >= 0 && Math.abs(y - prev) > 1) L.set(x, (y + prev) >> 1, '#c4453f');
    prev = y;
  }
}

/** A small heart floating up from between them. */
function drawHeart(L: Layer, cx: number, t: number, since: number) {
  const age = t - since;
  if (age < 0 || age > 2.6) return;
  const y = Math.round(COUCH.seatY - 36 - age * 7);
  const x = Math.round(cx + Math.sin(age * 4) * 1.5);
  const a = Math.round(255 * Math.min(1, (2.6 - age) / 0.8));
  const rows = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
  rows.forEach((row, j) =>
    [...row].forEach((k, i) => {
      if (k === '#') L.glow(x - 3 + i, y + j, i === 1 && j === 1 ? '#ffd0cb' : '#e0605a', a);
    })
  );
}

function drawForeground(L: Layer, plant: string) {
  drawPlant(L, plant);
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
  const d = state.decor || START_DECOR;
  L.copyFrom(staticLayer(d));
  drawPainting(L, d.painting, state);
  drawFire(L, t, state.fire);
  drawDoorGlow(L, t, state.hover === 'door');
  drawCandles(L, t);
  drawWeather(L, t, d.view);
  drawPhotoPortrait(L, state);
  drawPet(L, t, d.pet);
  drawGameStack(L, t, !!state.gamesWaiting, state.hover === 'games');
  drawTurntable(L, t, !!state.music, state.hover === 'music');

  // characters on the couch (left seat first so the right one overlaps on lean)
  const closeness = state.closeness ?? 0;
  const { left: lx, right: rx } = seatXs(closeness);
  const leftEmpty = !state.left.avatar || state.left.status === 'empty';
  const rightEmpty = !state.right.avatar || state.right.status === 'empty';
  // a little hop on alternate frames while they shuffle along
  const lift = state.scooting && Math.floor(t * 8) % 2 === 0 ? 1 : 0;
  const snug = closeness >= 1 && !state.scooting && !leftEmpty && !rightEmpty;
  if (!state.bare) {
    if (leftEmpty) drawEmptySeat(L, lx, t, state.hover === 'left');
    else seatCharacter(L, state.left, lx, t, 0, state.hover === 'left', lift, snug ? 1 : 0);
    if (rightEmpty) drawEmptySeat(L, rx, t, state.hover === 'right');
    else seatCharacter(L, state.right, rx, t, 1.7, state.hover === 'right', lift, snug ? -1 : 0);
    drawThread(L, state, t, lx, rx);
    const heartAt = state.heartAt ?? -1;
    if (heartAt >= 0 && t - heartAt < 2.6) drawHeart(L, (lx + rx) / 2, t, heartAt);
    // side by side: now and then a heart drifts up on its own
    else if (snug) drawHeart(L, (lx + rx) / 2, t % 9, 0);
  }

  drawTable(L);
  drawSteam(L, t);
  drawLetter(L, t, state.letterUnread, state.hover === 'letter');
  drawForeground(L, d.plant);

  applyLighting(L, t, state.fire);
  return L;
}

/** Focal point to keep in view when the screen is narrower than 16:9. */
export const ROOM_FOCUS_X = 232;

/** The clickable spots, with the two seats wherever the couple is sitting now. */
export function hotspots(closeness = 0): Hotspot[] {
  const { left, right } = seatXs(closeness);
  const w = Math.min(20, right - left + 2);
  return [
    { id: 'left', x: left - Math.floor(w / 2), y: 112, w, h: 38 },
    { id: 'right', x: right - Math.ceil(w / 2) + 1, y: 112, w, h: 38 },
    ...HOTSPOTS,
  ];
}

export function hitTest(x: number, y: number, closeness = 0): HotspotId | null {
  for (const h of hotspots(closeness)) if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h.id;
  return null;
}

export function hotspotRect(id: HotspotId, closeness = 0) {
  return hotspots(closeness).find((h) => h.id === id)!;
}

void hex;

/* ------------------------------------------------------------------------ */
/*  The catalogue's little pictures                                           */
/* ------------------------------------------------------------------------ */

/** The part of the room each spot's thumbnail shows: x, y, w, h. */
export const DECOR_CROPS: Record<SlotId, [number, number, number, number]> = {
  wall: [190, 6, 96, 64],
  couch: [180, 108, 102, 68],
  rug: [88, 124, 84, 56],
  pet: [102, 114, 54, 36],
  view: [12, 14, 66, 70],
  painting: [104, 10, 48, 32],
  plant: [0, 94, 48, 72],
};

/** The room with `decor` in it, cropped to `slot`. The seats only matter for the portrait of you two. */
export function renderDecorThumb(decor: Decor, slot: SlotId, left: Seat, right: Seat): PixelBuffer {
  const room = renderRoom({ left, right, letterUnread: false, fire: 0.6, hover: null, closeness: 0, decor, bare: true }, 1.3);
  const [x0, y0, w, h] = DECOR_CROPS[slot];
  const out = new PixelBuffer(w, h);
  for (let j = 0; j < h; j++) {
    const from = ((y0 + j) * ROOM_W + x0) * 4;
    out.data.set(room.data.subarray(from, from + w * 4), j * w * 4);
  }
  return out;
}
