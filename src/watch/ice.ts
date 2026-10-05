/**
 * Where the video call finds a way through.
 *
 * Two people on ordinary home networks can usually reach each other directly
 * once a STUN server tells each of them their public address. Phones on mobile
 * data, college and office Wi-Fi, and some home routers won't allow that, so
 * the call also needs a TURN relay that passes the video along when a direct
 * line is blocked.
 *
 * A relay costs money to run, so it's set when the site is built:
 * - VITE_TURN_CREDENTIALS_URL: an address that hands out relay logins as JSON
 *   (an array of RTCIceServer, or { iceServers: [...] }), e.g. Metered's
 *   https://<app>.metered.live/api/v1/turn/credentials?apiKey=..., or a small
 *   Cloudflare Worker in front of Cloudflare's TURN service.
 * - VITE_ICE_SERVERS: the same JSON written out in full, for a relay with
 *   fixed logins.
 * Without either, calls still work wherever a direct line is possible.
 */

const STUN: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

const env = import.meta.env as Record<string, string | undefined>;
const CREDENTIALS_URL = env.VITE_TURN_CREDENTIALS_URL?.trim() || '';
const FIXED = env.VITE_ICE_SERVERS?.trim() || '';

/** relay logins usually last a day or so; fetch fresh ones well before that */
const FRESH_MS = 50 * 60 * 1000;

let cached: { at: number; servers: RTCIceServer[] } | null = null;
let inflight: Promise<RTCIceServer[]> | null = null;

function parse(json: unknown): RTCIceServer[] {
  const list = Array.isArray(json) ? json : (json as { iceServers?: unknown })?.iceServers;
  if (!Array.isArray(list)) return [];
  return list.filter((s): s is RTCIceServer => !!s && typeof s === 'object' && 'urls' in s && !!(s as RTCIceServer).urls);
}

function fixed(): RTCIceServer[] {
  if (!FIXED) return [];
  try {
    return parse(JSON.parse(FIXED));
  } catch {
    return [];
  }
}

/** True when the site was built with a relay, so a blocked direct line can still connect. */
export const hasRelay = () => !!CREDENTIALS_URL || fixed().some((s) => [s.urls].flat().some((u) => /^turns?:/.test(u)));

/** What a call starts with before (or without) the relay: never waits on the network. */
export function iceNow(): RTCIceServer[] {
  return cached ? cached.servers : [...STUN, ...fixed()];
}

/** STUN plus the relay, if there is one. Never throws: falls back to STUN alone. */
export function loadIce(): Promise<RTCIceServer[]> {
  if (cached && Date.now() - cached.at < FRESH_MS) return Promise.resolve(cached.servers);
  if (!CREDENTIALS_URL) {
    cached = { at: Date.now(), servers: [...STUN, ...fixed()] };
    return Promise.resolve(cached.servers);
  }
  if (inflight) return inflight;
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = window.setTimeout(() => ctl?.abort(), 10_000);
  inflight = fetch(CREDENTIALS_URL, { signal: ctl?.signal, cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((json) => {
      const relay = parse(json);
      const servers = [...STUN, ...fixed(), ...relay];
      // a failed fetch isn't remembered for long, so the next call tries again
      cached = { at: relay.length ? Date.now() : Date.now() - FRESH_MS + 30_000, servers };
      return servers;
    })
    .catch(() => {
      cached = { at: Date.now() - FRESH_MS + 30_000, servers: [...STUN, ...fixed()] };
      return cached.servers;
    })
    .finally(() => {
      window.clearTimeout(timer);
      inflight = null;
    });
  return inflight;
}
