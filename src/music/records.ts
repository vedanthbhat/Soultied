import albums from './shelf.json';
/**
 * The record on the turntable: five soft jazz tracks by Kevin MacLeod
 * (incompetech.com), licensed under Creative Commons: By Attribution 4.0.
 * They're stored in public/audio as 96 kbps MP3s (re-encoded from the
 * originals, with their volumes evened out); the credit is shown whenever
 * one is playing.
 *
 * The record plays for both of you: the shared state is just "on, and when
 * the first track would have started", so each of you works out the same
 * track and the same spot in it from the clock.
 */

export interface Track {
  slug: string;
  title: string;
  /** length in seconds */
  secs: number;
}

export const TRACKS: Track[] = [
  { slug: 'study-and-relax', title: 'Study And Relax', secs: 223.452 },
  { slug: 'smooth-lovin', title: 'Smooth Lovin', secs: 259.452 },
  { slug: 'night-in-venice', title: 'Night in Venice', secs: 218.196 },
  { slug: 'bossa-antigua', title: 'Bossa Antigua', secs: 283.392 },
  { slug: 'cool-vibes', title: 'Cool Vibes', secs: 218.448 },
];

export const shelf = [{id:'jazz',title:'Jazz café',tracks:TRACKS}, ...albums];
export const tracksFor = (id?: string) => shelf.find(record => record.id === id)?.tracks ?? TRACKS;

export const ARTIST = 'Kevin MacLeod';
export const SOURCE_URL = 'https://incompetech.com';
export const LICENSE = 'CC BY 4.0';
export const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';

export const trackUrl = (t: Track) => import.meta.env.BASE_URL + (TRACKS.includes(t) ? "audio/"+t.slug+".mp3" : "audio/shelf/"+t.slug+".wav");

/** The whole record, once through, in milliseconds. */
export const RECORD_MS = TRACKS.reduce((s, t) => s + t.secs * 1000, 0);

/** Where each track starts on the record, in milliseconds. */
export function whereAt(startedAt: number, now: number, tracks = TRACKS) {
  const duration = tracks.reduce((sum,t) => sum + t.secs * 1000, 0);
  let ms = ((now - startedAt) % duration + duration) % duration;
  for (let index = 0; index < tracks.length; index++) {
    if (ms < tracks[index].secs * 1000) return {index, offset: ms / 1000};
    ms -= tracks[index].secs * 1000;
  }
  return {index:0, offset:0};
}
export const startFor = (index: number, now: number, tracks = TRACKS) =>
  now - tracks.slice(0, ((index % tracks.length) + tracks.length) % tracks.length).reduce((ms,t) => ms + t.secs * 1000, 0);

/** What's on the turntable, shared between the two of you. */
export interface TurntableState {
  album?: string;
  on: boolean;
  /** when the first track would have started (epoch ms) */
  startedAt: number;
  /** who last put the needle down or lifted it */
  by: string;
  at: number;
  /** the track to start from next time */
  next: number;
  /**
   * A song from YouTube on the turntable instead of the record: its video id (and title, once known).
   * startedAt is then when the song's first second would have played.
   */
  yt?: { id: string; title?: string } | null;
}
