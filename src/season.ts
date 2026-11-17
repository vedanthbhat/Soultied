/**
 * Christmas: from 1 December to 6 January (each person's own calendar), the room gets a tree where the plant
 * was, fairy lights and two stockings on the mantel, a wreath on the dark door and snow outside, and the app's
 * terracotta and sage turn Christmas red and pine. Anyone can turn it off, just for their own screen. The iPhone's
 * Season.swift.
 */

export function christmasSeason(today: string): boolean {
  const m = Number(today.slice(5, 7));
  const d = Number(today.slice(8, 10));
  return m === 12 || (m === 1 && d >= 1 && d <= 6);
}

const KEY = 'soultied_christmas';

/** turned off on this browser */
export function christmasOff(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off';
  } catch {
    return false;
  }
}

export function setChristmasOff(off: boolean) {
  try {
    if (off) localStorage.setItem(KEY, 'off');
    else localStorage.removeItem(KEY);
  } catch {
    // (it just won't be remembered)
  }
}

/** ?christmas in the address shows it out of season (for trying it, and the screenshots) */
export const christmasForced = () => typeof location !== 'undefined' && new URLSearchParams(location.search).has('christmas');
