import type { ColorId } from './glyphs';

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

function tone(freq: number, dur: number, when = 0, type: OscillatorType = 'square', vol = 0.04) {
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
