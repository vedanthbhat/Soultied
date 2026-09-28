/**
 * The couch: every day you BOTH open Soultied, your characters scoot a little
 * closer on the couch. It takes seven such days to go from the two ends to
 * sitting side by side. Missed days never push you apart.
 *
 * Kept as plain data so the backend can store the same shape later.
 */

export const COUCH_STEPS = 7;

export interface CouchState {
  /** the last local day each person opened the app */
  seen: Record<string, string>;
  /** every day you were both here, oldest first */
  together: string[];
  /** the closeness each person has already watched happen (so each of you sees the scoot once) */
  shown: Record<string, number>;
}

export const emptyCouch = (): CouchState => ({ seen: {}, together: [], shown: {} });

export function normalizeCouch(c: unknown): CouchState {
  const x = (c && typeof c === 'object' ? c : {}) as Partial<CouchState>;
  return {
    seen: x.seen && typeof x.seen === 'object' ? x.seen : {},
    together: Array.isArray(x.together) ? x.together.filter((d) => typeof d === 'string') : [],
    shown: x.shown && typeof x.shown === 'object' ? x.shown : {},
  };
}

/** Record that `me` showed up today; if the partner already did too, that's a day together. */
export function checkIn(c: CouchState, me: string, partner: string | null, today: string): CouchState {
  const both = !!partner && c.seen[partner] === today;
  const already = c.together.includes(today);
  if (c.seen[me] === today && (!both || already)) return c;
  return {
    ...c,
    seen: { ...c.seen, [me]: today },
    together: both && !already ? [...c.together, today] : c.together,
  };
}

/** 0 = the two ends of the couch, COUCH_STEPS = side by side. */
export const couchLevel = (c: CouchState) => Math.min(COUCH_STEPS, c.together.length);

export function couchLine(level: number, partnerName: string) {
  if (level >= COUCH_STEPS) return `Side by side with ${partnerName}. Keep showing up and stay cosy.`;
  const left = COUCH_STEPS - level;
  return `${left} more ${left === 1 ? 'day' : 'days'} of you both showing up and you’ll be sitting side by side.`;
}
