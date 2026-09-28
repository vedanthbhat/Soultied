import type { ColorId, GlyphId } from './glyphs';
import type { Scene } from './scene';

/**
 * Escape rooms behind the dark door. Each room is split in two: side A and
 * side B, one per partner, each holding half of the clues. Puzzles are solved
 * in order; `step` is how many are solved so far.
 */

export type Side = 'a' | 'b';
export type RoomId = 'attic' | 'cellar' | 'office' | 'library';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** What you see when you look closely at something. */
export type Clue =
  | { kind: 'note'; title: string; text: string; sign?: string }
  | { kind: 'glyphs'; title: string; text?: string; glyphs: GlyphId[] }
  | { kind: 'colors'; title: string; text?: string; colors: ColorId[]; style: 'stripes' | 'notes' | 'panes' }
  | { kind: 'pattern'; title: string; text?: string; rows: string[] }
  | { kind: 'letters'; title: string; text?: string; letters: Array<[number, string | null]> }
  | { kind: 'cards'; title: string; text?: string; cards: Array<{ name: string; lines: string[] }> };

/** The different kinds of lock a puzzle can have. */
export type Lock =
  | { kind: 'digits'; length: number }
  | { kind: 'letters'; length: number }
  | { kind: 'glyphs'; slots: number; set: GlyphId[] }
  | { kind: 'sequence'; length: number; colors: ColorId[]; noun: string }
  | { kind: 'switches'; count: number }
  | { kind: 'clock'; minuteStep: number }
  | { kind: 'grid'; size: number }
  | { kind: 'choice'; options: Array<{ id: string; label: string; lines?: string[] }> }
  | { kind: 'map'; cols: number; cells: string[]; start: number }
  | { kind: 'together'; label: string; holdMs: number };

export interface Puzzle {
  id: string;
  /** whose side the lock is on ('both' for things you do together) */
  side: Side | 'both';
  title: string;
  prompt: string;
  lock: Lock;
  /**
   * The solution, written the way `answerOf` writes a guess:
   * digits "318", letters "HOME", lists "anchor,rose,moon,heart",
   * switches "UDDU", clock "9:15", grid rows ".##./####", choice id, map cell index.
   */
  answer: string;
  /** gentle → specific → the answer itself */
  hints: [string, string, string];
  /** told to both of you when it opens */
  solved: string;
}

export interface ObjectView {
  /** shown once this many puzzles are solved */
  from: number;
  clue?: Clue;
  /** clicking opens this puzzle when it's the current one */
  puzzle?: string;
  /** plain line of text, e.g. "The lid won't budge yet." */
  text?: string;
}

export interface SceneObject {
  id: string;
  side: Side;
  label: string;
  rect: Rect;
  /** hidden until this many puzzles are solved */
  from?: number;
  views: ObjectView[];
}

export interface RoomDef {
  id: RoomId;
  title: string;
  tagline: string;
  mood: string;
  /** door colour in the corridor */
  accent: string;
  minutes: number;
  intro: string;
  sides: Record<Side, { name: string; blurb: string }>;
  objects: SceneObject[];
  puzzles: Puzzle[];
  ending: { title: string; text: string };
  /** paint one side of the room at native resolution */
  draw: (s: Scene, side: Side, step: number, t: number) => void;
}

/** The view of an object right now, or null if it isn't there yet. */
export function viewOf(o: SceneObject, step: number): ObjectView | null {
  if ((o.from ?? 0) > step) return null;
  let v: ObjectView | null = null;
  for (const x of o.views) if (x.from <= step) v = x;
  return v;
}

export function normalise(lock: Lock, raw: string) {
  const s = raw.trim();
  if (lock.kind === 'letters' || lock.kind === 'switches') return s.toUpperCase();
  return s.toLowerCase();
}

export function isRight(p: Puzzle, guess: string) {
  return normalise(p.lock, guess) === normalise(p.lock, p.answer);
}
