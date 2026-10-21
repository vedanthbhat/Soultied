import type { AvatarConfig } from '../types';
import type { ReactionKind } from '../pixel/watchRoom';

/**
 * Watching Netflix, Prime Video and the other streaming sites in SERVICES together.
 *
 * Three pieces talk to each other:
 * - the Soultied browser extension, which sits on the streaming site's page and
 *   drives the player (play, pause, seek) and draws the chat and couch on top;
 * - your Soultied tab (the "hub"), which is already signed in, so it carries
 *   everything to and from your person over the online live channel, and runs
 *   the cameras and push-to-talk;
 * - your person's Soultied tab and extension, doing the same on their side.
 *
 * Or, without a Soultied place: a watch party. One of you starts it from the
 * extension and sends the link; the extension itself (signed in anonymously)
 * carries everything between the two of you instead of a Soultied tab.
 *
 * This file is shared by the web app and the extension.
 */

export type Platform = 'netflix' | 'prime' | 'hotstar' | 'sonyliv' | 'zee5' | 'disney' | 'hulu' | 'hbomax' | 'crunchyroll';

/** Each streaming service Soultied works on: its name, and where to open it. `beta`: newer, less tried. */
export const SERVICES: Record<Platform, { name: string; home: string; beta?: boolean }> = {
  netflix: { name: 'Netflix', home: 'https://www.netflix.com/browse' },
  prime: { name: 'Prime Video', home: 'https://www.primevideo.com/' },
  hotstar: { name: 'JioHotstar', home: 'https://www.hotstar.com/in/home', beta: true },
  sonyliv: { name: 'Sony LIV', home: 'https://www.sonyliv.com/', beta: true },
  zee5: { name: 'ZEE5', home: 'https://www.zee5.com/', beta: true },
  disney: { name: 'Disney+', home: 'https://www.disneyplus.com/', beta: true },
  hulu: { name: 'Hulu', home: 'https://www.hulu.com/', beta: true },
  hbomax: { name: 'HBO Max', home: 'https://play.hbomax.com/', beta: true },
  crunchyroll: { name: 'Crunchyroll', home: 'https://www.crunchyroll.com/', beta: true },
};
/** "Netflix", "JioHotstar"… (from a newer version: "the show") */
export const serviceName = (p: string | null | undefined) => (p && p in SERVICES ? SERVICES[p as Platform].name : 'the show');

export interface TitleInfo {
  platform: Platform;
  /** one episode or one film */
  key: string;
  /** the series (or the film itself), for the no-watching-ahead guard */
  showKey: string;
  show: string;
  /** e.g. "S2:E4 · The Pollywog", empty for films */
  episode: string;
  /** where to send your person to watch the same thing */
  url: string;
}

export interface Where {
  title: TitleInfo | null;
  /** seconds */
  pos: number;
  playing: boolean;
}

/** Between the two of you, over the live channel. */
export type StreamEvent =
  | ({ type: 'hello' | 'ping'; by: string; at: number; buffering?: boolean; why?: 'loading' | 'ad' | 'away' } & Where)
  | { type: 'bye'; by: string; at: number }
  | { type: 'play'; pos: number; key: string | null; by: string; at: number }
  | { type: 'pause'; pos: number; key: string | null; by: string; at: number }
  | { type: 'seek'; pos: number; playing: boolean; key: string | null; by: string; at: number }
  | ({ type: 'state'; by: string; at: number; reply?: boolean } & Where)
  /** waiting for me: the picture's loading, an ad, or I've stepped away from the tab (`why`, newer versions) */
  | { type: 'buffering'; on: boolean; pos: number; why?: 'loading' | 'ad' | 'away'; by: string; at: number }
  /** I left the watch party (not just this tab) */
  | { type: 'leave'; by: string; at: number }
  | { type: 'title'; title: TitleInfo; from: string | null; by: string; at: number }
  | { type: 'chat'; id: string; text: string; by: string; at: number }
  | { type: 'react'; kind: ReactionKind; by: string; at: number }
  /** "only I can pause and skip" */
  | { type: 'lock'; on: boolean; by: string; at: number }
  /** countdown start: ready to go */
  | { type: 'ready'; on: boolean; by: string; at: number }
  | { type: 'countdown'; pos: number; inMs: number; key: string | null; by: string; at: number }
  // cameras and voice (a Soultied tab handles them for a place; the show tab itself in a Plus watch party; same shapes as the YouTube room)
  | { type: 'rtc'; to: string; by: string; at: number; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null }
  | { type: 'media'; cam: boolean; talking: boolean; mic?: boolean; by: string; at: number };

export interface Person {
  id: string;
  name: string;
  avatar: AvatarConfig;
}

export interface TogetherLog {
  /** episodes and films you've watched together, by key */
  seen: Record<string, { show: string; episode: string; at: number }>;
  /** per show: where the two of you left off */
  shows: Record<string, { show: string; episode: string; key: string; url: string; pos: number; at: number }>;
}

export const emptyLog = (): TogetherLog => ({ seen: {}, shows: {} });

export interface Session {
  me: Person;
  partner: Person | null;
  /** who sits on the left of the couch (whoever made the place), so both of you see the same couch */
  leftId: string;
  place: string;
  /** how close you sit on the couch, 0 (the two ends) to 1 (side by side) */
  closeness: number;
  log: TogetherLog;
  /** the Soultied page to come back to */
  hubUrl: string;
  /** a watch party from a link, rather than your Soultied place */
  party?: PartyInfo;
  /** your Soultied place has Plus (cameras and voice); false: holding T explains Plus instead */
  plus?: boolean;
}

/** A watch party: two people, no Soultied place needed. Voice and cameras come with Soultied Plus. */
export interface PartyInfo {
  id: string;
  /** the link to send your person */
  link: string;
  /** Soultied Plus covers this party until then (ms): cameras and voice for both of you. One of you having it is enough. */
  plusUntil?: number | null;
  /** your person left the party (they're back if they open the link again) */
  partnerLeft?: boolean;
}

/** Where to get Soultied Plus. */
export const PLUS_URL = 'https://soultied.app/plus/';
/** The Soultied extension on the Chrome Web Store (Chrome, Edge and Brave install it from here). */
export const EXTENSION_STORE_URL = 'https://chromewebstore.google.com/detail/soultied-watch-together/hcfmbadgbnfdkebllinmonemahalikcn';
/** Where to rate the extension (its reviews on the Chrome Web Store). */
export const EXTENSION_REVIEW_URL = `${EXTENSION_STORE_URL}/reviews`;

/** Soultied Plus's monthly price where you are, as the Plus page shows it first (rupees in India, dollars elsewhere). */
export function plusFrom() {
  let tz = '';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
  } catch {
    // no time zone: say dollars
  }
  return /^Asia\/(Kolkata|Calcutta)$/.test(tz) ? '₹149 a month' : '$3.99 a month';
}

/** A Plus code as typed ("abcd-efgh-jkmn", with spaces or not) -> the letters that matter. */
export const plusCodeKey = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** What adding a Plus code answers. */
export type PlusReply =
  | { ok: true; until: number }
  /** invalid: no such code · expired: its time is up · full: already used on three browsers */
  | { ok: false; error: 'invalid' | 'expired' | 'full' | 'offline' | 'failed' };

/** Soultied's website, where watch-party links open. */
export const SITE = 'https://soultied.app/';
export const partyLink = (id: string, site = SITE) => `${site.replace(/\/?$/, '/')}join/#${id}`;
/** the party id in a link (or a bare id) */
export function partyIdFrom(text: string) {
  const m = /(?:join\/?#|^)([A-Za-z0-9]{16,40})\s*$/.exec(text.trim());
  return m ? m[1] : null;
}

/** Where to send someone to watch a title (Prime Video's title pages need asking to play). */
export const watchUrl = (t: TitleInfo) => (t.platform === 'prime' ? `${t.url}${t.url.includes('?') ? '&' : '?'}autoplay=1` : t.url);

/** The join page asks the extension about a party link (through the bridge). */
export type PartyRequest = { op: 'peek'; id: string } | { op: 'join'; id: string; name: string };
export type PartyReply =
  | { ok: true; op: 'peek'; host: string; title: TitleInfo | null; member: boolean; full: boolean; name: string }
  /** where to go: what's on in the party (or nothing yet) */
  | { ok: true; op: 'join'; url: string | null }
  | { ok: false; error: 'missing' | 'full' | 'offline' | 'failed' };

/**
 * The cameras-and-voice call in a Plus watch party, as the show tabs see it. The call itself runs in the
 * extension's hidden page (so it carries on while you switch shows); tabs get its state, send it what you
 * press, and get the pictures over a local link.
 */
export interface CallFlags {
  camOn: boolean;
  micReady: boolean;
  micOpen: boolean;
  talking: boolean;
  partnerCam: boolean;
  partnerMic: boolean;
  partnerTalking: boolean;
  link: 'idle' | 'connecting' | 'connected' | 'lost';
  stuck: boolean;
  busy: 'cam' | 'mic' | null;
  error: string | null;
  /** waiting for you to allow the camera and mic (a small Soultied window asks) */
  asking: boolean;
  /** 0–1: how loud your voice goes out, and how loud theirs plays (1 = as it is) */
  micVolume: number;
  speakerVolume: number;
  /** voice isolation on your mic (background noise out, quiet between words); null: not available here */
  isolation: boolean | null;
}

/** what you press in a show tab, for the call */
export type CallCmd =
  | { op: 'camera'; on: boolean }
  | { op: 'mic'; open: boolean }
  | { op: 'talk'; down: boolean }
  | { op: 'micVolume'; v: number }
  | { op: 'speakerVolume'; v: number }
  | { op: 'isolation'; on: boolean };

/** Soultied tab -> extension */
export type HubMsg =
  | { kind: 'session'; session: Session | null }
  | { kind: 'event'; e: StreamEvent }
  /** the watch party's call (null: no call, e.g. no Plus) */
  | { kind: 'call'; flags: CallFlags | null }
  /** who's talking (to turn the show down), and whether the cameras window is open */
  | { kind: 'voice'; mine: boolean; partner: boolean; cams: boolean };

/** extension -> Soultied tab */
export type ExtMsg =
  | { kind: 'hello' }
  | { kind: 'send'; e: StreamEvent }
  | { kind: 'watched'; title: TitleInfo; pos: number }
  | { kind: 'ptt'; down: boolean }
  | { kind: 'bye' };

/** window.postMessage tags between the Soultied page and the extension's bridge */
export const HUB_SOURCE = 'soultied-hub';
export const EXT_SOURCE = 'soultied-ext';

export type PageBody =
  | { kind: 'probe' }
  | { kind: 'hub' }
  | { kind: 'msg'; msg: HubMsg }
  | { kind: 'party'; rid: number; req: PartyRequest }
  /** the Plus page handing a fresh code to the extension */
  | { kind: 'plus'; rid: number; code: string };
export type BridgeBody =
  | { kind: 'present'; version: string }
  | { kind: 'msg'; msg: ExtMsg }
  | { kind: 'party'; rid: number; res: PartyReply }
  | { kind: 'plus'; rid: number; res: PlusReply };
export type PageToBridge = { source: typeof HUB_SOURCE } & PageBody;
export type BridgeToPage = { source: typeof EXT_SOURCE } & BridgeBody;

/** 1:02:05 / 42:10 */
export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const titleLabel = (t: TitleInfo | null) => (!t ? 'something' : t.episode ? `${t.show} ${t.episode.split(' · ')[0]}` : t.show);
