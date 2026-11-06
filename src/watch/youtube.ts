import { cloudConfig } from '../cloud/firebase';
/* Minimal typing for the bits of the YouTube IFrame Player API we use. */

export interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo?(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  loadVideoById(opts: { videoId: string; startSeconds?: number }): void;
  cueVideoById(opts: { videoId: string; startSeconds?: number }): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  getVideoData?(): { video_id?: string; title?: string };
  getVolume?(): number;
  setVolume?(volume: number): void;
  getDuration?(): number;
  destroy(): void;
}

interface YTNamespace {
  Player: new (
    el: HTMLElement | string,
    opts: {
      videoId?: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number; target: YTPlayer }) => void;
        onError?: (e: { data: number }) => void;
      };
    }
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

export const YTState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

let loading: Promise<YTNamespace> | null = null;

export function loadYouTubeApi(timeoutMs = 12000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;
  loading = new Promise<YTNamespace>((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    const timer = window.setTimeout(() => {
      loading = null;
      reject(new Error('YouTube did not load'));
    }, timeoutMs);
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      window.clearTimeout(timer);
      if (window.YT?.Player) resolve(window.YT);
    };
    if (!document.querySelector('script[data-yt-api]')) {
      const s = document.createElement('script');
      s.src = 'https://www.youtube.com/iframe_api';
      s.async = true;
      s.dataset.ytApi = '1';
      s.onerror = () => {
        window.clearTimeout(timer);
        loading = null;
        reject(new Error('YouTube did not load'));
      };
      document.head.appendChild(s);
    }
  });
  return loading;
}

// reading a YouTube link lives on its own (no imports), so the iPhone app's tests can check against it
export { parseYouTubeId, parseYouTubeStart } from './youtubeLink';

export function describeYouTubeError(code: number) {
  if (code === 101 || code === 150) return "This video's owner doesn't allow it to be played outside YouTube. Try another one.";
  if (code === 100) return "That video couldn't be found. It may be private or removed.";
  if (code === 2) return "That doesn't look like a valid YouTube link.";
  return 'YouTube had trouble playing that video. Try again or pick another.';
}

/**
 * Karaoke night: finding a song's karaoke version on YouTube (the backing track with the words on
 * screen), and the queue of who sings what next. The video itself plays in the TV, in sync for both of
 * you, exactly like Watch together.
 *
 * Search uses the YouTube Data API with the place's own Google key. Until YouTube search is switched on
 * for that key (Google Cloud > APIs > YouTube Data API v3), searching falls back to opening YouTube in a
 * new tab, and pasting the link back.
 */

export interface KaraokeHit {
  videoId: string;
  title: string;
  channel: string;
  thumb: string;
}

export type SearchResult = { ok: true; hits: KaraokeHit[] } | { ok: false; why: 'off' | 'quota' | 'network' };

const KEY = (import.meta.env.VITE_YOUTUBE_KEY as string | undefined) || cloudConfig?.apiKey || '';
const CACHE = 'soultied_karaoke_search';
const DAY = 24 * 60 * 60 * 1000;
/** once YouTube says search isn't on for this key, don't keep asking (for this visit) */
let searchOff = !KEY;

export const searchAvailable = () => !searchOff;

/** "&amp;" and friends, as YouTube sends titles */
export function decodeTitle(s: string) {
  const el = document.createElement('textarea');
  el.innerHTML = s;
  return el.value;
}

/** A shorter title for the queue: drops the "(Karaoke Version)"-style tags karaoke channels add. */
export function tidyTitle(s: string) {
  const t = s
    .replace(/\s*[[(（][^\])）]*(karaoke|instrumental|lyrics|backing|sing ?along|no vocals?|minus one|version)[^\])）]*[\])）]/gi, '')
    .replace(/\s*[|｜-]\s*(karaoke|sing king|lyrics|instrumental).*$/i, '')
    .replace(/\s+karaoke( version)?\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t || s.trim();
}

const queryKey = (q: string) => q.trim().toLowerCase().replace(/\s+/g, ' ');

function readCache(): Record<string, { at: number; hits: KaraokeHit[] }> {
  try {
    return JSON.parse(localStorage.getItem(CACHE) || '{}');
  } catch {
    return {};
  }
}

function writeCache(q: string, hits: KaraokeHit[]) {
  try {
    const c = readCache();
    c[queryKey(q)] = { at: Date.now(), hits };
    // keep the 40 most recent searches
    const keep = Object.entries(c)
      .sort((a, b) => b[1].at - a[1].at)
      .slice(0, 40);
    localStorage.setItem(CACHE, JSON.stringify(Object.fromEntries(keep)));
  } catch {
    // storage full or blocked: just search again next time
  }
}

/** Find karaoke versions of a song (results are remembered for a week, so a search costs YouTube once). */
export async function searchKaraoke(q: string): Promise<SearchResult> {
  const cached = readCache()[queryKey(q)];
  if (cached && Date.now() - cached.at < 7 * DAY) return { ok: true, hits: cached.hits };
  if (searchOff) return { ok: false, why: 'off' };
  const query = /karaoke|instrumental/i.test(q) ? q : `${q} karaoke`;
  const url =
    'https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=8&safeSearch=moderate' +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(KEY)}`;
  let res: Response;
  try {
    res = await fetch(url);
  } catch {
    return { ok: false, why: 'network' };
  }
  if (!res.ok) {
    let reason = '';
    try {
      const body = await res.json();
      reason = JSON.stringify(body?.error?.errors || body?.error?.details || '');
    } catch {
      // no body
    }
    if (/quota/i.test(reason)) return { ok: false, why: 'quota' };
    // not switched on for this key (or the key isn't allowed to use it)
    searchOff = true;
    return { ok: false, why: 'off' };
  }
  const body = (await res.json()) as {
    items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } } }>;
  };
  const hits: KaraokeHit[] = (body.items || [])
    .filter((it) => it.id?.videoId)
    .map((it) => ({
      videoId: it.id!.videoId!,
      title: decodeTitle(it.snippet?.title || 'A song'),
      channel: decodeTitle(it.snippet?.channelTitle || ''),
      thumb: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || '',
    }));
  writeCache(q, hits);
  return { ok: true, hits };
}

export const youtubeSearchUrl = (q: string) =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(/karaoke|instrumental/i.test(q) ? q : `${q} karaoke`)}`;

/** The songs you've sung in this place, newest first (kept in this browser), for one-tap encores. */
export function sungBefore(roomId: string): Array<{ videoId: string; title: string }> {
  try {
    return JSON.parse(localStorage.getItem(`soultied_karaoke_sung_${roomId}`) || '[]');
  } catch {
    return [];
  }
}

export function rememberSung(roomId: string, song: { videoId: string; title: string }) {
  try {
    const list = [song, ...sungBefore(roomId).filter((s) => s.videoId !== song.videoId)].slice(0, 12);
    localStorage.setItem(`soultied_karaoke_sung_${roomId}`, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const newSongId = () => Math.random().toString(36).slice(2, 10);
