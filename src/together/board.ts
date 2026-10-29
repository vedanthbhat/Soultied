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
  last: Record<string, { at: number; kind: 'text' | 'doodle' | 'photo' }>;
  /** when each of you last looked at the wall (your own clock) */
  seen: Record<string, number>;
  art: WallArt | null;
}

export function normalizeBoard(raw: unknown): BoardDoc {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const last: BoardDoc['last'] = {};
  if (r.last && typeof r.last === 'object')
    for (const [uid, v] of Object.entries(r.last as Record<string, unknown>)) {
      const x = v as { at?: unknown; kind?: unknown } | null;
      if (x && typeof x.at === 'number') last[uid] = { at: x.at, kind: x.kind === 'doodle' ? 'doodle' : x.kind === 'photo' ? 'photo' : 'text' };
    }
  const seen: Record<string, number> = {};
  if (r.seen && typeof r.seen === 'object') for (const [uid, at] of Object.entries(r.seen as Record<string, unknown>)) if (typeof at === 'number') seen[uid] = at;
  return { last, seen, art: normalizeArt(r.art) };
}

/* ---------- doodles ---------- */

export const DOODLE_W = 48;
export const DOODLE_H = 36;
/** index 0 is the paper; the rest are the pens */
export const DOODLE_PAL = [
  '#fbf3e2', '#3a2a26', '#fffaf0', '#c4453f', '#ef8f88', '#e07b39', '#d99a2b', '#f2d66b',
  '#7a9a5a', '#4f7a45', '#7fb2d9', '#4f6fb0', '#9a86c8', '#8a5a3c', '#f0c8a0', '#8d8a99',
];
export const blankDoodle = () => '0'.repeat(DOODLE_W * DOODLE_H);
export const isDoodle = (v: unknown): v is string => typeof v === 'string' && v.length === DOODLE_W * DOODLE_H && /^[0-9a-f]+$/.test(v);

/** a doodle, halved, for the frame: each 2×2 block takes its most-used ink (the paper only if it's all paper) */
export function doodleArt(px: string, ref: string, by: string): WallArt {
  let out = '';
  for (let y = 0; y < ART_H; y++)
    for (let x = 0; x < ART_W; x++) {
      const n = new Map<string, number>();
      for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const c = px[(y * 2 + dy) * DOODLE_W + x * 2 + dx];
        if (c !== '0') n.set(c, (n.get(c) || 0) + 1);
      }
      let best = '0';
      let most = 0;
      for (const [c, k] of n) if (k > most) [best, most] = [c, k];
      out += best;
    }
  return { w: ART_W, h: ART_H, pal: DOODLE_PAL, px: out, kind: 'doodle', ref, by, at: Date.now() };
}

/** a little doodle drawn from rows of characters (for the demo room's wall) */
function sketch(rows: string[], key: Record<string, number>, ox: number, oy: number) {
  const a = blankDoodle().split('');
  rows.forEach((row, j) =>
    [...row].forEach((ch, i) => {
      const k = key[ch];
      if (k != null && oy + j < DOODLE_H && ox + i < DOODLE_W) a[(oy + j) * DOODLE_W + ox + i] = k.toString(16);
    })
  );
  return a.join('');
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
  };
}

