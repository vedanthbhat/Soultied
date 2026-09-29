import React from 'react';
import { PixelArt, Painter } from './Pixel';

/** The picture on each game box, drawn in the room's pixel style (40 x 26). */

export type BoxId = 'fireflies' | 'boats' | 'door' | 'doodle' | 'coasters' | 'kitchen';

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
