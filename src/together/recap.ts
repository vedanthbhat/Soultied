/**
 * Your month together: the days you both showed up (and your longest run of them), the letters you opened
 * together and how in sync you were, and what you pinned to the wall. Worked out from what's already kept;
 * the caller gives each thing's day on its own calendar, so this never has to think about time zones.
 */

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface RecapInput {
  /** the days you were both here (couch) */
  together: string[];
  /** each daily letter: its day, whether you opened it together, and how many answers matched of how many */
  letters: Array<{ day: string; opened: boolean; same: number; total: number }>;
  /** the days of the photos and notes you pinned up (doodles are notes too) */
  photos: string[];
  notes: Array<{ day: string; doodle: boolean }>;
}

export interface Recap {
  /** YYYY-MM */
  month: string;
  /** "November 2026" */
  label: string;
  days: number;
  bestStreak: number;
  letters: number;
  /** answers that matched, as a percentage (null if none to compare) */
  sync: number | null;
  photos: number;
  doodles: number;
  notes: number;
}

const dayNumber = (key: string) => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** the month a recap's about: the one just gone in its first three days, else this one so far */
export function recapMonth(today: string): { month: string; done: boolean } {
  const [y, m, d] = today.split('-').map(Number);
  if (d <= 3) {
    const py = m === 1 ? y - 1 : y;
    const pm = m === 1 ? 12 : m - 1;
    return { month: `${py}-${String(pm).padStart(2, '0')}`, done: true };
  }
  return { month: today.slice(0, 7), done: false };
}

export function monthRecap(input: RecapInput, month: string): Recap {
  const inMonth = (day: string) => day.slice(0, 7) === month;
  const days = [...new Set(input.together.filter(inMonth))].map(dayNumber).sort((a, b) => a - b);
  let bestStreak = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
  }
  const letters = input.letters.filter((l) => l.opened && inMonth(l.day));
  const same = letters.reduce((a, l) => a + l.same, 0);
  const total = letters.reduce((a, l) => a + l.total, 0);
  const notes = input.notes.filter((n) => inMonth(n.day));
  const [y, m] = month.split('-').map(Number);
  return {
    month,
    label: `${MONTH_NAMES[m - 1]} ${y}`,
    days: days.length,
    bestStreak,
    letters: letters.length,
    sync: total ? Math.round((same / total) * 100) : null,
    photos: input.photos.filter(inMonth).length,
    doodles: notes.filter((n) => n.doodle).length,
    notes: notes.filter((n) => !n.doodle).length,
  };
}
