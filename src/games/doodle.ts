import type { Seat } from './types';

/**
 * Doodle Guess: one of you draws on a little pixel canvas, the other guesses,
 * then you swap. It's played together, live, and scored together: how many of
 * the six drawings you got between you.
 */

export const DW = 40;
export const DH = 30;
export const ROUNDS = 6;
export const DRAW_SECONDS = 80;

/** '.' is blank paper; the rest are ink colours. */
export const INKS: Record<string, string> = {
  k: '#2b1e1c',
  r: '#b8674f',
  y: '#e2b359',
  g: '#6f8f4e',
  b: '#5a79a3',
  p: '#e8a39a',
  n: '#8a5a3c',
  w: '#fbf6ea',
};
export const PAPER = '#f4e8d0';
export const blankCanvas = () => '.'.repeat(DW * DH);

export type DoodlePhase = 'lobby' | 'choosing' | 'drawing' | 'reveal';

export interface DoodleGuess {
  by: Seat;
  text: string;
  right: boolean;
  /** nearly: a letter or two off */
  close?: boolean;
}

export interface DoodleRound {
  word: string;
  drawer: Seat;
  /** seconds it took to guess, or null if time ran out */
  secs: number | null;
  /** the finished drawing, for the look back at the end */
  pixels?: string;
}

export interface DoodleState {
  phase: DoodlePhase;
  /** who has said they're here (the lobby waits for both) */
  joined: Partial<Record<Seat, boolean>>;
  round: number;
  drawer: Seat;
  choices: string[];
  word: string | null;
  startedAt: number | null;
  endsAt: number | null;
  guesses: DoodleGuess[];
  rounds: DoodleRound[];
  /** most drawings you've ever guessed in one game */
  best: number;
}

/* ---------- words ---------- */

export const WORDS = [
  'airport', 'suitcase', 'train', 'postcard', 'envelope', 'phone', 'coffee', 'pizza', 'popcorn', 'couch', 'fireplace', 'moon',
  'sunset', 'beach', 'mountain', 'rain', 'umbrella', 'bicycle', 'guitar', 'cake', 'cat', 'dog', 'fish', 'tree', 'flower', 'house',
  'car', 'boat', 'plane', 'star', 'rainbow', 'snowman', 'balloon', 'book', 'glasses', 'hat', 'shoe', 'key', 'clock', 'lamp',
  'candle', 'ice cream', 'banana', 'apple', 'cherry', 'mushroom', 'cactus', 'penguin', 'rabbit', 'owl', 'snail', 'turtle', 'whale',
  'bee', 'butterfly', 'spider', 'crown', 'ring', 'kite', 'rocket', 'robot', 'ghost', 'dragon', 'castle', 'bridge', 'tent',
  'campfire', 'volcano', 'island', 'lighthouse', 'window', 'bed', 'pillow', 'toothbrush', 'scissors', 'pencil', 'gift', 'camera',
  'headphones', 'television', 'teapot', 'sandwich', 'noodles', 'burger', 'donut', 'cookie', 'watermelon', 'strawberry', 'carrot',
  'egg', 'cheese', 'bread', 'sun', 'cloud', 'snowflake', 'lightning', 'leaf', 'moustache', 'crab', 'octopus', 'frog', 'duck',
  'elephant', 'giraffe', 'snake', 'mouse', 'pig', 'cow', 'horse', 'bat', 'hammer', 'ladder', 'bucket', 'basket', 'broom', 'sock',
  'dress', 'backpack', 'map', 'compass', 'anchor', 'sailboat', 'bus', 'tractor', 'wheel', 'drum', 'piano', 'trophy', 'medal',
  'pyramid', 'tower', 'fence', 'swing', 'slide', 'bone', 'tooth', 'eye', 'hand', 'nose', 'ear', 'crayon', 'paint', 'magnet',
];

export function pickChoices(rng = Math.random, avoid: string[] = []): string[] {
  const pool = WORDS.filter((w) => !avoid.includes(w));
  const out: string[] = [];
  while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  return out;
}

/* ---------- guessing ---------- */

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z ]/g, '')
    .replace(/\b(a|an|the)\b/g, '')
    .replace(/\s+/g, '');

function distance(a: string, b: string) {
  const d = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0];
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length];
}

/** 'right' for the word (plurals and a typo in longer words count), 'close' when nearly there. */
export function judge(guess: string, word: string): 'right' | 'close' | 'wrong' {
  const g = norm(guess);
  const w = norm(word);
  if (!g) return 'wrong';
  if (g === w || g === `${w}s` || g === `${w}es` || `${g}s` === w) return 'right';
  const d = distance(g, w);
  if (w.length >= 5 && d <= 1) return 'right';
  if (d <= 2 || (g.length >= 3 && (w.includes(g) || g.includes(w)))) return 'close';
  return 'wrong';
}

/** "_ _ _   _ _ _ _" — the shape of the word, for the person guessing. */
export const wordShape = (word: string) =>
  word
    .split('')
    .map((ch) => (ch === ' ' ? '   ' : '_'))
    .join(' ');

/* ---------- ink ---------- */

/** Paint these cells (a '.' colour rubs out). */
export function paint(pixels: string, cells: number[], color: string) {
  if (!cells.length) return pixels;
  const a = pixels.split('');
  for (const c of cells) if (c >= 0 && c < a.length) a[c] = color;
  return a.join('');
}

/** Every cell on the line between two cells, with a round brush of this size. */
export function brushLine(x0: number, y0: number, x1: number, y1: number, size: number): number[] {
  const out = new Set<number>();
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  const r = size - 1;
  for (let s = 0; s <= steps; s++) {
    const x = Math.round(x0 + ((x1 - x0) * s) / steps);
    const y = Math.round(y0 + ((y1 - y0) * s) / steps);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r + (r ? 0.5 : 0)) continue;
        const cx = x + dx;
        const cy = y + dy;
        if (cx >= 0 && cy >= 0 && cx < DW && cy < DH) out.add(cy * DW + cx);
      }
  }
  return [...out];
}

/** Cells packed small for sending: base-36, joined with commas. */
export const packCells = (cells: number[]) => cells.map((c) => c.toString(36)).join(',');
export const unpackCells = (s: string) => (s ? s.split(',').map((c) => parseInt(c, 36)) : []);

/** The cells a paint bucket fills from `start`: every touching cell of the same colour. */
export function fillCells(pixels: string, start: number): number[] {
  const want = pixels[start];
  if (want === undefined) return [];
  const seen = new Uint8Array(DW * DH);
  const out: number[] = [];
  const stack = [start];
  while (stack.length) {
    const c = stack.pop() as number;
    if (seen[c] || pixels[c] !== want) continue;
    seen[c] = 1;
    out.push(c);
    const x = c % DW;
    if (x > 0) stack.push(c - 1);
    if (x < DW - 1) stack.push(c + 1);
    if (c >= DW) stack.push(c - DW);
    if (c < DW * (DH - 1)) stack.push(c + DW);
  }
  return out;
}

/**
 * Ink sent live while drawing. `n` counts up through a round, so whoever is
 * watching can lay batches over the last saved copy of the canvas in order.
 */
export interface InkOp {
  /** colour key, '.' to rub out */
  c: string;
  /** packed cells, or '*' for the whole page (clear) */
  s: string;
}
export interface DoodleInk {
  by: string;
  at: number;
  mid: string;
  r: number;
  n: number;
  ops: InkOp[];
}

/** The drawing as saved every few seconds (so someone arriving late sees it all). */
export interface DoodleCanvas {
  mid: string;
  r: number;
  n: number;
  pixels: string;
}

export function applyOps(pixels: string, ops: InkOp[]): string {
  let p = pixels;
  for (const op of ops) p = op.s === '*' ? op.c.repeat(DW * DH) : paint(p, unpackCells(op.s), op.c);
  return p;
}

/* ---------- the demo room's partner ---------- */

/** A few little drawings the pretend partner knows how to make, as ASCII (colour keys as above). */
export const BOT_DOODLES: Record<string, string[]> = {
  sun: [
    '....y....y....',
    '.....y..y.....',
    'y....yyyy....y',
    '.y..yyyyyy..y.',
    '...yyyyyyyy...',
    'yyyyyyyyyyyyyy',
    '...yyyyyyyy...',
    '.y..yyyyyy..y.',
    'y....yyyy....y',
    '.....y..y.....',
    '....y....y....',
  ],
  house: [
    '......rr......',
    '.....rrrr.....',
    '....rrrrrr....',
    '...rrrrrrrr...',
    '..rrrrrrrrrr..',
    '.rrrrrrrrrrrr.',
    '..nnnnnnnnnn..',
    '..nbbnnnnbbn..',
    '..nbbnnnnbbn..',
    '..nnnnkknnnn..',
    '..nnnnkknnnn..',
    '..nnnnkknnnn..',
  ],
  tree: [
    '.....ggg......',
    '...ggggggg....',
    '..ggggggggg...',
    '.ggggggggggg..',
    '..ggggggggg...',
    '...ggggggg....',
    '.....nnn......',
    '.....nnn......',
    '.....nnn......',
    '....nnnnn.....',
  ],
  fish: [
    '..............',
    '....bbbbb.....',
    '..bbbbbbbbb..b',
    '.bbkbbbbbbbbbb',
    '.bbbbbbbbbbbbb',
    '..bbbbbbbbb..b',
    '....bbbbb.....',
  ],
  moon: [
    '....yyyy......',
    '..yyyy........',
    '.yyyy.........',
    '.yyy..........',
    'yyyy..........',
    'yyyy..........',
    '.yyy..........',
    '.yyyy.........',
    '..yyyy........',
    '....yyyy......',
  ],
  cup: [
    '...k..k..k....',
    '....k..k..k...',
    '..............',
    '.rrrrrrrrrr...',
    '.rrrrrrrrrrrr.',
    '.rrrrrrrrrr.r.',
    '.rrrrrrrrrr.r.',
    '.rrrrrrrrrrr..',
    '..rrrrrrrr....',
    'kkkkkkkkkkkk..',
  ],
};
export const BOT_WORDS: Record<string, string> = { sun: 'sun', house: 'house', tree: 'tree', fish: 'fish', moon: 'moon', cup: 'coffee' };

/** The pretend partner's drawing of `key`, centred, as a list of (cell, colour). */
export function botStrokes(key: string): Array<[number, string]> {
  const art = BOT_DOODLES[key] || BOT_DOODLES.sun;
  const scale = 2;
  const w = art[0].length * scale;
  const h = art.length * scale;
  const ox = Math.floor((DW - w) / 2);
  const oy = Math.floor((DH - h) / 2);
  const out: Array<[number, string]> = [];
  art.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '.') return;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) out.push([(oy + y * scale + sy) * DW + ox + x * scale + sx, ch]);
    })
  );
  return out;
}
