import type { Platform, TitleInfo } from '../../../src/stream/protocol';

/**
 * One small adapter per streaming site: where the video is, what's playing,
 * and how to play / pause / seek it without upsetting the site's own player.
 */
export interface Adapter {
  platform: Platform;
  /** a key for what's on screen right now (changes with each episode), or null if nothing is playing */
  currentKey(): string | null;
  video(): HTMLVideoElement | null;
  title(): Promise<TitleInfo | null>;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  /** where you are in the story, in seconds (what seek() takes); the <video>'s own clock unless the site stitches ads into it */
  pos?(v: HTMLVideoElement): number;
  setVolume(v: number): void;
  /** an ad is playing (so your person waits) */
  inAd(): boolean;
  /** a link that puts your person on the same thing, at a time if the site allows it */
  linkAt(t: TitleInfo, sec: number): string;
}

const txt = (sel: string) => (document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

function biggestVideo(root: ParentNode = document): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null;
  let area = 0;
  root.querySelectorAll('video').forEach((v) => {
    const r = v.getBoundingClientRect();
    const a = r.width * r.height;
    if (a > area && v.readyState > 0) {
      area = a;
      best = v;
    }
  });
  return best;
}

/** The one big picture on the page, whatever the site's markup: a film that's playing fills most of the window. */
function mainVideo(): HTMLVideoElement | null {
  const v = biggestVideo();
  if (!v) return null;
  const r = v.getBoundingClientRect();
  return r.width >= window.innerWidth * 0.5 && r.height >= window.innerHeight * 0.35 && v.duration > 0 ? v : null;
}

/* ---------------- Netflix ---------------- */

let nfSeq = 0;
function nf<T = unknown>(cmd: string, arg?: number): Promise<{ ok: boolean; out: T | null }> {
  const id = ++nfSeq;
  return new Promise((resolve) => {
    const done = (r: { ok: boolean; out: T | null }) => {
      window.removeEventListener('message', on);
      window.clearTimeout(t);
      resolve(r);
    };
    const on = (ev: MessageEvent) => {
      const d = ev.data as { source?: string; id?: number; ok?: boolean; out?: T };
      if (ev.source === window && d?.source === 'soultied-nf-reply' && d.id === id) done({ ok: !!d.ok, out: d.out ?? null });
    };
    const t = window.setTimeout(() => done({ ok: false, out: null }), 800);
    window.addEventListener('message', on);
    window.postMessage({ source: 'soultied-nf', id, cmd, arg }, location.origin);
  });
}

/** what Netflix's own player says is playing (in case the address doesn't say), asked for every few seconds */
let nfPlaying: string | null = null;
let nfAsked = 0;
function askNetflix() {
  if (Date.now() - nfAsked < 2000) return;
  nfAsked = Date.now();
  void nf<string>('id').then((r) => {
    nfPlaying = r.ok && r.out ? String(r.out) : null;
  });
}
// the watch page is /watch/<id>; allow for a country prefix (/in/watch/<id>) too
const nfUrlId = () => location.pathname.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?watch\/(\d+)/i)?.[1] || null;
const nfId = () => {
  const fromUrl = nfUrlId();
  if (fromUrl) return fromUrl;
  askNetflix();
  return nfPlaying;
};
const titleCache = new Map<string, TitleInfo>();

export const netflix: Adapter = {
  platform: 'netflix',
  currentKey: () => {
    const id = nfId();
    return id ? `netflix:${id}` : null;
  },
  video: () => (nfUrlId() ? biggestVideo() : nfId() ? mainVideo() : null),
  async title() {
    const id = nfId();
    if (!id) return null;
    const key = `netflix:${id}`;
    const cached = titleCache.get(key);
    if (cached) return cached;
    const m = await nf<{ show: string; episode: string; showId: string }>('meta');
    let show = m.out?.show || '';
    let episode = m.out?.episode || '';
    if (!show) {
      // the title strip in Netflix's controls: <h4>Show</h4><span>S1:E2</span><span>Name</span>
      const box = document.querySelector('[data-uia="video-title"]');
      show = (box?.querySelector('h4')?.textContent || box?.textContent || '').trim();
      episode = [...(box?.querySelectorAll('span') || [])].map((s) => s.textContent?.trim()).filter(Boolean).join(' · ');
    }
    // keyed by name, so it matches however we learned it (Netflix's player data or the title on screen)
    const showKey = show ? `netflix-show:${slug(show)}` : key;
    const info: TitleInfo = { platform: 'netflix', key, showKey, show: show || 'Netflix', episode, url: `https://www.netflix.com/watch/${id}` };
    if (show) titleCache.set(key, info);
    return info;
  },
  play() {
    void nf('play').then((r) => {
      if (!r.ok) void this.video()?.play().catch(() => undefined);
    });
  },
  pause() {
    void nf('pause').then((r) => {
      if (!r.ok) this.video()?.pause();
    });
  },
  seek(sec) {
    void nf('seek', sec).then((r) => {
      const v = this.video();
      if (!r.ok && v) v.currentTime = sec;
    });
  },
  setVolume(v) {
    void nf('volume', v).then((r) => {
      const el = this.video();
      if (!r.ok && el) el.volume = v;
    });
  },
  inAd: () => !!document.querySelector('[data-uia*="ad-break"], [data-uia*="ads-info"], [data-uia="ad-countdown"]'),
  linkAt: (t, sec) => `${t.url}?t=${Math.max(0, Math.floor(sec))}`,
};

/* ---------------- Prime Video ---------------- */

/*
 * Prime's player (2026) no longer labels its title on screen in a way we can
 * read, and the address bar can point at the show, a season or an episode
 * depending on where you pressed play. But the player asks Amazon for what
 * it's about to play, and the address of that request names the title by its
 * global id (amzn1.dv.gti.…), the same for both of you wherever you are. The
 * page's own list of requests (resource timing) shows us those addresses, and
 * the "player chrome" one can be asked again for the title's names.
 */

const GTI_PARAM = /[?&](?:titleId|entityId|asin)=(amzn1\.dv\.gti\.[0-9a-f-]{20,})/i;
let primeGti: string | null = null;
const primeChromeUrls = new Map<string, string>();
const primeMeta = new Map<string, Promise<{ show: string; title: string; season: number; episode: number; kind: string } | null>>();

function seenRequest(url: string) {
  const m = url.match(GTI_PARAM);
  if (!m) return;
  const gti = m[1];
  if (/playerChromeResources/i.test(url)) {
    if (/catalogMetadata/i.test(url)) primeChromeUrls.set(gti, url);
    primeGti = gti;
  } else if (/PlaybackResources/i.test(url)) primeGti = gti;
}

if (typeof PerformanceObserver !== 'undefined' && /primevideo\.com$|(^|\.)amazon\./.test(location.hostname)) {
  try {
    new PerformanceObserver((list) => list.getEntries().forEach((e) => seenRequest(e.name))).observe({ type: 'resource', buffered: true });
  } catch {
    // very old browser: we fall back to the address bar
  }
}

function primeNames(gti: string) {
  let p = primeMeta.get(gti);
  if (!p) {
    const url = primeChromeUrls.get(gti);
    p = !url
      ? Promise.resolve(null)
      : fetch(url, { credentials: 'include' })
          .then((r) => (r.ok ? r.json() : null))
          .then((j) => {
            const c = j?.resources?.catalogMetadataV2?.catalog;
            if (!c) return null;
            return {
              show: String(c.seriesTitle || c.title || ''),
              title: String(c.title || ''),
              season: Number(c.seasonNumber) || 0,
              episode: Number(c.episodeNumber) || 0,
              kind: String(c.entityType || c.type || ''),
            };
          })
          .catch(() => null);
    primeMeta.set(gti, p);
    // a miss is worth asking about again later (the address may turn up a moment after)
    void p.then((r) => {
      if (!r) primeMeta.delete(gti);
    });
  }
  return p;
}

/*
 * Prime's player sits in a #dv-web-player box. The 2026 site keeps two (an
 * empty #dv-web-player and #dv-web-player-2 with the film in it), so look in
 * every box rather than the first one.
 */
const PRIME_ROOTS = '[id^="dv-web-player"], .dv-player-fullscreen, .webPlayerSDKContainer, .webPlayerContainer, [class*="webPlayerSDKContainer"]';
const primeRoot = () => primeVideo()?.closest<HTMLElement>(PRIME_ROOTS) ?? null;

/*
 * Moving Prime's <video> to a new time directly breaks its player ("Video
 * Unavailable"), so play / pause / seek go through Amazon's own player, which
 * prime-main.js (running in the page) finds and works for us. It also says
 * exactly which title is open.
 */
let pvSeq = 0;
function pv<T = unknown>(cmd: string, arg?: number): Promise<{ ok: boolean; out: T | null }> {
  const id = ++pvSeq;
  return new Promise((resolve) => {
    const done = (r: { ok: boolean; out: T | null }) => {
      window.removeEventListener('message', on);
      window.clearTimeout(t);
      resolve(r);
    };
    const on = (ev: MessageEvent) => {
      const d = ev.data as { source?: string; id?: number; ok?: boolean; out?: T };
      if (ev.source === window && d?.source === 'soultied-pv-reply' && d.id === id) done({ ok: !!d.ok, out: d.out ?? null });
    };
    const t = window.setTimeout(() => done({ ok: false, out: null }), 800);
    window.addEventListener('message', on);
    window.postMessage({ source: 'soultied-pv', id, cmd, arg }, location.origin);
  });
}
/** what Amazon's player says is open, asked for every couple of seconds */
let primeOpen: string | null = null;
let primeAsked = 0;
function askPrime() {
  if (Date.now() - primeAsked < 2000) return;
  primeAsked = Date.now();
  void pv<string>('id').then((r) => {
    primeOpen = r.ok && r.out ? String(r.out) : null;
  });
}
/*
 * Where you are in the story (without the ads stitched into Prime's video):
 * prime-main.js says a few times a second, with the <video>'s clock at that
 * moment. Between ad breaks the gap between the two stays the same, so we can
 * answer right away for any moment; during an ad you're held at the break.
 */
let primeGap = 0;
let primeHeardAt = 0;
let primeBreak: number | null = null;
window.addEventListener('message', (ev: MessageEvent) => {
  const d = ev.data as { source?: string; vt?: number; content?: number | null; ad?: boolean };
  if (ev.source !== window || d?.source !== 'soultied-pv-tick' || typeof d.vt !== 'number' || typeof d.content !== 'number') return;
  primeHeardAt = Date.now();
  if (d.ad) primeBreak = d.content;
  else {
    primeBreak = null;
    primeGap = d.content - d.vt;
  }
});
/** story time for this <video>: its own clock while we haven't heard from Amazon's player lately */
function primeStory(v: HTMLVideoElement) {
  if (Date.now() - primeHeardAt > 5000) return v.currentTime;
  if (primeBreak != null) return primeBreak;
  return Math.max(0, v.currentTime + primeGap);
}

/** a seek the page's player couldn't take: only safe on the <video> itself inside what's already loaded */
function inBuffer(v: HTMLVideoElement, sec: number) {
  for (let i = 0; i < v.buffered.length; i++) if (sec >= v.buffered.start(i) && sec <= v.buffered.end(i) - 0.5) return true;
  return false;
}
const primeDetail = () => location.pathname.match(/\/(?:detail|dp)\/([^/?#]+)/)?.[1] || null;
/** "Prime Video: Waiting Hai - Season 1" → "Waiting Hai" */
const primePageShow = () =>
  document.title
    .replace(/^(Amazon\.[a-z.]+|Prime Video)\s*:\s*/i, '')
    .replace(/\s*[-–]\s*Season \d+.*$/i, '')
    .trim();

function primeVideo(): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null;
  let area = 0;
  // only pictures inside a player box (not the trailer at the top of a show's page)
  document.querySelectorAll('video').forEach((v) => {
    if (v.readyState === 0 || !(v.duration > 0) || !v.closest(PRIME_ROOTS)) return;
    const r = v.getBoundingClientRect();
    // the player overlay is open and showing something
    if (r.width > 200 && r.height > 100 && r.width * r.height > area) {
      area = r.width * r.height;
      best = v;
    }
  });
  return best;
}

/** what we last asked the player to do (so a retried play never overrides you pausing it yourself) */
const primeWant = new WeakMap<HTMLVideoElement, 'play' | 'pause'>();

/** Play once the player can: right after a seek, Prime ignores a play() until the new spot has loaded. */
function primePlay(v: HTMLVideoElement, tries = 6) {
  const loading = v.seeking || v.readyState < 3;
  void v.play().catch(() => undefined);
  if (tries <= 0 || !loading) return;
  window.setTimeout(() => {
    if (v.paused && primeVideo() === v && primeWant.get(v) === 'play') primePlay(v, tries - 1);
  }, 700);
}

export const prime: Adapter = {
  platform: 'prime',
  currentKey() {
    if (!primeVideo()) return null;
    askPrime();
    if (primeOpen) return `prime:${primeOpen}`;
    if (primeGti) return `prime:${primeGti}`;
    return `prime:${primeDetail() || slug(primePageShow()) || 'prime'}`;
  },
  video: primeVideo,
  pos: primeStory,
  async title() {
    const key = this.currentKey();
    if (!key) return null;
    const cached = titleCache.get(key);
    if (cached) return cached;
    const gti = key.startsWith('prime:amzn1.dv.gti.') ? key.slice(6) : null;
    const names = gti ? await primeNames(gti) : null;
    const show = names?.show || primePageShow();
    const episode = names && names.episode > 0 ? `S${names.season}:E${names.episode}${names.title && names.title !== names.show ? ` · ${names.title}` : ''}` : '';
    const info: TitleInfo = {
      platform: 'prime',
      key,
      showKey: `prime-show:${slug(show) || gti || primeDetail() || key}`,
      show: show || 'Prime Video',
      episode,
      // a link that opens this exact title for your person too, wherever they started from
      url: gti ? `https://www.primevideo.com/detail/${gti}` : location.origin + location.pathname,
    };
    if (names) titleCache.set(key, info);
    return info;
  },
  play() {
    const v = primeVideo();
    if (!v) return;
    primeWant.set(v, 'play');
    // right after a seek (or going into an ad break) Prime can ignore a play: ask again until it's playing
    const go = (tries: number) =>
      void pv('play').then((r) => {
        if (!r.ok) return primePlay(v);
        window.setTimeout(() => {
          const now = primeVideo();
          if (tries > 0 && now && now.paused && primeWant.get(now) === 'play') go(tries - 1);
        }, 900);
      });
    go(5);
  },
  pause() {
    const v = primeVideo();
    if (!v) return;
    primeWant.set(v, 'pause');
    void pv('pause').then((r) => {
      if (!r.ok) v.pause();
    });
  },
  seek(sec) {
    void pv('seek', sec).then((r) => {
      const v = primeVideo();
      // without Amazon's player, only move within what's already loaded (anything else breaks Prime's player)
      const to = sec - (Date.now() - primeHeardAt > 5000 ? 0 : primeGap);
      if (!r.ok && v && inBuffer(v, to)) v.currentTime = to;
    });
  },
  setVolume(v) {
    const el = primeVideo();
    if (el) el.volume = v;
  },
  inAd() {
    // Amazon's player says so (even while paused, when the "Ad" label is hidden)
    if (primeBreak != null && Date.now() - primeHeardAt < 3000) return true;
    if (document.querySelector('.atvwebplayersdk-ad-timer, .atvwebplayersdk-adtimeindicator-text, [class*="adtimeindicator"], [class*="ad-timer"]')) return true;
    // the new player: a small "Ad" or "Ad 1 of 2" label over the picture
    const root = primeRoot();
    if (!root) return false;
    for (const el of root.querySelectorAll('span, div')) {
      if (el.childElementCount) continue;
      const t = el.textContent?.trim() || '';
      if (t.length < 16 && /^(Ad|Ads|Advertisement)(\s*\d+\s*(of|\/)\s*\d+)?(\s*[·•:]\s*\d+:\d\d)?$/i.test(t)) return true;
    }
    return false;
  },
  // Prime's own "Play" links look like /detail/<id>?autoplay=1&t=0
  linkAt: (t, sec) => `${t.url}${t.url.includes('?') ? '&' : '?'}autoplay=1&t=${Math.max(0, Math.floor(sec))}`,
};

export function adapterFor(host: string): Adapter | null {
  if (host.endsWith('netflix.com')) return netflix;
  if (host.includes('primevideo.com') || host.includes('amazon.')) return prime;
  return null;
}
