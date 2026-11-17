/* Continue watching: the shows and videos the two of you were part way through, on YouTube, Netflix, Prime
 * Video and the rest, as a shelf of pixel video tapes (the title written on the label, the tape wound on as
 * far as you got). Kept in spaces/{sid}/meta/stream's `shows` (the same list the Soultied extension and the
 * iPhone app keep for Netflix and Prime), with YouTube's videos under `youtube:<id>`.
 *
 * The iPhone app works these out the same way (SoultiedCore/Watch/Tapes.swift, checked against
 * scripts/native-fixtures.ts), so a phone and a laptop show the same tapes. */

/** one tape on the shelf */
export interface Tape {
  /** the show (or the YouTube video), as kept under `shows` */
  key: string;
  /** youtube, netflix, prime, hotstar, …: what's before the colon in the episode's key */
  platform: string;
  /** the show's name, or the video's title */
  show: string;
  /** e.g. "S2:E4 · The Pollywog" (empty for a film or a video) */
  episode: string;
  url: string;
  /** seconds in */
  pos: number;
  /** how long it is, in seconds (0: not known) */
  dur: number;
  /** when it was last watched (ms) */
  at: number;
  /** who watched it last: a person's id, 'both' (together), or '' (not known) */
  by: string;
}

/** a tape older than this has gone back on the shelf for good (ms) */
export const TAPE_STALE_MS = 60 * 24 * 3600 * 1000;
/** how near the end counts as finished (seconds), unless it's a short thing */
const ENDS = 20;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export const youTubeKey = (id: string) => `youtube:${id}`;

/** where a tape's platform comes from: the start of its episode's key ("netflix:80100172"), or its show's
 * ("netflix-show:dark") */
export function tapePlatform(key: string) {
  const i = key.indexOf(':');
  return i > 0 ? key.slice(0, i).replace(/-show$/, '') : '';
}

/** finished (or as good as): no tape for it */
export function tapeDone(pos: number, dur: number) {
  return dur > 0 && dur - pos < Math.max(ENDS, dur * 0.03);
}

/**
 * The tapes, newest first: from meta/stream's `shows`, leaving out what's finished, what you'd only just
 * started, what's not been touched in two months, and (when `platforms` is given) the other sites.
 */
export function continueTapes(raw: unknown, now: number, max = 6, platforms: string[] | null = null): Tape[] {
  const shows = raw && typeof raw === 'object' ? ((raw as { shows?: unknown }).shows as Record<string, unknown> | undefined) : undefined;
  if (!shows || typeof shows !== 'object') return [];
  const out: Tape[] = [];
  for (const k of Object.keys(shows)) {
    const v = shows[k] as Record<string, unknown> | null;
    if (!v || typeof v !== 'object') continue;
    const ep = str(v.key) || k;
    const platform = tapePlatform(ep);
    const url = str(v.url);
    if (!platform || !url) continue;
    if (platforms && !platforms.includes(platform)) continue;
    const pos = num(v.pos);
    const dur = num(v.dur);
    const at = num(v.at);
    if (pos < 10 || tapeDone(pos, dur) || now - at > TAPE_STALE_MS) continue;
    // (Netflix and Prime only ever note what you watched together)
    const by = str(v.by) || (platform === 'youtube' ? '' : 'both');
    out.push({ key: k, platform, show: str(v.show) || 'Something', episode: str(v.episode), url, pos, dur, at, by });
  }
  out.sort((a, b) => b.at - a.at || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return out.slice(0, max);
}

/** a few seconds back from where you stopped, so you catch the line again */
export const resumeAt = (pos: number) => Math.max(0, Math.floor(pos) - 5);

/** the YouTube video's id, for a YouTube tape */
export const tapeVideoId = (t: Tape) => (t.platform === 'youtube' ? t.key.slice('youtube:'.length) : null);

/** where to go to carry on: YouTube and Netflix from the moment you stopped; the rest remember for themselves */
export function resumeUrl(t: Tape) {
  const at = resumeAt(t.pos);
  const id = tapeVideoId(t);
  if (id) return `https://www.youtube.com/watch?v=${id}&t=${at}`;
  if (t.platform === 'netflix') return `${t.url}${t.url.includes('?') ? '&' : '?'}t=${at}`;
  if (t.platform === 'prime') return `${t.url}${t.url.includes('?') ? '&' : '?'}autoplay=1`;
  return t.url;
}

/** what's written on the tape's label: "Dark S1:E2", or the video's title */
export const tapeTitle = (t: Tape) => (t.episode ? `${t.show} ${t.episode.split(' · ')[0]}` : t.show);

/** 1:02:05 / 42:10 (as protocol.ts's clock) */
export function tapeClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** how far through, 0 to 1 (0 when it's not known how long it is) */
export const tapeShare = (t: Tape) => (t.dur > 0 ? Math.min(1, Math.max(0, t.pos / t.dur)) : 0);

/** "23 min left", "1 hr 5 min left", "stopped at 42:10" */
export function tapeLeft(t: Tape) {
  if (t.dur <= 0) return `stopped at ${tapeClock(t.pos)}`;
  const m = Math.max(1, Math.round((t.dur - t.pos) / 60));
  if (m < 60) return `${m} min left`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} hr ${r} min left` : `${h} hr left`;
}

/** "just now", "12 min ago", "3 hours ago", "yesterday", "4 days ago", "2 weeks ago" */
export function tapeAgo(at: number, now: number) {
  const m = Math.round((now - at) / 60000);
  if (m < 2) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? 'hour' : 'hours'} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return d === 1 ? 'yesterday' : `${d} days ago`;
  const w = Math.round(d / 7);
  return `${w} ${w === 1 ? 'week' : 'weeks'} ago`;
}

/** who had it on last: "Together, yesterday", "You, 3 hours ago", "Rohan, just now" */
export function tapeWho(t: Tape, me: string, theirName: string, now: number) {
  const who = t.by === 'both' ? 'Together' : t.by === me ? 'You' : t.by ? theirName || 'Your person' : '';
  const ago = tapeAgo(t.at, now);
  return who ? `${who}, ${ago}` : ago[0].toUpperCase() + ago.slice(1);
}

/** the site's name, small on the label */
export function tapeService(platform: string) {
  const names: Record<string, string> = {
    youtube: 'YouTube',
    netflix: 'Netflix',
    prime: 'Prime Video',
    hotstar: 'JioHotstar',
    sonyliv: 'Sony LIV',
    zee5: 'ZEE5',
    disney: 'Disney+',
    hulu: 'Hulu',
    hbomax: 'Max',
    crunchyroll: 'Crunchyroll',
  };
  return names[platform] || 'A show';
}

/** what YouTube's room writes as you watch (merged into meta/stream) */
export function youTubeTapePatch(id: string, title: string, pos: number, dur: number, by: string, at: number) {
  const key = youTubeKey(id);
  return {
    shows: {
      [key]: {
        show: title.trim().slice(0, 120) || 'A YouTube video',
        episode: '',
        key,
        url: `https://www.youtube.com/watch?v=${id}`,
        pos: Math.floor(pos),
        dur: dur > 0 ? Math.floor(dur) : 0,
        by,
        at,
      },
    },
  };
}

/** the demo's shelf: a YouTube video Rohan carried on with, an episode of Dark and one of Good Omens */
export function demoStreamShows(now: number, them: string) {
  const h = 3600 * 1000;
  return {
    shows: {
      ...youTubeTapePatch('M7lc1UVf-VE', 'A whole Sunday roast in a tiny kitchen', 754, 1820, them, now - 3 * h).shows,
      'netflix-show:dark': { show: 'Dark', episode: 'S1:E3 · Past and Present', key: 'netflix:80100173', url: 'https://www.netflix.com/watch/80100173', pos: 1312, dur: 3060, by: 'both', at: now - 26 * h },
      'prime-show:good-omens': { show: 'Good Omens', episode: 'S1:E2 · The Book', key: 'prime:B07FMHTRFH', url: 'https://www.primevideo.com/detail/B07FMHTRFH', pos: 1903, dur: 3240, by: 'both', at: now - 98 * h },
    },
  };
}

/* ---------- the tape itself, in pixels ---------- */

export const TAPE_W = 52;
export const TAPE_H = 30;
/** where the label is, so its words can sit on it (in the tape's own pixels) */
export const TAPE_LABEL = { x: 4, y: 3, w: 44, h: 12 };

/** the stripe across the top of the label: one colour per site (no logos) */
export function tapeStripe(platform: string) {
  const c: Record<string, string> = { youtube: '#c4473d', netflix: '#8e2f28', prime: '#3c6a9a', hotstar: '#4b4fa0', disney: '#355e9a', hbomax: '#5b3f8f', crunchyroll: '#c9772f' };
  return c[platform] || '#6f7f5a';
}

/** the reels: tape wound on the right as far as you've got, still to come on the left (squared radii) */
const REEL = [0, 2, 5, 8, 10];
const reelStep = (share: number) => Math.max(0, Math.min(4, Math.round(share * 4)));

/**
 * A video tape, 52 x 30: a dark shell, a cream label with a coloured stripe, and a window onto the two reels,
 * wound as far as you've got. One character a pixel ('.' clear), with the colours to draw it in.
 */
export function tapeSprite(share: number, platform: string): { rows: string[]; pal: Record<string, string> } {
  const g: string[][] = Array.from({ length: TAPE_H }, () => Array.from({ length: TAPE_W }, () => 'b'));
  const set = (x: number, y: number, k: string) => {
    if (x >= 0 && y >= 0 && x < TAPE_W && y < TAPE_H) g[y][x] = k;
  };
  // the shell: an outline with its corners rounded off, a lighter edge along the top, two screws
  for (let x = 0; x < TAPE_W; x++) {
    set(x, 0, 'o');
    set(x, TAPE_H - 1, 'o');
    set(x, 1, 'h');
  }
  for (let y = 0; y < TAPE_H; y++) {
    set(0, y, 'o');
    set(TAPE_W - 1, y, 'o');
  }
  for (const [x, y] of [[0, 0], [TAPE_W - 1, 0], [0, TAPE_H - 1], [TAPE_W - 1, TAPE_H - 1]]) set(x, y, '.');
  set(1, 1, 'o');
  set(TAPE_W - 2, 1, 'o');
  set(3, TAPE_H - 3, 'h');
  set(TAPE_W - 4, TAPE_H - 3, 'h');
  // the label: cream, a stripe of the site's colour across its top, a shadow under it
  const L = TAPE_LABEL;
  for (let y = L.y; y < L.y + L.h; y++)
    for (let x = L.x; x < L.x + L.w; x++) set(x, y, y < L.y + 2 ? 's' : 'l');
  for (let x = L.x + 1; x <= L.x + L.w; x++) set(x, L.y + L.h, 'd');
  // the window onto the reels
  const wx = 11;
  const wy = 17;
  const ww = 30;
  const wh = 9;
  for (let y = wy; y < wy + wh; y++)
    for (let x = wx; x < wx + ww; x++) set(x, y, x === wx || y === wy || x === wx + ww - 1 || y === wy + wh - 1 ? 'g' : 'w');
  // the two reels: tape (brown) round a cream hub with a dark middle
  const step = reelStep(share);
  const reel = (cx: number, r2: number) => {
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 === 0) set(cx + dx, 21 + dy, 'w');
        else if (d2 <= 1) set(cx + dx, 21 + dy, 'c');
        else if (d2 <= r2) set(cx + dx, 21 + dy, 'r');
      }
  };
  reel(18, REEL[4 - step]);
  reel(33, REEL[step]);
  // the tape running between them, along the bottom of the window
  for (let x = 18; x <= 33; x++) if (g[24][x] === 'w') set(x, 24, 't');
  return {
    rows: g.map((r) => r.join('')),
    pal: { o: '#1a1416', b: '#3a3034', h: '#54474c', l: '#f3e6cc', s: tapeStripe(platform), d: '#241c1f', g: '#2a2124', w: '#120e10', r: '#6b4430', c: '#e3d6bd', t: '#4a2f22' },
  };
}
