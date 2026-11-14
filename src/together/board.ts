/**
 * The small part of our wall the room reads all the time: who pinned something last, what each of you
 * has seen, and the picture in the frame over the couch (`meta/board`). The rest is in wall.ts.
 */

/* ---------- the picture in the frame over the couch ---------- */

/** a tiny picture: w × h pixels, each one a character indexing `pal` ('.' is the frame's own paper) */
export interface WallArt {
  w: number;
  h: number;
  pal: string[];
  px: string;
  kind: 'doodle' | 'photo';
  /** the note or photo it came from */
  ref: string;
  by: string;
  at: number;
}

export const ART_W = 24;
export const ART_H = 18;

const HEX = /^#[0-9a-f]{6}$/i;

export function normalizeArt(raw: unknown): WallArt | null {
  if (!raw || typeof raw !== 'object') return null;
  const a = raw as Partial<WallArt>;
  if (a.w !== ART_W || a.h !== ART_H || typeof a.px !== 'string' || a.px.length !== ART_W * ART_H) return null;
  const pal = Array.isArray(a.pal) ? a.pal.filter((c): c is string => typeof c === 'string' && HEX.test(c)).slice(0, 16) : [];
  if (!pal.length) return null;
  return { w: ART_W, h: ART_H, pal, px: a.px, kind: a.kind === 'photo' ? 'photo' : 'doodle', ref: String(a.ref || ''), by: String(a.by || ''), at: Number(a.at) || 0 };
}

export interface BoardDoc {
  /** when each of you last pinned something up */
  last: Record<string, { at: number; kind: 'text' | 'doodle' | 'photo' | 'voice' }>;
  /** when each of you last looked at the wall (your own clock) */
  seen: Record<string, number>;
  art: WallArt | null;
  /** the last doodle each of you pinned up (for your person's home-screen widget, which reads just this and that note) */
  drew: Record<string, { id: string; at: number }>;
}

export function normalizeBoard(raw: unknown): BoardDoc {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const last: BoardDoc['last'] = {};
  if (r.last && typeof r.last === 'object')
    for (const [uid, v] of Object.entries(r.last as Record<string, unknown>)) {
      const x = v as { at?: unknown; kind?: unknown } | null;
      if (x && typeof x.at === 'number') last[uid] = { at: x.at, kind: x.kind === 'doodle' ? 'doodle' : x.kind === 'photo' ? 'photo' : x.kind === 'voice' ? 'voice' : 'text' };
    }
  const seen: Record<string, number> = {};
  if (r.seen && typeof r.seen === 'object') for (const [uid, at] of Object.entries(r.seen as Record<string, unknown>)) if (typeof at === 'number') seen[uid] = at;
  const drew: BoardDoc['drew'] = {};
  if (r.drew && typeof r.drew === 'object')
    for (const [uid, v] of Object.entries(r.drew as Record<string, unknown>)) {
      const x = v as { id?: unknown; at?: unknown } | null;
      if (x && typeof x.id === 'string' && typeof x.at === 'number') drew[uid] = { id: x.id, at: x.at };
    }
  return { last, seen, art: normalizeArt(r.art), drew };
}

/* ---------- doodles ---------- */

/** a doodle is 96 × 72, one hex digit a pixel. (The first ones were 48 × 36: they're still read, each pixel drawn 2 × 2.) */
export const DOODLE_W = 96;
export const DOODLE_H = 72;
export const OLD_DOODLE_W = 48;
export const OLD_DOODLE_H = 36;
/** index 0 is the paper; the rest are the pens */
export const DOODLE_PAL = [
  '#fbf3e2', '#3a2a26', '#fffaf0', '#c4453f', '#ef8f88', '#e07b39', '#d99a2b', '#f2d66b',
  '#7a9a5a', '#4f7a45', '#7fb2d9', '#4f6fb0', '#9a86c8', '#8a5a3c', '#f0c8a0', '#8d8a99',
];
export const blankDoodle = () => '0'.repeat(DOODLE_W * DOODLE_H);
const hexOnly = (v: string) => /^[0-9a-f]+$/.test(v);
/** today's size, or the first, smaller one */
export const isDoodle = (v: unknown): v is string =>
  typeof v === 'string' && (v.length === DOODLE_W * DOODLE_H || v.length === OLD_DOODLE_W * OLD_DOODLE_H) && hexOnly(v);

/** any doodle at today's size (each pixel of an old, small one made 2 × 2) */
export function fullDoodle(px: string): string {
  if (px.length === DOODLE_W * DOODLE_H) return px;
  let out = '';
  for (let y = 0; y < DOODLE_H; y++) {
    const row = px.slice((y >> 1) * OLD_DOODLE_W, ((y >> 1) + 1) * OLD_DOODLE_W);
    for (let x = 0; x < DOODLE_W; x++) out += row[x >> 1] || '0';
  }
  return out;
}

/** shrunk by a whole number: each f × f block takes its most-used ink (the paper only if it's all paper), so a fine line survives */
function shrink(px: string, w: number, f: number): string {
  const h = Math.floor(px.length / w);
  let out = '';
  for (let y = 0; y < Math.floor(h / f); y++)
    for (let x = 0; x < Math.floor(w / f); x++) {
      const n = new Map<string, number>();
      for (let dy = 0; dy < f; dy++)
        for (let dx = 0; dx < f; dx++) {
          const c = px[(y * f + dy) * w + x * f + dx];
          if (c !== '0') n.set(c, (n.get(c) || 0) + 1);
        }
      let best = '0';
      let most = 0;
      for (const [c, k] of n) if (k > most) [best, most] = [c, k];
      out += best;
    }
  return out;
}

/** a doodle at the first, smaller size (what's kept in `doodle`, for an app from before; today's apps read `hd`) */
export const smallDoodle = (px: string) => shrink(fullDoodle(px), DOODLE_W, DOODLE_W / OLD_DOODLE_W);

/** a doodle, shrunk for the frame over the couch */
export function doodleArt(px: string, ref: string, by: string): WallArt {
  return { w: ART_W, h: ART_H, pal: DOODLE_PAL, px: shrink(fullDoodle(px), DOODLE_W, DOODLE_W / ART_W), kind: 'doodle', ref, by, at: Date.now() };
}

/** a little doodle drawn from rows of characters (for the demo room's wall) */
function sketch(rows: string[], key: Record<string, number>, ox: number, oy: number) {
  // (drawn on the first, smaller paper, then made today's size)
  const a = '0'.repeat(OLD_DOODLE_W * OLD_DOODLE_H).split('');
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      const k = key[ch];
      if (k != null && oy + j < OLD_DOODLE_H && ox + i < OLD_DOODLE_W) a[(oy + j) * OLD_DOODLE_W + ox + i] = k.toString(16);
    })
  );
  return fullDoodle(a.join(''));
}

/** Rohan's doodle in the demo: a cup of tea and a heart, with steam. */
export const DEMO_DOODLE = sketch(
  [
    '.......s....s..........................',
    '........s....s.........................',
    '.......s....s..........rr...rr.........',
    '........s....s........rrrr.rrrr........',
    '.....................rrrrrrrrrrr.......',
    '...bbbbbbbbbbbbbb....rrrrrrrrrrr.......',
    '...bccccccccccccbbb...rrrrrrrrr........',
    '...bccccccccccccb..b...rrrrrrr.........',
    '...bccccccccccccb..b....rrrrr..........',
    '...bccccccccccccb..b.....rrr...........',
    '...bccccccccccccbbb.......r............',
    '...bccccccccccccb......................',
    '....bccccccccccb.......................',
    '.....bbbbbbbbbb........................',
    '..pppppppppppppppp.....................',
  ],
  { s: 15, b: 13, c: 14, r: 3, p: 1 },
  4,
  9
);

export function demoBoard(): BoardDoc {
  const now = Date.now();
  return {
    last: { 'user-rohan': { at: now - 3 * 3600e3, kind: 'doodle' } },
    seen: {},
    art: doodleArt(DEMO_DOODLE, 'note-demo-2', 'user-rohan'),
    drew: { 'user-rohan': { id: 'note-demo-2', at: now - 3 * 3600e3 } },
  };
}

