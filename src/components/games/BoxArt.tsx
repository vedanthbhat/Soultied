import React from 'react';
import { PixelArt, Painter } from './Pixel';

/** The picture on each game box, drawn in the room's pixel style (40 x 26). */

export type BoxId = 'fireflies' | 'boats' | 'door' | 'doodle' | 'coasters' | 'kitchen' | 'noughts' | 'fence' | 'lanterns' | 'tug' | 'quickdraw' | 'rps';

const W = 40;
const H = 26;

const disc = (px: Parameters<Painter>[0], cx: number, cy: number, r: number, c: string) => {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.6) px(cx + x, cy + y, 1, 1, c);
};

const firefly = (px: Parameters<Painter>[0], x: number, y: number, body: string, halo: string) => {
  px(x - 1, y, 3, 1, halo);
  px(x, y - 1, 1, 3, halo);
  px(x, y, 1, 1, body);
};

const PAINT: Record<BoxId, Painter> = {
  fireflies: (px, dot) => {
    const sky = ['#1b2340', '#1f2748', '#232d52', '#28325b', '#2e3a64'];
    sky.forEach((c, i) => px(0, Math.round((i * H) / sky.length), W, Math.ceil(H / sky.length) + 1, c));
    [[3, 3], [9, 6], [33, 4], [36, 10], [30, 2], [5, 12]].forEach(([x, y]) => dot(x, y, '#8d8aa6'));
    // the jar
    px(14, 6, 12, 18, '#27335e');
    px(13, 7, 1, 16, '#9fc3d6');
    px(26, 7, 1, 16, '#9fc3d6');
    px(14, 23, 12, 1, '#9fc3d6');
    px(15, 8, 1, 10, '#c8e0ea');
    px(14, 4, 12, 2, '#b48c4a');
    px(14, 4, 12, 1, '#d6ad63');
    px(15, 3, 10, 1, '#8a6a36');
    // fireflies in the jar and out
    firefly(px, 18, 19, '#fff4c2', '#e2a33a');
    firefly(px, 22, 20, '#eafff6', '#3fae8f');
    firefly(px, 20, 15, '#fff4c2', '#e2a33a');
    firefly(px, 17, 11, '#eafff6', '#3fae8f');
    firefly(px, 31, 16, '#fff4c2', '#e2a33a');
    firefly(px, 8, 18, '#eafff6', '#3fae8f');
  },
  boats: (px, dot) => {
    px(0, 0, W, H, '#3d6d84');
    px(0, 0, W, 5, '#4a7c93');
    [[3, 8, 5], [24, 6, 6], [30, 13, 5], [6, 20, 6], [18, 23, 5], [33, 21, 4]].forEach(([x, y, w]) => px(x, y, w, 1, '#6a9db3'));
    const boat = (x: number, y: number, s: number) => {
      // hull
      px(x, y, 9 * s, 1, '#efe3cb');
      px(x + s, y + 1, 7 * s, 1, '#d8c7a4');
      px(x + 2 * s, y + 2, 5 * s, 1, '#bfae8c');
      // folded sail
      for (let k = 0; k < 4 * s; k++) px(x + 4 * s - Math.floor(k / 2), y - 1 - k, Math.max(1, Math.floor(k / 2) + 1), 1, k % 3 === 0 ? '#d8c7a4' : '#f4ead6');
      px(x + 4 * s, y - 4 * s, 1, 4 * s, '#bfae8c');
    };
    boat(5, 14, 1);
    boat(20, 18, 1);
    dot(12, 18, '#c4453f');
    dot(13, 17, '#f0a08f');
  },
  door: (px) => {
    px(0, 0, W, H, '#1d1518');
    px(14, 4, 12, 22, '#1a1214');
    px(15, 3, 10, 1, '#1a1214');
    px(15, 5, 10, 21, '#2a2024');
    for (const y of [7, 15]) {
      px(16, y, 3, 6, '#352a2e');
      px(21, y, 3, 6, '#352a2e');
    }
    px(23, 14, 1, 1, '#9d7ad6');
    px(15, 25, 10, 1, '#9d7ad6');
    px(12, 25, 16, 1, '#3b2a4a');
  },
  doodle: (px) => {
    px(0, 0, W, H, '#f4e8d0');
    for (let y = 4; y < H; y += 5) px(0, y, W, 1, '#eadbbd');
    // a doodled little house and sun
    const ink = '#b8674f';
    px(8, 12, 12, 1, ink);
    for (let k = 0; k < 6; k++) {
      px(8 + k, 12 - k, 1, 1, ink);
      px(19 - k, 12 - k, 1, 1, ink);
    }
    px(9, 13, 1, 8, ink);
    px(18, 13, 1, 8, ink);
    px(9, 20, 10, 1, ink);
    px(12, 16, 3, 4, ink);
    px(27, 5, 3, 3, '#e2b359');
    // the pencil
    px(24, 20, 10, 2, '#e2b359');
    px(34, 20, 2, 2, '#f0a08f');
    px(22, 20, 2, 2, '#efdcb8');
    px(21, 20, 1, 1, '#3a2a26');
  },
  coasters: (px) => {
    px(0, 0, W, H, '#6b4633');
    for (let y = 2; y < H; y += 4) px(0, y, W, 1, '#61402f');
    px(19, 0, 2, H, '#845a42');
    disc(px, 7, 13, 5, '#efdcb8');
    disc(px, 7, 13, 3, '#d2bb93');
    disc(px, 32, 13, 5, '#8a9a72');
    disc(px, 32, 13, 3, '#6a7856');
    disc(px, 23, 9, 2, '#2c2527');
  },
  noughts: (px, dot) => {
    px(0, 0, W, H, '#3b2a1e');
    px(8, 1, 24, 24, '#6b4a2f');
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) px(9 + c * 8, 2 + r * 8, 6, 6, '#efe3cb');
    // a heart, two rings, and another heart lined up
    const heart = (x: number, y: number) => {
      px(x, y + 1, 4, 2, '#e07a5f');
      px(x, y, 1, 1, '#e07a5f');
      px(x + 3, y, 1, 1, '#e07a5f');
      px(x + 1, y + 3, 2, 1, '#e07a5f');
      dot(x, y + 1, '#f6c3a8');
    };
    const ring = (x: number, y: number) => {
      px(x + 1, y, 2, 1, '#2f8f78');
      px(x + 1, y + 3, 2, 1, '#2f8f78');
      px(x, y + 1, 1, 2, '#2f8f78');
      px(x + 3, y + 1, 1, 2, '#2f8f78');
    };
    heart(10, 3);
    heart(18, 11);
    heart(26, 19);
    ring(18, 3);
    ring(10, 19);
  },
  fence: (px) => {
    px(0, 0, W, H, '#3f6337');
    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 5; c++) px(3 + c * 7, 3 + r * 7, 6, 6, '#4f7a43');
    // a closed bed or two with flowers
    const bed = (x: number, y: number, petal: string) => {
      px(x, y, 6, 6, '#5b3d2a');
      px(x + 2, y + 1, 2, 4, petal);
      px(x + 1, y + 2, 4, 2, petal);
      px(x + 2, y + 2, 2, 2, '#fff4c2');
    };
    bed(10, 3, '#ffc94a');
    bed(17, 10, '#7fe0c0');
    bed(24, 10, '#ffc94a');
    // fences around them
    px(9, 2, 9, 1, '#c89a5c');
    px(9, 9, 23, 1, '#c89a5c');
    px(16, 16, 16, 1, '#c89a5c');
    px(9, 2, 1, 8, '#c89a5c');
    px(16, 2, 1, 15, '#c89a5c');
    px(23, 9, 1, 8, '#c89a5c');
    px(30, 9, 1, 8, '#c89a5c');
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) px(2 + c * 7, 2 + r * 7, 1, 1, '#7a5232');
  },
  lanterns: (px) => {
    px(0, 0, W, H, '#0c1c25');
    px(4, 1, 32, 24, '#16303d');
    const lan = (x: number, y: number, c: string, glow: string) => {
      px(x - 1, y, 4, 2, glow);
      px(x, y - 1, 2, 4, glow);
      px(x, y, 2, 2, c);
    };
    const A = ['#ffd76a', '#b8741f'];
    const B = ['#bff5e3', '#2f8f78'];
    [
      [12, 6, A],
      [16, 6, B],
      [20, 6, B],
      [24, 6, A],
      [12, 11, B],
      [16, 11, A],
      [20, 11, A],
      [24, 11, B],
      [16, 16, A],
      [20, 16, B],
      [8, 16, A],
      [28, 19, B],
    ].forEach(([x, y, c]) => lan(x as number, y as number, (c as string[])[0], (c as string[])[1]));
  },
  tug: (px) => {
    px(0, 0, W, H, '#8fb8c9');
    px(0, 10, W, H - 10, '#4f7a43');
    px(0, 10, W, 1, '#3f6337');
    px(4, 12, 1, 12, '#efe3cb');
    px(35, 12, 1, 12, '#efe3cb');
    px(2, 17, 36, 2, '#c89a5c');
    px(2, 17, 36, 1, '#e2bf84');
    px(17, 14, 3, 7, '#c4453f');
    px(17, 14, 1, 7, '#e07a5f');
    // two little pullers
    px(0, 13, 3, 3, '#f0c9a0');
    px(0, 16, 3, 5, '#6f9a7a');
    px(37, 13, 3, 3, '#c99470');
    px(37, 16, 3, 5, '#b8674f');
    px(6, 4, 4, 2, '#f4ead6');
    px(28, 3, 6, 2, '#f4ead6');
  },
  quickdraw: (px, dot) => {
    px(0, 0, W, H, '#1b1518');
    [[4, 4], [33, 6], [8, 20], [30, 21], [36, 13]].forEach(([x, y]) => dot(x, y, '#5c5468'));
    // a lit lantern, glowing
    px(14, 4, 12, 18, '#3a2f22');
    px(16, 3, 8, 1, '#8a6a36');
    px(19, 1, 2, 2, '#8a6a36');
    px(15, 6, 10, 14, '#e2a33a');
    px(16, 7, 8, 12, '#ffd76a');
    px(17, 8, 2, 3, '#fffbe6');
    px(16, 21, 8, 1, '#8a6a36');
    px(11, 12, 2, 1, '#ffd76a');
    px(27, 12, 2, 1, '#ffd76a');
    px(19, 23, 2, 2, '#ffd76a');
  },
  rps: (px) => {
    px(0, 0, W, H, '#3a2b25');
    // stone
    px(3, 10, 8, 7, '#9a929e');
    px(4, 9, 6, 1, '#9a929e');
    px(4, 17, 6, 1, '#5c5560');
    px(5, 11, 2, 1, '#d6cfd8');
    // paper
    px(15, 7, 9, 11, '#f4ead6');
    px(16, 9, 6, 1, '#c9b896');
    px(16, 12, 6, 1, '#c9b896');
    px(16, 15, 6, 1, '#c9b896');
    // scissors
    for (let k = 0; k < 5; k++) {
      px(28 + k, 7 + k, 1, 1, '#c8d3d8');
      px(36 - k, 7 + k, 1, 1, '#c8d3d8');
    }
    px(29, 13, 3, 3, '#e07a5f');
    px(33, 13, 3, 3, '#e07a5f');
    px(30, 14, 1, 1, '#3a2b25');
    px(34, 14, 1, 1, '#3a2b25');
  },
  kitchen: (px) => {
    for (let y = 0; y < H; y += 4) for (let x = 0; x < W; x += 4) px(x, y, 4, 4, (x + y) % 8 === 0 ? '#efdcb8' : '#d2bb93');
    px(10, 12, 20, 11, '#3a3336');
    px(8, 12, 24, 2, '#4e4649');
    px(6, 14, 3, 2, '#3a3336');
    px(31, 14, 3, 2, '#3a3336');
    for (const x of [14, 19, 24]) {
      px(x, 8, 1, 3, '#f4ead6');
      px(x + 1, 5, 1, 3, '#f4ead6');
    }
    px(12, 17, 16, 1, '#c4453f');
  },
};

export const BoxArt: React.FC<{ id: BoxId; scale?: number; dim?: boolean }> = ({ id, scale = 4, dim }) => (
  <PixelArt w={W} h={H} scale={scale} paint={PAINT[id]} deps={[id]} style={dim ? { filter: 'saturate(0.35) brightness(0.8)' } : undefined} />
);
