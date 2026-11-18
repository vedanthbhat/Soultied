/**
 * Keeping a song from YouTube at the shared spot, without making it stutter.
 *
 * Both of you hear the song from the same start time, so each player checks every second and a half where it
 * is against where the song should be. Every nudge (a seek) makes YouTube fetch again, and on a slow line that
 * fetch is itself what put it behind: nudging at the first sign of drift turned a hiccup into a song that kept
 * breaking up. So it lets a song be a few seconds out, only nudges once it's stayed out for more than one check,
 * and leaves it alone for a while after a nudge or after YouTube has had to catch up.
 *
 * The iPhone app's player (native/Soultied/RecordPlayer.swift, SongPlayer) does the same in its own page.
 */

/** how far apart (seconds) a song can be from the shared spot before it's nudged back */
export const SONG_DRIFT = 5;
/** ...on this many checks in a row (not a moment's hiccup) */
export const SONG_CHECKS = 2;
/** after a nudge, or after YouTube stopped to catch up, it's left alone this long (ms) */
export const SONG_SETTLE_MS = 12000;

/** YouTube's player states */
const PLAYING = 1;
const BUFFERING = 3;

export interface SongSync {
  /** checks in a row it's been too far out */
  off: number;
  /** no nudging before this (ms) */
  calmUntil: number;
}

export const songSync = (): SongSync => ({ off: 0, calmUntil: 0 });

/** what to do with the player now: leave it, pause it, nudge it to the shared spot, or start it (there) */
export type SongStep = 'leave' | 'pause' | 'seek' | 'play' | 'seekPlay';

/**
 * One check. `state` is YouTube's player state, `cur` where the player is, `at` where the song should be
 * (seconds), `want` whether it should be playing on this screen. Updates `s`.
 */
export function songStep(s: SongSync, state: number, cur: number, at: number, now: number, want: boolean): SongStep {
  if (!want) {
    s.off = 0;
    return state === PLAYING || state === BUFFERING ? 'pause' : 'leave';
  }
  if (state === PLAYING) {
    if (now < s.calmUntil) {
      s.off = 0;
      return 'leave';
    }
    if (Math.abs(cur - at) <= SONG_DRIFT) {
      s.off = 0;
      return 'leave';
    }
    if (++s.off < SONG_CHECKS) return 'leave';
    s.off = 0;
    s.calmUntil = now + SONG_SETTLE_MS;
    return 'seek';
  }
  if (state === BUFFERING) {
    // catching up: let it, and give it time once it's going again
    s.off = 0;
    s.calmUntil = now + SONG_SETTLE_MS;
    return 'leave';
  }
  // not started yet, or stopped by something else (a call, Siri, another app): on again, from the shared spot
  // if it's far from it
  s.off = 0;
  s.calmUntil = now + SONG_SETTLE_MS;
  return Math.abs(cur - at) > SONG_DRIFT ? 'seekPlay' : 'play';
}

/** YouTube had to stop and fetch: no nudging for a while after it gets going again */
export function songStalled(s: SongSync, now: number) {
  s.off = 0;
  s.calmUntil = now + SONG_SETTLE_MS;
}
