import type { ColorId } from './glyphs';
import type { HotspotId } from '../pixel/room';

/** Tiny chiptune sound effects made on the fly (no audio files). */

let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem('soultied_sfx_muted') === '1';
  } catch {
    return false;
  }
})();

function audio() {
  if (muted) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function tone(freq: number, dur: number, when = 0, type: OscillatorType = 'square', vol = 0.04) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

/** A note that glides from one pitch to another (a creak, a whoosh). */
export function slide(from: number, to: number, dur: number, when = 0, type: OscillatorType = 'triangle', vol = 0.03) {
  const a = audio();
  if (!a) return;
  const t0 = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(from, t0);
  o.frequency.exponentialRampToValueAtTime(to, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(a.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

const NOTE: Record<ColorId, number> = { red: 523, gold: 659, blue: 784, green: 880, white: 1047, violet: 1175 };

export const sfx = {
  tick: () => tone(1400, 0.03, 0, 'square', 0.02),
  note: (c: ColorId) => tone(NOTE[c], 0.25, 0, 'triangle', 0.06),
  wrong: () => {
    tone(180, 0.12, 0, 'sawtooth', 0.03);
    tone(140, 0.16, 0.1, 'sawtooth', 0.03);
  },
  open: () => [523, 659, 784].forEach((f, i) => tone(f, 0.18, i * 0.09, 'triangle', 0.05)),
  win: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.22, i * 0.12, 'triangle', 0.06)),
  melody: (cs: ColorId[]) => cs.forEach((c, i) => tone(NOTE[c], 0.3, i * 0.28, 'triangle', 0.06)),
  isMuted: () => muted,
  setMuted(m: boolean) {
    muted = m;
    try {
      localStorage.setItem('soultied_sfx_muted', m ? '1' : '0');
    } catch {
      // ignore
    }
  },
};

/**
 * One small, quiet sound for each thing you can touch in the living room. Made on the fly, in the same
 * chiptune family as the games, and switched off along with them (the Sound switch in the menu).
 * Nothing plays on hover: only when you actually press something.
 */

const SOFT = 0.022;

const SOUNDS: Record<HotspotId, () => void> = {
  // sinking into a cushion
  left: () => {
    tone(392, 0.09, 0, 'triangle', SOFT);
    tone(523, 0.12, 0.07, 'triangle', SOFT);
  },
  right: () => {
    tone(440, 0.09, 0, 'triangle', SOFT);
    tone(587, 0.12, 0.07, 'triangle', SOFT);
  },
  // an envelope opening
  letter: () => {
    tone(1047, 0.06, 0, 'triangle', SOFT);
    tone(1319, 0.1, 0.05, 'triangle', SOFT * 0.9);
  },
  // a few crackles from the fire
  fire: () => {
    [0, 0.06, 0.15, 0.21].forEach((w, i) => tone(1700 + ((i * 433) % 900), 0.018, w, 'square', SOFT * 0.45));
    tone(110, 0.18, 0, 'triangle', SOFT);
  },
  // a camera click
  photo: () => {
    tone(1600, 0.02, 0, 'square', SOFT * 0.6);
    tone(900, 0.04, 0.03, 'square', SOFT * 0.5);
  },
  // the TV coming on
  remote: () => {
    tone(880, 0.05, 0, 'square', SOFT * 0.6);
    tone(1320, 0.08, 0.05, 'square', SOFT * 0.5);
  },
  // the old door, creaking
  door: () => slide(210, 140, 0.32, 0, 'triangle', SOFT),
  // the games cupboard
  games: () => {
    tone(659, 0.07, 0, 'triangle', SOFT);
    tone(784, 0.11, 0.07, 'triangle', SOFT);
  },
  // the needle touching the record (the music itself is the record player's own)
  music: () => tone(1200, 0.02, 0, 'square', SOFT * 0.5),
  // a note being unpinned from the wall
  board: () => {
    tone(988, 0.05, 0, 'triangle', SOFT);
    tone(740, 0.08, 0.05, 'triangle', SOFT * 0.8);
  },
  // a little sparkle
  decor: () => {
    tone(1319, 0.06, 0, 'triangle', SOFT * 0.8);
    tone(1568, 0.09, 0.05, 'triangle', SOFT * 0.8);
  },
};

export function roomSound(id: HotspotId) {
  try {
    SOUNDS[id]?.();
  } catch {
    // no sound is fine
  }
}
