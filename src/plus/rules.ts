import type { GameKind } from '../games/types';
import type { RoomId } from '../escape/types';

/**
 * Soultied Plus (native/SoultiedCore/Sources/SoultiedCore/Place/Plus.swift says the same for the iPhone app).
 * One of you having it covers you both.
 *   Free: daily letters, YouTube together, three Netflix / Prime Video nights a month, five quick games,
 *         the first escape room, and decorating with stitches.
 *   Plus: every Netflix / Prime Video night, cameras, voice and karaoke, every game and escape room,
 *         After dark's Hot cards, and bonus stitches every month.
 */

/** the games anyone can play; the rest come with Plus */
export const FREE_GAMES: ReadonlySet<GameKind> = new Set<GameKind>(['rps', 'tug', 'quickdraw', 'doodle', 'fireflies']);
/** the escape room anyone can play */
export const FREE_ROOMS: ReadonlySet<RoomId> = new Set<RoomId>(['attic']);
/** Netflix / Prime Video nights a month without Plus */
export const FREE_NIGHTS = 3;
/** stitches a place with Plus gets each month */
export const BONUS_STITCHES = 150;

/** "2026-11" from "2026-11-11" */
export const monthOf = (dateKey: string) => dateKey.slice(0, 7);
/** what the monthly stitches are kept under in meta/decor's `earned` ("plus-2026-11") */
export const bonusKey = (dateKey: string) => `plus-${monthOf(dateKey)}`;

/** meta/plus: the Netflix and Prime Video nights you've had, by month */
export interface PlusDoc {
  nights: Record<string, Record<string, boolean>>;
}

export const normalizePlusDoc = (raw: unknown): PlusDoc => {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { nights?: unknown };
  const nights: PlusDoc['nights'] = {};
  if (r.nights && typeof r.nights === 'object') {
    for (const [m, v] of Object.entries(r.nights as Record<string, unknown>)) {
      if (!v || typeof v !== 'object') continue;
      nights[m] = {};
      for (const [d, on] of Object.entries(v as Record<string, unknown>)) if (on === true) nights[m][d] = true;
    }
  }
  return { nights };
};

export interface NightCheck {
  /** you can start (or carry on with) tonight's */
  ok: boolean;
  /** free nights left this month (tonight's already counted if it's had) */
  left: number;
  /** tonight's already one of them */
  already: boolean;
}

/** Whether tonight can be a Netflix / Prime Video night: with Plus always; without, if it's already one or nights are left. */
export function nightCheck(doc: PlusDoc, today: string, plus: boolean): NightCheck {
  const had = doc.nights[monthOf(today)] || {};
  const already = !!had[today];
  const left = Math.max(0, FREE_NIGHTS - Object.keys(had).length);
  return { ok: plus || already || left > 0, left, already };
}

/** what Plus adds, a line each (the paywall cards and the Plus page) */
export const PERKS: Array<{ title: string; line: string }> = [
  { title: 'Every movie night', line: 'Netflix and Prime Video together as often as you like (three nights a month are free).' },
  { title: 'See and hear each other', line: 'Cameras, voice and karaoke night, on the website and the extension.' },
  { title: 'Every game and escape room', line: 'Coasters, Kitchen Rush, Paper Boats and the rest, and all four rooms behind the dark door.' },
  { title: 'After dark, hot', line: 'The bolder After dark cards, for when you’ve both picked Hot.' },
  { title: 'Stitches every month', line: `${BONUS_STITCHES} bonus stitches to decorate with, on the first visit each month.` },
];
