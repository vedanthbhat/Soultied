/**
 * Our list: the things you want to do together, some day or the next time you're together. Kept in the place's
 * `meta/bucket` document, by item: what it is, who added it and when, whether it's for next time, and when it
 * was done (and by whom ticked off). Either of you can add, star, tick or take things off.
 */

export const BUCKET_TEXT_MAX = 80;
/** how many things the list keeps (the oldest done ones go first) */
export const BUCKET_MAX = 200;

export interface BucketItem {
  id: string;
  text: string;
  by: string;
  at: number;
  /** for the next time you're together */
  next: boolean;
  /** when it was done (ms), or 0 */
  done: number;
  doneBy: string;
}

export interface BucketDoc {
  items: Record<string, BucketItem>;
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** what's typed: one line, trimmed, no longer than it should be */
export const cleanText = (s: string) => Array.from(s.replace(/\s+/g, ' ').trim()).slice(0, BUCKET_TEXT_MAX).join('').trim();

export function normalizeBucket(raw: unknown): BucketDoc {
  const r = raw && typeof raw === 'object' ? (raw as { items?: unknown }) : {};
  const items: BucketDoc['items'] = {};
  if (r.items && typeof r.items === 'object')
    for (const [id, v] of Object.entries(r.items as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const e = v as Record<string, unknown>;
      const text = cleanText(str(e.text));
      if (!text) continue;
      items[id] = { id, text, by: str(e.by), at: num(e.at), next: e.next === true, done: num(e.done), doneBy: str(e.doneBy) };
    }
  return { items };
}

/** the list as it shows: what's still to do (next time's first, then the newest), and what's done (latest first) */
export function bucketView(doc: BucketDoc): { todo: BucketItem[]; done: BucketItem[] } {
  const all = Object.values(doc.items);
  const byId = (a: BucketItem, b: BucketItem) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const todo = all.filter((i) => !i.done).sort((a, b) => Number(b.next) - Number(a.next) || b.at - a.at || byId(a, b));
  const done = all.filter((i) => i.done).sort((a, b) => b.done - a.done || byId(a, b));
  return { todo, done };
}

/** the ones to take off so the list keeps to BUCKET_MAX (the oldest done ones, then the oldest still to do) */
export function bucketOverflow(doc: BucketDoc): string[] {
  const { todo, done } = bucketView(doc);
  const extra = todo.length + done.length - BUCKET_MAX;
  if (extra <= 0) return [];
  const oldest = [...done.slice().reverse(), ...todo.slice().reverse()];
  return oldest.slice(0, extra).map((i) => i.id);
}

/** "3 things planned for Goa", "1 thing planned for next time" (null when there's nothing starred) */
export function plannedLine(doc: BucketDoc, where: string): string | null {
  const n = Object.values(doc.items).filter((i) => i.next && !i.done).length;
  if (!n) return null;
  return `${n} ${n === 1 ? 'thing' : 'things'} planned for ${where || 'next time'}`;
}

/** things to do, when you're stuck: some for together, some from afar */
export const BUCKET_IDEAS: string[] = [
  'Watch a sunrise together',
  'Cook each other’s favourite dish',
  'Take a train somewhere neither of us has been',
  'Slow-dance in the kitchen',
  'Find the best coffee in your city',
  'Have a picnic with too much food',
  'Go stargazing away from the city lights',
  'Visit the place you grew up',
  'Squeeze into a photo booth',
  'Spend a whole day with our phones off',
  'See a film in an old cinema',
  'Build a blanket fort and nap in it',
  'Order a dish neither of us can pronounce',
  'Walk somewhere new without a map',
  'Re-create our first date',
  'Go to a live gig and sing too loud',
  'Plant something and keep it alive',
  'Swim in the sea at night',
  'Get caught in the rain on purpose',
  'Take a cooking class together',
  'Finish an escape room together',
  'Watch a whole series in sync',
  'Fall asleep on a call',
  'Send each other a song every day for a week',
  'Cook the same recipe at the same time',
  'Write each other a letter on paper and post it',
  'Read the same book and talk about it',
  'Draw each other from memory',
  'Plan a trip down to the last day',
  'Learn ten words of each other’s favourite language',
];

/** the demo room: Aanya and Rohan's list */
export function demoBucket(): BucketDoc {
  const now = Date.now();
  const day = 86400e3;
  const it = (id: string, text: string, by: string, ago: number, next = false, doneAgo = 0, doneBy = ''): BucketItem => ({
    id,
    text,
    by,
    at: now - ago * day,
    next,
    done: doneAgo ? now - doneAgo * day : 0,
    doneBy,
  });
  return {
    items: {
      'wish-demo-1': it('wish-demo-1', 'Watch the sunrise from the beach', 'user-rohan', 9, true),
      'wish-demo-2': it('wish-demo-2', 'Eat at the shack with the fairy lights', 'user-aanya', 6, true),
      'wish-demo-3': it('wish-demo-3', 'Rent a scooter and get a bit lost', 'user-rohan', 3, true),
      'wish-demo-4': it('wish-demo-4', 'Read the same book and talk about it', 'user-aanya', 20),
      'wish-demo-5': it('wish-demo-5', 'Finish an escape room together', 'user-aanya', 30, false, 4, 'user-rohan'),
      'wish-demo-6': it('wish-demo-6', 'Fall asleep on a call', 'user-rohan', 45, false, 12, 'user-aanya'),
    },
  };
}
