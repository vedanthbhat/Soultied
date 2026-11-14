/**
 * Voice notes: up to a minute of you, left on the wall for your person. Each is its own `meta/voice-…`
 * document: who, when, how long, the recording itself (AAC in an MP4 box, base64, which every browser and the
 * iPhone can play), a little picture of its loudness (one digit per bar), and when each of you first heard it.
 */

export const VOICE_MAX_SECS = 60;
/** the recording, base64 (about 300 KB: a minute at 32 kbit/s, with room to spare) */
export const VOICE_MAX_CHARS = 420_000;
export const VOICE_BARS = 24;
/** what gets recorded (and what the iPhone can play) */
export const VOICE_MIMES = ['audio/mp4', 'audio/aac', 'audio/x-m4a', 'audio/m4a'];

export interface Voice {
  id: string;
  by: string;
  at: number;
  /** seconds, to a tenth */
  secs: number;
  mime: string;
  /** base64 */
  audio: string;
  /** loudness, 0–9 per bar */
  peaks: number[];
  /** when each of you first heard it (ms) */
  heard: Record<string, number>;
  gone: boolean;
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;

export function normalizeVoice(id: string, raw: unknown): Voice | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (typeof v.by !== 'string' || !v.by) return null;
  const gone = v.gone === true;
  const audio = typeof v.audio === 'string' ? v.audio : '';
  const mime = typeof v.mime === 'string' ? v.mime.split(';')[0].trim().toLowerCase() : '';
  if (!gone && (!audio || audio.length > VOICE_MAX_CHARS || !B64.test(audio) || !VOICE_MIMES.includes(mime))) return null;
  const secs = typeof v.secs === 'number' && Number.isFinite(v.secs) ? Math.round(Math.min(VOICE_MAX_SECS, Math.max(0, v.secs)) * 10) / 10 : 0;
  const peaks = typeof v.peaks === 'string' && /^[0-9]{1,64}$/.test(v.peaks) ? Array.from(v.peaks, Number) : [];
  const heard: Record<string, number> = {};
  if (v.heard && typeof v.heard === 'object') for (const [uid, at] of Object.entries(v.heard as Record<string, unknown>)) if (typeof at === 'number' && Number.isFinite(at)) heard[uid] = at;
  return { id, by: v.by, at: typeof v.at === 'number' && Number.isFinite(v.at) ? v.at : 0, secs, mime: mime || 'audio/mp4', audio: gone ? '' : audio, peaks, heard, gone };
}

/** loudness over time (any number of readings, 0 and up) as VOICE_BARS digits: the loudest bar is 9, any sound at all at least 1 */
export function peaksFrom(levels: number[], bars = VOICE_BARS): string {
  if (!levels.length) return '0'.repeat(bars);
  const top: number[] = Array.from({ length: bars }, () => 0);
  levels.forEach((l, i) => {
    const b = Math.min(bars - 1, Math.floor((i * bars) / levels.length));
    if (l > top[b]) top[b] = l;
  });
  const max = Math.max(...top);
  if (!(max > 0)) return '0'.repeat(bars);
  return top.map((v) => (v > 0 ? Math.max(1, Math.min(9, Math.round((v / max) * 9))) : 0)).join('');
}

/** "0:07", "1:00" */
export const voiceLength = (secs: number) => {
  const s = Math.max(0, Math.round(secs));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** the newest voice note your person left that you haven't heard yet */
export function unheardVoice(items: Voice[], me: string, them: string | null | undefined): Voice | null {
  if (!them) return null;
  let best: Voice | null = null;
  for (const v of items) if (!v.gone && v.by === them && !v.heard[me] && (!best || v.at > best.at)) best = v;
  return best;
}

/** the type to record in, in this browser (null: it can't record one the iPhone can play) */
export function recordableMime(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  // (AAC only: plain audio/mp4 can mean Opus inside, which the iPhone can't play)
  return MediaRecorder.isTypeSupported('audio/mp4;codecs=mp4a.40.2') ? 'audio/mp4;codecs=mp4a.40.2' : null;
}
