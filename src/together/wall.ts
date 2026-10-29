/**
 * Our wall: the notes and doodles you pin up for each other, your photos, and the memories you keep.
 *
 *   meta/board         who pinned something last, what each of you has seen, and the picture in the
 *                      frame over the couch (small: the room reads it all the time)
 *   meta/note-…        one note or doodle each
 *   meta/photo-…       one photo each: a small copy for the wall, and its caption
 *   meta/photobig-…    the same photo, big, read only when you open it
 *   meta/memories      the memories you write down (a title, a day, a few words, maybe a photo)
 *
 * Nothing here is ever deleted outright (the database doesn't allow it): taking something down
 * marks it gone.
 */

import { ART_H, ART_W, DEMO_DOODLE, type WallArt, isDoodle } from './board';

export * from './board';

/* ---------- notes ---------- */

export type NoteKind = 'text' | 'doodle';
export const NOTE_PAPERS = ['#f6e39a', '#f4c2bd', '#cfe3b8', '#c4dcef', '#ddd0ef'] as const;
export const NOTE_MAX = 280;

export interface Note {
  id: string;
  by: string;
  kind: NoteKind;
  text: string;
  /** 48 × 36, one hex digit a pixel (see DOODLE_PAL) */
  doodle: string;
  paper: number;
  at: number;
  /** who's put a heart on it */
  loved: Record<string, number>;
  /** kept with your memories */
  kept: boolean;
  gone: boolean;
}

export function normalizeNote(id: string, raw: unknown): Note | null {
  if (!raw || typeof raw !== 'object') return null;
  const n = raw as Partial<Note> & { gone?: unknown };
  if (typeof n.by !== 'string') return null;
  const kind: NoteKind = n.kind === 'doodle' ? 'doodle' : 'text';
  const text = typeof n.text === 'string' ? n.text.slice(0, NOTE_MAX) : '';
  const doodle = isDoodle(n.doodle) ? n.doodle : '';
  if (kind === 'text' ? !text.trim() : !doodle) return null;
  const loved: Record<string, number> = {};
  if (n.loved && typeof n.loved === 'object') for (const [uid, at] of Object.entries(n.loved)) if (typeof at === 'number') loved[uid] = at;
  return {
    id,
    by: n.by,
    kind,
    text,
    doodle,
    paper: Math.max(0, Math.min(NOTE_PAPERS.length - 1, Number(n.paper) || 0)),
    at: Number(n.at) || 0,
    loved,
    kept: !!n.kept,
    gone: !!n.gone,
  };
}

/* ---------- photos ---------- */

export const CAPTION_MAX = 120;

export interface Photo {
  id: string;
  by: string;
  caption: string;
  /** a small JPEG (data URL) for the wall */
  thumb: string;
  w: number;
  h: number;
  at: number;
  /** the day it was taken, if you said (YYYY-MM-DD) */
  day: string;
  kept: boolean;
  gone: boolean;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePhoto(id: string, raw: unknown): Photo | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Partial<Photo>;
  if (typeof p.by !== 'string' || typeof p.thumb !== 'string' || !p.thumb.startsWith('data:image/')) return null;
  return {
    id,
    by: p.by,
    caption: typeof p.caption === 'string' ? p.caption.slice(0, CAPTION_MAX) : '',
    thumb: p.thumb,
    w: Number(p.w) || 4,
    h: Number(p.h) || 3,
    at: Number(p.at) || 0,
    day: typeof p.day === 'string' && DAY.test(p.day) ? p.day : '',
    kept: p.kept !== false,
    gone: !!p.gone,
  };
}

/** the big copy's document for a photo */
export const bigName = (photoId: string) => photoId.replace(/^photo-/, 'photobig-');

function readImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That picture wouldn’t open. Try a JPEG or PNG.'));
    };
    img.src = url;
  });
}

function scaled(img: HTMLImageElement, max: number, quality: number) {
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k));
  const h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, w, h);
  return { url: c.toDataURL('image/jpeg', quality), w, h };
}

/** A photo, made small enough to keep: a big copy (well under the database's 1 MB a document) and a little one. */
export async function preparePhoto(file: Blob) {
  const img = await readImage(file);
  try {
    let big = scaled(img, 1280, 0.8);
    if (big.url.length > 700_000) big = scaled(img, 1024, 0.7);
    if (big.url.length > 700_000) big = scaled(img, 800, 0.6);
    const thumb = scaled(img, 360, 0.72);
    return { big: big.url, thumb: thumb.url, w: big.w, h: big.h, art: photoArt(img) };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

/** A photo as a little pixel picture for the frame: the middle 4:3 of it, 24 × 18, in 12 colours. */
export function photoArt(img: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number }): Omit<WallArt, 'ref' | 'by' | 'at'> {
  const iw = (img.naturalWidth || img.width || 4) as number;
  const ih = (img.naturalHeight || img.height || 3) as number;
  const want = ART_W / ART_H;
  let sw = iw;
  let sh = ih;
  if (iw / ih > want) sw = ih * want;
  else sh = iw / want;
  const c = document.createElement('canvas');
  c.width = ART_W;
  c.height = ART_H;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, ART_W, ART_H);
  const data = g.getImageData(0, 0, ART_W, ART_H).data;
  const pts: number[][] = [];
  for (let i = 0; i < data.length; i += 4) pts.push([data[i], data[i + 1], data[i + 2]]);
  // a dozen colours, found by k-means (seeded across the brightness range)
  const K = 12;
  const lum = (p: number[]) => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11;
  const sorted = [...pts].sort((a, b) => lum(a) - lum(b));
  let cents = Array.from({ length: K }, (_, k) => [...sorted[Math.floor(((k + 0.5) / K) * sorted.length)]]);
  const near = (p: number[]) => {
    let best = 0;
    let bd = Infinity;
    cents.forEach((c2, k) => {
      const d = (p[0] - c2[0]) ** 2 + (p[1] - c2[1]) ** 2 + (p[2] - c2[2]) ** 2;
      if (d < bd) [best, bd] = [k, d];
    });
    return best;
  };
  for (let it = 0; it < 8; it++) {
    const sum = cents.map(() => [0, 0, 0, 0]);
    for (const p of pts) {
      const k = near(p);
      sum[k][0] += p[0];
      sum[k][1] += p[1];
      sum[k][2] += p[2];
      sum[k][3]++;
    }
    cents = cents.map((c2, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c2));
  }
  const px = pts.map((p) => near(p).toString(16)).join('');
  const pal = cents.map((c2) => '#' + c2.map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''));
  return { w: ART_W, h: ART_H, pal, px, kind: 'photo' };
}

/* ---------- memories ---------- */

export const MEMORY_TITLE_MAX = 80;
export const MEMORY_TEXT_MAX = 500;

export interface Memory {
  id: string;
  by: string;
  title: string;
  /** the day it happened, YYYY-MM-DD */
  day: string;
  text: string;
  /** a photo from your wall to go with it */
  photo: string;
  at: number;
}

export interface MemoriesDoc {
  items: Record<string, Memory>;
}

export function normalizeMemories(raw: unknown): MemoriesDoc {
  const items: Record<string, Memory> = {};
  const src = raw && typeof raw === 'object' ? ((raw as { items?: unknown }).items as Record<string, unknown>) : null;
  if (src && typeof src === 'object')
    for (const [id, v] of Object.entries(src)) {
      if (!v || typeof v !== 'object') continue;
      const m = v as Partial<Memory>;
      const title = typeof m.title === 'string' ? m.title.slice(0, MEMORY_TITLE_MAX).trim() : '';
      if (!title || typeof m.by !== 'string' || typeof m.day !== 'string' || !DAY.test(m.day)) continue;
      items[id] = {
        id,
        by: m.by,
        title,
        day: m.day,
        text: typeof m.text === 'string' ? m.text.slice(0, MEMORY_TEXT_MAX) : '',
        photo: typeof m.photo === 'string' ? m.photo : '',
        at: Number(m.at) || 0,
      };
    }
  return { items };
}

/* ---------- the demo room ---------- */

export function demoNotes(): Record<string, unknown> {
  const now = Date.now();
  return {
    'note-demo-0': { by: 'user-aanya', kind: 'text', text: 'Left you a playlist for the train. Track 4 is us.', paper: 1, at: now - 2 * 86400e3, loved: { 'user-rohan': now - 2 * 86400e3 + 600e3 }, kept: false },
    'note-demo-1': { by: 'user-rohan', kind: 'text', text: 'Twelve days. I’ve started packing in my head.', paper: 0, at: now - 26 * 3600e3, loved: {}, kept: true },
    'note-demo-2': { by: 'user-rohan', kind: 'doodle', doodle: DEMO_DOODLE, paper: 0, at: now - 3 * 3600e3, loved: {}, kept: false },
  };
}

export function demoMemories(): MemoriesDoc {
  return {
    items: {
      'mem-demo-0': { id: 'mem-demo-0', by: 'user-aanya', title: 'First date: the bookshop café', day: '2023-02-11', text: 'You spilled the hot chocolate and laughed so hard the owner gave us cookies.', photo: '', at: 0 },
      'mem-demo-1': { id: 'mem-demo-1', by: 'user-rohan', title: 'The rainy city trip', day: '2024-07-19', text: 'Two umbrellas, one of them broken. Best weekend.', photo: '', at: 0 },
    },
  };
}
