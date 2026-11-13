/**
 * Holding the couch: you each press and hold, and while you're both holding, the two of you sit side by side
 * in the room (and phones beat softly like a heart). Kept in the place's `meta/hold` document: while you hold,
 * your entry beats about once a second; letting go says so. Whether your person is still holding is judged by
 * when their last beat arrived here, not by their clock (computers' clocks differ).
 */

/** a beat goes out this often while you hold; their hold counts for this long after their last beat arrives */
export const HOLD_BEAT_MS = 1000;
export const HOLD_STALE_MS = 3000;
/** a beat whose own time is further off than this is one left over from before */
export const HOLD_SKEW_MS = 20_000;

export interface HoldEntry {
  holding: boolean;
  /** when the beat went out (their clock, ms) */
  beat: number;
}

export interface HoldDoc {
  by: Record<string, HoldEntry>;
}

export function normalizeHold(raw: unknown): HoldDoc {
  const r = raw && typeof raw === 'object' ? (raw as { by?: unknown }) : {};
  const by: Record<string, HoldEntry> = {};
  if (r.by && typeof r.by === 'object')
    for (const [uid, v] of Object.entries(r.by as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      const e = v as Partial<HoldEntry>;
      by[uid] = { holding: e.holding === true, beat: typeof e.beat === 'number' ? e.beat : 0 };
    }
  return { by };
}

/** someone's holding now: their entry says so, their last beat arrived here lately, and it isn't an old one */
export const isHolding = (e: HoldEntry | undefined, seen: number, now = Date.now()) =>
  !!e && e.holding && now - seen < HOLD_STALE_MS && Math.abs(now - e.beat) < HOLD_SKEW_MS;

export const demoHold = (): HoldDoc => ({ by: {} });
