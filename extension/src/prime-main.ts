/**
 * Runs inside the Prime Video page itself, where Amazon's own web player lives.
 * Moving the <video> element to a new time directly breaks Prime's player
 * ("Video Unavailable"), so play / pause / seek go through Amazon's player
 * instead, which also says exactly which title is playing.
 * The extension asks over window.postMessage and this answers.
 */

type AnyObj = Record<string, any>;

/** Amazon's web player: it can seek, play and pause, and knows whether it's open and what's in it */
function isPlayer(o: unknown): o is AnyObj {
  if (!o || typeof o !== 'object') return false;
  const p = o as AnyObj;
  try {
    return typeof p.seek === 'function' && typeof p.play === 'function' && typeof p.pause === 'function' && 'isPlayerOpen' in p && 'currentTitleId' in p;
  } catch {
    return false;
  }
}

/** look through an object a couple of levels deep for the player (bounded, so it's always quick) */
function search(start: unknown, seen: Set<unknown>, budget: { n: number }, depth: number): AnyObj | null {
  if (!start || typeof start !== 'object' || seen.has(start) || budget.n-- <= 0) return null;
  seen.add(start);
  if (isPlayer(start)) return start as AnyObj;
  if (depth <= 0 || start instanceof Node || start instanceof Window) return null;
  let keys: string[];
  try {
    keys = Object.keys(start as object);
  } catch {
    return null;
  }
  for (const k of keys.slice(0, 60)) {
    let v: unknown;
    try {
      v = (start as AnyObj)[k];
    } catch {
      continue;
    }
    const hit = search(v, seen, budget, depth - 1);
    if (hit) return hit;
  }
  return null;
}

const fiberOf = (el: Element): AnyObj | null => {
  for (const k of Object.keys(el)) if (k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$')) return (el as unknown as AnyObj)[k];
  return null;
};

const ROOTS = '[id^="dv-web-player"], .dv-player-fullscreen, .webPlayerSDKContainer, .webPlayerContainer';

let cached: AnyObj | null = null;
let lookedAt = 0;

/** Find the player through the page's own components (the player screen and the page around it). */
function player(): AnyObj | null {
  try {
    if (cached && !cached.isPlayerDestroyed && cached.isPlayerOpen) return cached;
  } catch {
    cached = null;
  }
  // not open (or not found): look again, but not more than every second or so
  if (Date.now() - lookedAt < 1000) return cached;
  lookedAt = Date.now();
  cached = null;
  const seen = new Set<unknown>();
  const budget = { n: 40_000 };
  // the box with the film in it first (there can be an old, closed player in another box)
  const box = film()?.closest(ROOTS);
  const roots = [...new Set([...(box ? [box] : []), ...document.querySelectorAll(ROOTS)])];
  const starts: Element[] = [];
  for (const r of roots) {
    starts.push(r);
    // the player's own screen, and its controls
    r.querySelectorAll('*').forEach((el, i) => {
      if (i < 400) starts.push(el);
    });
  }
  let closed: AnyObj | null = null;
  for (const el of starts) {
    let f = fiberOf(el);
    for (let up = 0; f && up < 80; up++, f = f.return) {
      const fiber = f;
      const hit =
        search(fiber.memoizedProps, seen, budget, 3) ||
        (fiber.stateNode && !(fiber.stateNode instanceof Node) ? search(fiber.stateNode, seen, budget, 3) : null) ||
        (() => {
          let s = fiber.memoizedState;
          for (let i = 0; s && i < 40; i++, s = s.next) {
            const h = search(s.memoizedState, seen, budget, 3);
            if (h) return h;
          }
          return null;
        })();
      if (hit) {
        try {
          if (hit.isPlayerOpen && !hit.isPlayerDestroyed) return (cached = hit);
        } catch {
          // keep looking
        }
        closed = closed || hit;
      }
      if (budget.n <= 0) return (cached = closed);
    }
  }
  return (cached = closed);
}

/** the film's <video>: the biggest playing picture inside a player box */
function film(): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null;
  let area = 0;
  document.querySelectorAll('video').forEach((v) => {
    if (v.readyState === 0 || !(v.duration > 0) || !v.closest(ROOTS)) return;
    const r = v.getBoundingClientRect();
    if (r.width * r.height > area) {
      area = r.width * r.height;
      best = v;
    }
  });
  return best;
}

/*
 * With ads (Prime in India, and free titles), the ads are stitched into the
 * film itself, so the <video>'s clock runs ahead of the story by however many
 * ads you've seen, and your person may have seen different ones. Amazon's
 * player knows where you are in the story ("content" time, without ads):
 * tell the extension a few times a second, with the <video>'s clock at that
 * moment, so it can line the two of you up by the story instead.
 */
function tick() {
  let msg: { vt: number; content: number | null; ad: boolean } | null = null;
  try {
    const v = film();
    const p = v ? player() : null;
    const c = p?.isPlayerOpen ? p.currentTime : null;
    if (v && c && typeof c.currentPosition === 'number' && (!c.unit || c.unit === 'ContentMillis')) {
      const items: AnyObj[] = p?.timeline?.items || [];
      const i: number = c.currentTimelineItemIndex ?? -1;
      const item = items[i];
      // the film's own pieces are "<title>_main"; anything else in the timeline is an ad
      const ad = !!item && !String(item.contentId || '').endsWith('_main');
      let content: number | null = c.currentPosition / 1000;
      if (ad) {
        // during an ad you're paused at the break, as far as the story goes
        let j = i;
        while (j >= 0 && !String(items[j]?.contentId || '').endsWith('_main')) j--;
        // (an ad before the film starts holds you at the very beginning)
        content = j >= 0 && typeof items[j].endTime === 'number' ? items[j].endTime / 1000 : 0;
      }
      msg = { vt: v.currentTime, content, ad };
    }
  } catch {
    msg = null;
  }
  if (msg) window.postMessage({ source: 'soultied-pv-tick', ...msg }, location.origin);
}

function onAsk(ev: MessageEvent) {
  if (ev.source !== window) return;
  const d = ev.data as { source?: string; id?: number; cmd?: string; arg?: number } | undefined;
  if (!d || d.source !== 'soultied-pv') return;
  let ok = false;
  let out: unknown = null;
  try {
    const p = player();
    if (p && p.isPlayerOpen) {
      if (d.cmd === 'seek' && typeof d.arg === 'number') {
        // Amazon's player seeks in story time, in milliseconds (past an ad break, it plays the ads first)
        p.seek(Math.max(0, Math.round(d.arg * 1000)));
        ok = true;
      } else if (d.cmd === 'play') {
        void Promise.resolve(p.play()).catch(() => undefined);
        ok = true;
      } else if (d.cmd === 'pause') {
        p.pause();
        ok = true;
      } else if (d.cmd === 'id') {
        out = typeof p.currentTitleId === 'string' && p.currentTitleId ? p.currentTitleId : null;
        ok = !!out;
      }
    }
  } catch {
    ok = false;
  }
  window.postMessage({ source: 'soultied-pv-reply', id: d.id, ok, out }, location.origin);
}

// The extension puts this in again after it updates; the copy that's already here keeps answering.
const w = window as unknown as { __soultiedPv?: boolean };
if (!w.__soultiedPv) {
  w.__soultiedPv = true;
  window.addEventListener('message', onAsk);
  window.setInterval(tick, 400);
}
