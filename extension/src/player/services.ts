import { SERVICES, type Platform, type TitleInfo } from '../../../src/stream/protocol';
import type { Adapter } from './adapters';

/*
 * The newer streaming sites (beta): JioHotstar, Sony LIV, ZEE5, Disney+, Hulu, HBO Max and Crunchyroll.
 *
 * Unlike Netflix and Prime, these players are happy to be driven through the <video> itself (play,
 * pause, and moving its clock to seek), so one adapter does for all of them, told per site:
 * - which addresses are watch pages, and the id of what's on (one per episode or film);
 * - where its film is (and where its ads are: most of these play ads in a second, separate
 *   picture over the film, which pauses meanwhile);
 * - how it names what's on. Most say it in their structured data for search engines (JSON-LD:
 *   TVEpisode / Movie), and in the tab's title; a few on the player itself.
 *
 * Crunchyroll's player can live in a frame of its own (static.crunchyroll.com). Soultied then runs
 * inside that frame, and asks the background about the page around it (its address and names).
 */

/** What the page (the top one, around any player frame) says about itself. */
export interface PageInfo {
  url: string;
  title: string;
  /** its structured data, flattened (@graph and lists opened up) */
  ld: Record<string, unknown>[];
  og: string;
  /** the text of each of the site's own selectors that's on the page */
  texts: Record<string, string>;
}

/**
 * Read the page. Self-contained: the background also runs it in a tab's top frame (for a player
 * in a frame of its own), so it can't use anything from outside.
 */
export function readPage(selectors: string[]): PageInfo {
  const ld: Record<string, unknown>[] = [];
  const add = (j: unknown) => {
    if (Array.isArray(j)) j.forEach(add);
    else if (j && typeof j === 'object') {
      ld.push(j as Record<string, unknown>);
      const g = (j as Record<string, unknown>)['@graph'];
      if (Array.isArray(g)) g.forEach(add);
    }
  };
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
    try {
      add(JSON.parse(s.textContent || ''));
    } catch {
      // not JSON after all
    }
  });
  const texts: Record<string, string> = {};
  for (const sel of selectors) {
    try {
      const t = (document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
      if (t) texts[sel] = t;
    } catch {
      // a selector this browser doesn't know
    }
  }
  return { url: location.href, title: document.title, ld, og: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '', texts };
}

export interface Names {
  show: string;
  /** "S1:E2 · Title", or "" for a film */
  episode: string;
}

/** a site, as the adapter needs to know it */
export interface ServiceSite {
  platform: Platform;
  /** what's on, from a watch page's address (null: not a watch page) */
  id(u: URL): string | null;
  /** the film's own <video>, when the site marks it (the biggest long picture otherwise) */
  video?: string;
  /** where the site plays its ads (a picture playing in here is an ad) */
  ads?: string;
  /** marks that are only there while an ad plays */
  adMarks?: string;
  /** the site's own labels for the show and the episode, on the page */
  showSel?: string[];
  episodeSel?: string[];
  /** names from the tab's title ("Watch Vasudha Episode 698 online…"), when nothing better says */
  fromTitle?(title: string): Names | null;
  /** the address to send your person (this page's, tidied) */
  link?(u: URL): string;
  /** look inside the page's components (shadow roots) for the picture too */
  shadow?: boolean;
  /** the film plays in a frame of its own: in the top page, stand back for it */
  playerFrame?: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
const tidy = (s: string) => s.replace(/\s+/g, ' ').trim();

/** a JSON-LD value as text ("x", ["x"], {"@value": "x"}, [{"@value": "x"}], {name: "x"}) */
const str = (v: unknown): string => {
  if (typeof v === 'string') return tidy(v);
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return str(v[0]);
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return str(o['@value'] ?? o.name ?? '');
  }
  return '';
};
const one = (v: unknown): Record<string, unknown> | null => {
  const x = Array.isArray(v) ? v[0] : v;
  return x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
};
const isType = (x: Record<string, unknown>, t: string) => {
  const ty = x['@type'];
  return ty === t || (Array.isArray(ty) && ty.includes(t));
};

/** the structured data's names for what's on this page (not the show's other episodes listed on it) */
export function namesFromLd(info: PageInfo): Names | null {
  let here = '';
  try {
    here = new URL(info.url).pathname.replace(/\/$/, '');
  } catch {
    // no address
  }
  const onThisPage = (x: Record<string, unknown>) => {
    const u = str(x.url) || str(x['@id']);
    if (!u || !here) return true;
    try {
      return new URL(u, info.url).pathname.replace(/\/$/, '') === here;
    } catch {
      return true;
    }
  };
  const ep = info.ld.find((x) => isType(x, 'TVEpisode') && onThisPage(x));
  if (ep) {
    const name = str(ep.name);
    const season = one(ep.partOfSeason);
    const series = one(ep.partOfSeries) || info.ld.find((x) => isType(x, 'TVSeries')) || null;
    let show = series ? str(series.name) : '';
    // (some sites name the episode where the series should be: then the season's "Vasudha Season 1" says it)
    if (!show || show === name) show = str(season?.name).replace(/\s*[-–:]?\s*Season\s*\d+\s*$/i, '');
    const sn = Number(str(season?.seasonNumber)) || 0;
    const en = Number(str(ep.episodeNumber)) || 0;
    // "Season 1 | E1 - Maomao" -> "Maomao"
    const title = name.replace(/^Season\s*\d+\s*[|·:-]\s*/i, '').replace(/^E(?:p(?:isode)?)?\.?\s*\d+\s*[-–:·]\s*/i, '');
    const label = en ? `S${sn || 1}:E${en}` : '';
    if (show)
      return {
        show,
        episode: [label, title && title !== show && !/^episode\s*\d+$/i.test(title) ? title : ''].filter(Boolean).join(' · '),
      };
  }
  const film = info.ld.find((x) => isType(x, 'Movie') && onThisPage(x));
  if (film && str(film.name)) return { show: str(film.name), episode: '' };
  return null;
}

/* ---------------- finding the picture ---------------- */

/** every <video>, inside the page's components too (open or closed shadow roots) */
function deepVideos(): HTMLVideoElement[] {
  const out: HTMLVideoElement[] = [...document.querySelectorAll('video')];
  const open = (el: Element): ShadowRoot | null => {
    try {
      return chrome.dom?.openOrClosedShadowRoot?.(el as HTMLElement) ?? el.shadowRoot;
    } catch {
      return el.shadowRoot;
    }
  };
  const walk = (root: Document | ShadowRoot, depth: number) => {
    if (depth > 4) return;
    for (const el of root.querySelectorAll('*')) {
      if (!el.tagName.includes('-') && el.tagName !== 'DIV') continue;
      const sr = open(el);
      if (!sr) continue;
      sr.querySelectorAll('video').forEach((v) => out.push(v));
      walk(sr, depth + 1);
    }
  };
  walk(document, 0);
  return out;
}

const visibleBox = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden' ? r : null;
};

/** A short label like "Ad", "AD", "Ad 1 of 2", "Advertisement: 0:20" or "Ad · 0:15". */
const AD_LABEL = /^(ad|ads|advert|advertisement|sponsored)(\s*[:·•-]?\s*\(?\d+\s*(of|\/)\s*\d+\)?)?(\s*[:·•-]?\s*\d+:\d\d)?$/i;

export function serviceAdapter(site: ServiceSite): Adapter {
  const framed = window.top !== window;
  const name = SERVICES[site.platform].name;
  const titleCache = new Map<string, TitleInfo>();
  let lastVideo: HTMLVideoElement | null = null;

  /* the page around a player frame: its address and names, from the background */
  let outer: PageInfo | null = null;
  let outerAsked = 0;
  const askOuter = () => {
    if (!framed || Date.now() - outerAsked < 1500) return;
    outerAsked = Date.now();
    try {
      void chrome.runtime
        .sendMessage({ kind: 'pageInfo', selectors: [...(site.showSel || []), ...(site.episodeSel || [])] })
        .then((r: PageInfo | null) => {
          if (r && typeof r.url === 'string') outer = r;
        })
        .catch(() => undefined);
    } catch {
      // the extension was updated: a reload picks the new one up
    }
  };
  const pageUrl = (): URL | null => {
    if (framed) {
      askOuter();
      return outer ? new URL(outer.url) : null;
    }
    return new URL(location.href);
  };
  const page = (): PageInfo | null => {
    if (!framed) return readPage([...(site.showSel || []), ...(site.episodeSel || [])]);
    askOuter();
    return outer;
  };

  const standby = () => !framed && !!site.playerFrame && !!document.querySelector(site.playerFrame);

  function video(): HTMLVideoElement | null {
    if (standby()) return null;
    const marked = site.video ? [...document.querySelectorAll<HTMLVideoElement>(site.video)] : [];
    const pool = marked.length ? marked : site.shadow ? deepVideos() : [...document.querySelectorAll('video')];
    let best: HTMLVideoElement | null = null;
    let area = 0;
    for (const v of pool) {
      // the film: long (ads and previews are short; live channels have no end), not in the ads' box, on screen
      if (!(v.duration >= 60) || !Number.isFinite(v.duration)) continue;
      if (site.ads && v.closest(site.ads)) continue;
      const r = v.getBoundingClientRect();
      if (r.width < 240 || r.height < 135) continue;
      const a = r.width * r.height;
      if (a > area || (a === area && best && v.duration > best.duration)) {
        area = a;
        best = v;
      }
    }
    lastVideo = best;
    return best;
  }

  const currentId = () => {
    const u = pageUrl();
    return u ? site.id(u) : null;
  };

  function names(): Names | null {
    const info = page();
    if (!info) return null;
    const pick = (sels?: string[]) => (sels || []).map((s) => info.texts[s]).find(Boolean) || '';
    const onScreen = pick(site.showSel);
    if (onScreen) return { show: onScreen, episode: pick(site.episodeSel) };
    return namesFromLd(info) || site.fromTitle?.(info.title) || site.fromTitle?.(info.og) || null;
  }

  /** the box around the picture (the player), for its "Ad" label */
  const playerBox = (v: HTMLVideoElement) => {
    const r = v.getBoundingClientRect();
    let box: Element = v;
    for (let el = v.parentElement, i = 0; el && i < 6; el = el.parentElement, i++) {
      const b = el.getBoundingClientRect();
      if (b.width > r.width + 80 || b.height > r.height + 120) break;
      box = el;
    }
    return box;
  };

  return {
    platform: site.platform,
    // (only the top page stands back: the copy in the player's frame is the one that works)
    standby: !framed && site.playerFrame ? standby : undefined,
    go: framed
      ? (url: string) => {
          try {
            void chrome.runtime.sendMessage({ kind: 'navigate', url }).catch(() => undefined);
          } catch {
            // the extension was updated
          }
        }
      : undefined,
    adPauses: true,
    currentKey() {
      const id = currentId();
      if (!id || !video()) return null;
      return `${site.platform}:${id}`;
    },
    video,
    async title() {
      const id = currentId();
      if (!id) return null;
      const key = `${site.platform}:${id}`;
      const cached = titleCache.get(key);
      if (cached) return cached;
      const n = names();
      const u = pageUrl();
      const info: TitleInfo = {
        platform: site.platform,
        key,
        showKey: `${site.platform}-show:${slugify(n?.show || '') || id}`,
        show: n?.show || name,
        episode: n?.episode || '',
        url: u ? (site.link ? site.link(u) : u.origin + u.pathname) : '',
      };
      if (n?.show) titleCache.set(key, info);
      return info;
    },
    play() {
      const v = lastVideo || video();
      void v?.play().catch(() => undefined);
    },
    pause() {
      (lastVideo || video())?.pause();
    },
    seek(sec) {
      const v = lastVideo || video();
      if (v) v.currentTime = Math.max(0, Math.min(sec, (v.duration || sec + 1) - 0.5));
    },
    setVolume(x) {
      const v = lastVideo || video();
      if (v) v.volume = Math.max(0, Math.min(1, x));
    },
    inAd() {
      if (site.adMarks && document.querySelector(site.adMarks)) return true;
      const v = lastVideo;
      // a picture playing in the ads' box, or over the film while the film waits
      for (const o of document.querySelectorAll('video')) {
        if (o === v || o.paused || o.ended || !visibleBox(o)) continue;
        if (site.ads && o.closest(site.ads)) return true;
        if (v && v.paused) {
          const a = o.getBoundingClientRect();
          const b = v.getBoundingClientRect();
          if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) return true;
        }
      }
      if (!v) return false;
      // an "Ad" label over the picture
      let n = 0;
      for (const el of playerBox(v).querySelectorAll('span, div, p, label')) {
        if (++n > 600) break;
        if (el.childElementCount) continue;
        const t = (el.textContent || '').trim();
        if (t.length && t.length < 28 && AD_LABEL.test(t) && visibleBox(el)) return true;
      }
      return false;
    },
    linkAt: (t) => t.url,
  };
}

/* ---------------- the sites ---------------- */

/** the last part of a path that looks like an id */
const lastSeg = (u: URL) => u.pathname.split('/').filter(Boolean).pop() || '';
const watchTitle = (re: RegExp) => (title: string) => {
  const m = re.exec(title.trim());
  if (!m) return null;
  const show = tidy(m[1] || '');
  if (!show) return null;
  const s = m[2] ? Number(m[2]) : 0;
  const e = m[3] ? Number(m[3]) : 0;
  const rest = tidy(m[4] || '');
  return { show, episode: [e ? `S${s || 1}:E${e}` : '', rest].filter(Boolean).join(' · ') };
};

export const SITES: Record<string, ServiceSite> = {
  // www.hotstar.com/in/shows/<show>/<id>/<episode>/<id>/watch, /in/movies/<film>/<id>/watch
  hotstar: {
    platform: 'hotstar',
    id: (u) => {
      if (/\/live\/watch/.test(u.pathname) || !/\/(?:shows|movies|tv|sports)\/.*\/watch\/?$/.test(u.pathname)) return null;
      const nums = u.pathname.match(/\/(\d{4,})(?=\/)/g) || [];
      // a show's own watch address plays one of its episodes: that one's named in the address too
      if (nums.length < 2 && u.searchParams.get('fallbackEpisodeId')) return u.searchParams.get('fallbackEpisodeId');
      return nums.length ? nums[nums.length - 1].slice(1) : null;
    },
    // "Watch Bigg Boss S20 Episode 45 on JioHotstar"
    fromTitle: watchTitle(/^Watch\s+(.+?)(?:\s+S(\d+))?(?:\s+(?:Episode|Ep)\s*(\d+))?(?:\s+[-–:]\s*(.+?))?\s+(?:Full Movie\s+)?(?:Online\s+)?on\s+(?:Jio)?Hotstar/i),
  },
  // www.sonyliv.com/shows/<show>-<id>/<episode>-<id>?watch=true, /movies/<film>-<id>
  sonyliv: {
    platform: 'sonyliv',
    id: (u) => {
      const m = /^\/(shows|movies|sports|originals)\/([^/]+)(?:\/([^/]+))?\/?$/.exec(u.pathname);
      if (!m) return null;
      const seg = m[1] === 'movies' ? m[2] : m[3];
      return seg ? /-(\d{6,})$/.exec(seg)?.[1] || null : null;
    },
    video: 'video.vjs-tech',
    ads: '.ad-wrapper, .ima-ad-container',
    // "Watch Latest Kaun Banega Crorepati Episode 52 Online Abhishek Debsharma Takes The Hot Seat Sony LIV"
    fromTitle: watchTitle(/^Watch\s+(?:Latest\s+)?(.+?)(?:\s+Season\s+(\d+))?(?:\s+Episode\s+(\d+))?(?:\s+(?:Full\s+Movie\s+)?Online)\s*(.*?)\s*(?:on\s+)?Sony\s*LIV/i),
    link: (u) => `${u.origin}${u.pathname}?watch=true`,
  },
  // www.zee5.com/tv-shows/details/<show>/<id>/<episode>/0-1-…, /movies/details/<film>/0-0-…
  zee5: {
    platform: 'zee5',
    id: (u) => (/\/details\//.test(u.pathname) && /^0-[01]-\w+$/i.test(lastSeg(u)) ? lastSeg(u) : null),
    video: 'video.vjs-tech',
    ads: '.ima-ad-container, .ad-wrapper',
    adMarks: '.vjs-ad-playing',
    // "Watch Vasudha Episode 698 online in HD on Zee 5 | 1st October 2026"
    fromTitle: watchTitle(/^Watch\s+(.+?)(?:\s+Season\s+(\d+))?(?:\s+Episode\s+(\d+))?\s+(?:Full\s+Movie\s+)?online/i),
  },
  // www.disneyplus.com/play/<id> (also with a language first, /en-gb/play/<id>), /video/<id>
  disney: {
    platform: 'disney',
    id: (u) => /\/(?:play|video)\/([0-9a-z-]{8,})/i.exec(u.pathname)?.[1] || null,
    shadow: true,
    showSel: ['[data-testid="title-field"]', '.title-field'],
    episodeSel: ['[data-testid="subtitle-field"]', '.subtitle-field'],
    fromTitle: (t) => {
      const s = tidy(t.replace(/\s*[|–-]\s*Disney\+.*$/i, '').replace(/^Disney\+\s*[|:–-]\s*/i, ''));
      return s && !/^disney\+?$/i.test(s) ? { show: s, episode: '' } : null;
    },
  },
  // www.hulu.com/watch/<id>
  hulu: {
    platform: 'hulu',
    id: (u) => /\/watch\/([0-9a-z-]{8,})/i.exec(u.pathname)?.[1] || null,
    video: 'video#content-video-player, video.content-video-player',
    ads: '#ad-video-player, .ad-video-player, .AdUnitView, [class*="AdUnitView"]',
    adMarks: '.AdUnitView, [class*="AdUnitView"], [class*="ad-timer" i], [data-testid*="ad-countdown" i]',
    showSel: ['.PlayerMetadata__titleText', '[class*="PlayerMetadata__titleText"]', '[data-testid="player-metadata-title"]'],
    episodeSel: ['.PlayerMetadata__subTitle', '[class*="PlayerMetadata__subTitle"]', '[data-testid="player-metadata-subtitle"]'],
    fromTitle: (t) => {
      const s = tidy(t.replace(/^Watch\s+/i, '').replace(/\s+(Online\s+)?\|\s*Hulu.*$/i, '').replace(/\s*[-–|]\s*Hulu$/i, ''));
      return s && !/^hulu$/i.test(s) ? { show: s, episode: '' } : null;
    },
  },
  // play.hbomax.com/video/watch/<id>/<id> (and the old play.max.com)
  hbomax: {
    platform: 'hbomax',
    id: (u) => /\/video\/watch\/([0-9a-z-]{8,})/i.exec(u.pathname)?.[1] || null,
    showSel: ['[data-testid="player-ux-asset-title"]'],
    episodeSel: ['[data-testid="player-ux-season-episode"]', '[data-testid="player-ux-asset-subtitle"]'],
    fromTitle: (t) => {
      const s = tidy(t.replace(/\s*[•|–-]\s*(HBO\s*)?Max.*$/i, ''));
      return s && !/^(hbo\s*)?max$/i.test(s) ? { show: s, episode: '' } : null;
    },
  },
  // www.crunchyroll.com/watch/<id>/<slug>; the player is either on the page or in a frame from static.crunchyroll.com
  crunchyroll: {
    platform: 'crunchyroll',
    id: (u) => /\/watch\/([A-Z0-9]{6,})/i.exec(u.pathname)?.[1] || null,
    playerFrame: 'iframe[src*="static.crunchyroll.com/vilos"], iframe.video-player',
    // (the tab's title, "Season 1 Maomao - Watch on Crunchyroll", doesn't name the show: its structured data does)
  },
};

const HOST_SITE: [RegExp, string][] = [
  [/(^|\.)hotstar\.com$/, 'hotstar'],
  [/(^|\.)sonyliv\.com$/, 'sonyliv'],
  [/(^|\.)zee5\.com$/, 'zee5'],
  [/(^|\.)disneyplus\.com$/, 'disney'],
  [/(^|\.)hulu\.com$/, 'hulu'],
  [/(^|\.)(hbomax|max)\.com$/, 'hbomax'],
  [/(^|\.)crunchyroll\.com$/, 'crunchyroll'],
];

export function serviceFor(host: string): Adapter | null {
  for (const [re, id] of HOST_SITE) if (re.test(host)) return serviceAdapter(SITES[id]);
  return null;
}
