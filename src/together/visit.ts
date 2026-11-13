import { addDays, todayKey } from '../letters/engine';

/**
 * The next time you'll be together: a day you both count down to (and where, or what for), kept in the
 * place's `meta/visit` document. Either of you can set it or change it; once the day's been, it's gone and
 * you can set the next one.
 */

export const VISIT_WHAT_MAX = 30;

export interface VisitDoc {
  /** the day (YYYY-MM-DD), or '' for none set */
  date: string;
  /** where, or what for: "Goa", "the wedding" */
  what: string;
  /** who set it, and when (ms) */
  by: string;
  at: number;
}

const isKey = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function normalizeVisit(raw: unknown): VisitDoc {
  const r = raw && typeof raw === 'object' ? (raw as Partial<Record<keyof VisitDoc, unknown>>) : {};
  return {
    date: isKey(r.date) ? r.date : '',
    what: typeof r.what === 'string' ? r.what.slice(0, VISIT_WHAT_MAX).trim() : '',
    by: typeof r.by === 'string' ? r.by : '',
    at: typeof r.at === 'number' ? r.at : 0,
  };
}

const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** days from today to the day (null: none set, or it's been) */
export function daysLeft(v: VisitDoc, today: string): number | null {
  if (!v.date) return null;
  const n = dayNumber(v.date) - dayNumber(today);
  return n >= 0 ? n : null;
}

/** "12 days until Goa", "Tomorrow: Goa", "Together today" (null when there's nothing to count down to) */
export function visitLine(v: VisitDoc, today: string): string | null {
  const n = daysLeft(v, today);
  if (n === null) return null;
  if (n === 0) return v.what ? `Today: ${v.what}` : 'Together today';
  if (n === 1) return v.what ? `Tomorrow: ${v.what}` : 'Together tomorrow';
  return v.what ? `${n} days until ${v.what}` : `${n} days until you’re together`;
}

/** the demo room: Goa, in twelve days */
export function demoVisit(): VisitDoc {
  return { date: addDays(todayKey(), 12), what: 'Goa', by: 'user-rohan', at: Date.now() - 26 * 3600e3 };
}
