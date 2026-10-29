/**
 * How each of you is feeling (a little bubble over your head in the room), and the touches you send
 * each other: a hug, a kiss, a high five. Kept in the place's `meta/moods` and `meta/touch` documents.
 */

/** A tiny pixel picture: '.' is see-through, every other letter is a colour from `pal`. */
export interface Glyph {
  rows: string[];
  pal: Record<string, string>;
}

export type MoodId = 'cozy' | 'happy' | 'loved' | 'missing' | 'sleepy' | 'busy' | 'stressed' | 'low' | 'excited' | 'hungry' | 'unwell' | 'playful';

export interface MoodDef extends Glyph {
  id: MoodId;
  label: string;
  /** after a name: "Rohan is …" */
  phrase: string;
}

export const MOODS: MoodDef[] = [
  {
    id: 'cozy',
    label: 'Cozy',
    phrase: 'feeling cozy',
    rows: ['.s..s..', '..s..s.', '#####..', '#ccc###', '#ccc#.#', '#ccc###', '.###...'],
    pal: { s: '#c9b9a0', '#': '#8a5a3c', c: '#e8c9a0' },
  },
  {
    id: 'happy',
    label: 'Happy',
    phrase: 'happy',
    rows: ['y..y..y', '.yyyyy.', '.yoooy.', 'yyoooyy', '.yoooy.', '.yyyyy.', 'y..y..y'],
    pal: { y: '#d99a2b', o: '#f6dc7a' },
  },
  {
    id: 'loved',
    label: 'Loved up',
    phrase: 'loved up',
    rows: ['.##.##.', '#h#####', '#######', '.#####.', '..###..', '...#...'],
    pal: { '#': '#d9534f', h: '#f3a19c' },
  },
  {
    id: 'missing',
    label: 'Missing you',
    phrase: 'missing you',
    rows: ['.##.##.', '#..#..#', '#.....#', '.#...#.', '..#.#..', '...#...'],
    pal: { '#': '#d9534f' },
  },
  {
    id: 'sleepy',
    label: 'Sleepy',
    phrase: 'sleepy',
    rows: ['..mmmm.', '.mmm...', 'mmm....', 'mmm..s.', 'mmm....', '.mmm...', '..mmmm.'],
    pal: { m: '#8f86b8', s: '#d99a2b' },
  },
  {
    id: 'busy',
    label: 'Busy',
    phrase: 'busy',
    rows: ['.#####.', '#ooooo#', '#oohoo#', '#oohho#', '#ooooo#', '#ooooo#', '.#####.'],
    pal: { '#': '#5c6f8a', o: '#e6edf5', h: '#3a2a26' },
  },
  {
    id: 'stressed',
    label: 'Stressed',
    phrase: 'stressed',
    rows: ['..ggg..', '.ggggg.', 'ggggggg', '.ggggg.', '...y...', '..yy...', '..y....'],
    pal: { g: '#7d7a8c', y: '#d99a2b' },
  },
  {
    id: 'low',
    label: 'A bit low',
    phrase: 'a bit low',
    rows: ['..ggg..', '.ggggg.', 'ggggggg', '.......', '.b..b..', '..b..b.', '.b..b..'],
    pal: { g: '#8d96a8', b: '#4f86c6' },
  },
  {
    id: 'excited',
    label: 'Excited',
    phrase: 'excited',
    rows: ['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', '.y...y.'],
    pal: { y: '#d99a2b' },
  },
  {
    id: 'hungry',
    label: 'Hungry',
    phrase: 'hungry',
    rows: ['ccccccc', '.yyryy.', '.yyyyy.', '..ryy..', '..yyy..', '...y...'],
    pal: { c: '#a8693a', y: '#e9b949', r: '#c4453f' },
  },
  {
    id: 'unwell',
    label: 'Under the weather',
    phrase: 'under the weather',
    rows: ['..ooo..', '..oro..', '..oro..', '..oro..', '.orrro.', '.orrro.', '..ooo..'],
    pal: { o: '#6a5a52', r: '#c4453f' },
  },
  {
    id: 'playful',
    label: 'Playful',
    phrase: 'feeling playful',
    rows: ['ooooooo', 'opfffpo', 'offfffo', 'offpffo', 'offfffo', 'opfffpo', 'ooooooo'],
    pal: { o: '#7a5a8a', f: '#f4e8d0', p: '#3a2a26' },
  },
];

const MOOD_BY = Object.fromEntries(MOODS.map((m) => [m.id, m])) as Record<MoodId, MoodDef>;
export const moodDef = (id: MoodId | null | undefined) => (id ? MOOD_BY[id] || null : null);

/** a few words of your own and no picture: a little "…" */
export const WORDS_GLYPH: Glyph = { rows: ['.....', 'o.o.o', '.....'], pal: { o: '#3a2a26' } };

export const MOOD_TEXT_MAX = 40;
/** a mood shows for a day, then quietly goes */
export const MOOD_TTL = 24 * 3600e3;

export interface MoodEntry {
  mood: MoodId | null;
  text: string;
  at: number;
}

export interface MoodsDoc {
  by: Record<string, MoodEntry>;
  /** the time of your person's mood when you last saw it (their clock) */
  seen: Record<string, number>;
}

const isMood = (v: unknown): v is MoodId => typeof v === 'string' && v in MOOD_BY;

export function normalizeMoods(raw: unknown): MoodsDoc {
  const r = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof MoodsDoc, unknown>>) : {};
  const by: Record<string, MoodEntry> = {};
  if (r.by && typeof r.by === 'object')
    for (const [uid, v] of Object.entries(r.by as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const e = v as Partial<MoodEntry>;
      const mood = isMood(e.mood) ? e.mood : null;
      const text = typeof e.text === 'string' ? e.text.slice(0, MOOD_TEXT_MAX).trim() : '';
      if (!mood && !text) continue;
      by[uid] = { mood, text, at: typeof e.at === 'number' ? e.at : 0 };
    }
  const seen: Record<string, number> = {};
  if (r.seen && typeof r.seen === 'object') for (const [uid, at] of Object.entries(r.seen as Record<string, unknown>)) if (typeof at === 'number') seen[uid] = at;
  return { by, seen };
}

/** someone's mood right now (nothing once it's a day old) */
export function currentMood(doc: MoodsDoc, uid: string | null | undefined, now = Date.now()): MoodEntry | null {
  const e = uid ? doc.by[uid] : null;
  return e && now - e.at < MOOD_TTL ? e : null;
}

/** "missing you · counting the days" */
export function moodLine(e: MoodEntry | null) {
  if (!e) return '';
  const p = moodDef(e.mood)?.phrase;
  return [p, e.text && `“${e.text}”`].filter(Boolean).join(' · ');
}

export const moodGlyph = (e: MoodEntry | null): Glyph | null => (e ? moodDef(e.mood) || WORDS_GLYPH : null);

export function demoMoods(): MoodsDoc {
  return { by: { 'user-rohan': { mood: 'missing', text: 'counting the days', at: Date.now() - 2 * 3600e3 } }, seen: {} };
}

/* ---------------------------------------------------------------------------------------------- */

export type TouchKind = 'hug' | 'kiss' | 'forehead' | 'highfive' | 'hands' | 'boop';

export interface TouchDef extends Glyph {
  id: TouchKind;
  /** the button */
  label: string;
  /** "Rohan hugged you" */
  did: string;
  /** "a hug", for "While you were away, Rohan sent a hug and two kisses" */
  one: string;
  many: string;
  /** they slide together on the couch for it */
  together: boolean;
}

export const TOUCHES: TouchDef[] = [
  {
    id: 'hug',
    label: 'Hug',
    did: 'hugged you',
    one: 'a hug',
    many: 'hugs',
    together: true,
    rows: ['.##.##.', '#h#####', '#######', '.#####.', '..###..', '...#...'],
    pal: { '#': '#d9534f', h: '#f3a19c' },
  },
  {
    id: 'kiss',
    label: 'Kiss',
    did: 'kissed you',
    one: 'a kiss',
    many: 'kisses',
    together: true,
    rows: ['.rr.rr.', 'rpprppr', 'rrrrrrr', '.rpppr.', '..rrr..'],
    pal: { r: '#c4453f', p: '#ef8f88' },
  },
  {
    id: 'forehead',
    label: 'Forehead kiss',
    did: 'kissed your forehead',
    one: 'a forehead kiss',
    many: 'forehead kisses',
    together: true,
    rows: ['..#.#..', '.#####.', '..###..', '...#...'],
    pal: { '#': '#e0858a' },
  },
  {
    id: 'highfive',
    label: 'High five',
    did: 'high-fived you',
    one: 'a high five',
    many: 'high fives',
    together: true,
    rows: ['y..y..y', '.y.y.y.', '..yyy..', 'yyywyyy', '..yyy..', '.y.y.y.', 'y..y..y'],
    pal: { y: '#d99a2b', w: '#fff1c9' },
  },
  {
    id: 'hands',
    label: 'Hold hands',
    did: 'is holding your hand',
    one: 'a hand to hold',
    many: 'hand-holds',
    together: true,
    rows: ['.rr.RR.', 'r..R..R', 'r..r..R', '.rr.RR.'],
    pal: { r: '#c4453f', R: '#e0685f' },
  },
  {
    id: 'boop',
    label: 'Boop',
    did: 'booped your nose',
    one: 'a boop',
    many: 'boops',
    together: false,
    rows: ['..y..', '..y..', '..y..', '.....', '..y..'],
    pal: { y: '#d99a2b' },
  },
];

const TOUCH_BY = Object.fromEntries(TOUCHES.map((t) => [t.id, t])) as Record<TouchKind, TouchDef>;
export const touchDef = (k: TouchKind) => TOUCH_BY[k];
const isTouch = (v: unknown): v is TouchKind => typeof v === 'string' && v in TOUCH_BY;

export interface Touch {
  id: string;
  by: string;
  kind: TouchKind;
  at: number;
}

export interface TouchDoc {
  items: Record<string, Touch>;
  /** the time of the newest touch from your person you've seen (their clock) */
  seen: Record<string, number>;
}

/** only the most recent ones are kept */
export const TOUCH_KEEP = 40;

export function normalizeTouch(raw: unknown): TouchDoc {
  const r = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof TouchDoc, unknown>>) : {};
  const items: Record<string, Touch> = {};
  if (r.items && typeof r.items === 'object')
    for (const [id, v] of Object.entries(r.items as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const x = v as Partial<Touch>;
      if (typeof x.by !== 'string' || !isTouch(x.kind)) continue;
      items[id] = { id, by: x.by, kind: x.kind, at: typeof x.at === 'number' ? x.at : 0 };
    }
  const seen: Record<string, number> = {};
  if (r.seen && typeof r.seen === 'object') for (const [uid, at] of Object.entries(r.seen as Record<string, unknown>)) if (typeof at === 'number') seen[uid] = at;
  return { items, seen };
}

/** touches from your person you haven't seen yet, newest first */
export function unseenTouches(doc: TouchDoc, me: string, them: string | null): Touch[] {
  if (!them) return [];
  const since = doc.seen[me] ?? 0;
  return Object.values(doc.items)
    .filter((t) => t.by === them && t.at > since)
    .sort((a, b) => b.at - a.at);
}

/** the ids to drop so that, with one more, there are at most TOUCH_KEEP */
export function touchesToDrop(doc: TouchDoc): string[] {
  const all = Object.values(doc.items).sort((a, b) => a.at - b.at);
  return all.slice(0, Math.max(0, all.length - (TOUCH_KEEP - 1))).map((t) => t.id);
}

const NUMBERS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (n: number) => NUMBERS[n] || String(n);

/** "a hug", or "two hugs and a kiss" */
export function touchSummary(list: Touch[]) {
  const by = new Map<TouchKind, number>();
  for (const t of list) by.set(t.kind, (by.get(t.kind) || 0) + 1);
  const parts = [...by.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => (n === 1 ? touchDef(k).one : `${count(n)} ${touchDef(k).many}`));
  return parts.length <= 1 ? parts[0] || '' : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export const demoTouch = (): TouchDoc => ({ items: {}, seen: {} });
