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

const nfId = () => location.pathname.match(/^\/watch\/(\d+)/)?.[1] || null;
const titleCache = new Map<string, TitleInfo>();

export const netflix: Adapter = {
  platform: 'netflix',
  currentKey: () => {
    const id = nfId();
    return id ? `netflix:${id}` : null;
  },
  video: () => (nfId() ? biggestVideo() : null),
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

const primeRoot = () =>
  document.querySelector<HTMLElement>('#dv-web-player, .webPlayerSDKContainer, .webPlayerContainer, [class*="webPlayerSDKContainer"]');
const primeDetail = () => location.pathname.match(/\/(?:detail|dp)\/([^/?#]+)/)?.[1] || null;

function primeVideo(): HTMLVideoElement | null {
  const root = primeRoot();
  const v = root ? biggestVideo(root) : null;
  if (!v) return null;
  const r = v.getBoundingClientRect();
  // the player overlay is open and showing something
  return r.width > 200 && r.height > 100 && v.duration > 0 ? v : null;
}

export const prime: Adapter = {
  platform: 'prime',
  currentKey() {
    if (!primeVideo()) return null;
    const ep = txt('.atvwebplayersdk-subtitle-text');
    const show = txt('.atvwebplayersdk-title-text');
    const base = primeDetail() || slug(show) || 'prime';
    return `prime:${base}:${slug(ep) || 'film'}`;
  },
  video: primeVideo,
  async title() {
    const key = this.currentKey();
    if (!key) return null;
    const cached = titleCache.get(key);
    if (cached) return cached;
    const show = txt('.atvwebplayersdk-title-text');
    const episode = txt('.atvwebplayersdk-subtitle-text').replace(/^Season (\d+), Ep\. (\d+)\s*/i, 'S$1:E$2 · ').replace(/ · $/, '');
    const detail = primeDetail();
    const info: TitleInfo = {
      platform: 'prime',
      key,
      showKey: `prime-show:${slug(show) || detail || key}`,
      show: show || 'Prime Video',
      episode,
      url: location.origin + location.pathname,
    };
    if (show) titleCache.set(key, info);
    return info;
  },
  play() {
    void primeVideo()?.play().catch(() => undefined);
  },
  pause() {
    primeVideo()?.pause();
  },
  seek(sec) {
    const v = primeVideo();
    if (v) v.currentTime = sec;
  },
  setVolume(v) {
    const el = primeVideo();
    if (el) el.volume = v;
  },
  inAd: () =>
    !!document.querySelector('.atvwebplayersdk-ad-timer, .atvwebplayersdk-adtimeindicator-text, [class*="adtimeindicator"], [class*="ad-timer"]'),
  linkAt: (t) => t.url,
};

export function adapterFor(host: string): Adapter | null {
  if (host.endsWith('netflix.com')) return netflix;
  if (host.includes('primevideo.com') || host.includes('amazon.')) return prime;
  return null;
}
