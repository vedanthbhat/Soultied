import { randomAvatar } from '../../src/pixel/character';
import {
  partyIdFrom,
  partyLink,
  PLUS_URL,
  plusCodeKey,
  watchUrl,
  type ExtMsg,
  type HubMsg,
  type PartyReply,
  type PartyRequest,
  type PlusReply,
  type Session,
  type TitleInfo,
} from '../../src/stream/protocol';
import type { FromOffscreen, OpenReply, PartyMe, ToOffscreen } from './offscreen';

/**
 * The switchboard. Every Netflix / Prime tab connects as a "player". What
 * carries everything to and from your person is one of:
 * - your Soultied tab (a "hub"), already signed in to your place; or
 * - a watch party from a link (no Soultied place needed), run by the
 *   extension's own hidden page (offscreen.ts). While you're in one, it's in
 *   charge.
 * Messages from players go to whichever of those is in charge, and everything
 * it says goes to every player.
 */

/** Soultied's home: the first address the bridge runs on (see manifest.json). */
const DEFAULT_HUB = (() => {
  const bridge = chrome.runtime.getManifest().content_scripts?.find((c) => c.js?.includes('bridge.js'));
  return (bridge?.matches[0] || 'https://soultied.app/*').replace(/\*$/, '');
})();

/** Where a Soultied tab lives, as Chrome reports it (not as the page claims). */
function pageUrl(port: chrome.runtime.Port) {
  try {
    const u = new URL(port.sender?.url || '');
    return u.protocol === 'https:' || u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? u.origin + u.pathname : null;
  } catch {
    return null;
  }
}

/** what a Netflix / Prime tab tells us about itself, for the toolbar window */
interface PlayerStatus {
  platform: 'netflix' | 'prime';
  video: boolean;
  connected: boolean;
  watching: string | null;
  partnerHere: boolean;
  partnerWatching: string | null;
  /** what's on in that tab (a new watch party starts with it) */
  title?: TitleInfo | null;
}

type PlayerMsg =
  | ExtMsg
  | { kind: 'openHub' }
  | { kind: 'status'; status: PlayerStatus }
  | { kind: 'startParty'; name: string }
  | { kind: 'joinParty'; link: string; name: string }
  | { kind: 'redeem'; code: string };
type ToPlayer =
  | HubMsg
  | { kind: 'nohub' }
  | { kind: 'partyStarted'; link: string }
  | { kind: 'partyError'; error: string }
  | { kind: 'joined'; url: string | null }
  | { kind: 'plusResult'; res: PlusReply };

const hubs: chrome.runtime.Port[] = [];
const players = new Set<chrome.runtime.Port>();
const statuses = new Map<chrome.runtime.Port, PlayerStatus & { tabId: number | null }>();
/** from your Soultied tab */
let siteSession: Session | null = null;
let siteVoice: HubMsg | null = null;

/* ---------------- the watch party (if you're in one) ---------------- */

let party: { id: string } | null = null;
let partySession: Session | null = null;
/** the hidden page has the party open (and answered with who's in it) */
let partyOpen: Promise<boolean> | null = null;
// this worker sleeps and wakes; the party you're in is kept on this computer
const stored = chrome.storage.local.get('party').then((r) => {
  party = (r.party as { id: string } | undefined) || null;
});

const hub = () => hubs[hubs.length - 1] || null;
const session = () => (party ? partySession : hub() ? siteSession : null);

/* ---------------- Soultied Plus (kept on this computer: the code you added, and until when) ---------------- */

interface PlusSaved {
  code: string;
  hash: string;
  until: number;
}

async function plusSaved(): Promise<PlusSaved | null> {
  const r = await chrome.storage.local.get('plus');
  const p = r.plus as PlusSaved | undefined;
  return p && p.until > Date.now() ? p : null;
}

async function sha256(text: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/** Add a Plus code to this browser (it's checked against Soultied's list), and use it for the party you're in. */
async function redeem(code: string): Promise<PlusReply> {
  const key = plusCodeKey(code);
  if (key.length < 8) return { ok: false, error: 'invalid' };
  const r = await ask<PlusReply>({ op: 'redeem', key });
  if (!r) return { ok: false, error: 'offline' };
  if (r.ok) {
    await chrome.storage.local.set({ plus: { code: key, hash: await sha256(key), until: r.until } satisfies PlusSaved });
    tellParty({ op: 'plus', plus: await plusSaved() });
  } else if (!party && players.size === 0) void chrome.offscreen.closeDocument().catch(() => undefined);
  return r;
}

/* ---------------- the toolbar button, per Netflix / Prime tab ---------------- */

function badge(tabId: number | null, s: PlayerStatus | null) {
  if (tabId == null) return;
  const text = !s ? '' : s.connected ? 'ON' : '+';
  const title = !s
    ? 'Soultied: watch together'
    : s.connected
      ? s.partnerHere
        ? 'Soultied: watching together'
        : 'Soultied: waiting for your person'
      : 'Start a Soultied watch party';
  void chrome.action.setBadgeText({ tabId, text }).catch(() => undefined);
  void chrome.action.setBadgeBackgroundColor({ tabId, color: s?.connected ? '#6a7856' : '#b8674f' }).catch(() => undefined);
  void chrome.action.setTitle({ tabId, title }).catch(() => undefined);
}

function toPlayers(msg: ToPlayer) {
  players.forEach((p) => {
    try {
      p.postMessage(msg);
    } catch {
      // that tab is going away
    }
  });
}

/** your Soultied tab */
function toSite(msg: ExtMsg) {
  const h = hub();
  if (!h) return false;
  try {
    h.postMessage(msg);
    return true;
  } catch {
    return false;
  }
}

function toHub(msg: ExtMsg) {
  if (party) {
    void toParty({ op: 'ext', msg });
    return true;
  }
  return toSite(msg);
}

/* ---------------- the hidden page that runs watch parties ---------------- */

type Ask = ToOffscreen extends infer T ? (T extends ToOffscreen ? Omit<T, 'to'> : never) : never;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hasOffscreen = () => chrome.offscreen.hasDocument().catch(() => false);

async function ensureOffscreen() {
  if (await hasOffscreen()) return;
  await chrome.offscreen
    .createDocument({
      url: 'offscreen.html',
      reasons: ['LOCAL_STORAGE'],
      justification: 'Keeps a watch party connected: it stays signed in (anonymously) and passes play, pause and chat between the two people watching.',
    })
    .catch((err: Error) => {
      // opened by another call a moment ago
      if (!/single offscreen/i.test(String(err?.message))) throw err;
    });
}

/** Ask the hidden page something (opening it first), waiting a moment if it's still starting up. */
async function ask<T>(m: Ask): Promise<T | undefined> {
  await ensureOffscreen();
  for (let i = 0; i < 30; i++) {
    try {
      const r = await chrome.runtime.sendMessage({ to: 'offscreen', ...m });
      if (r !== undefined) return r as T;
    } catch {
      // not listening yet
    }
    await sleep(100);
  }
  return undefined;
}

/** Tell the hidden page something, only if it's already running the party (never opens it). */
function tellParty(m: Ask) {
  if (!party || !partyOpen) return;
  void partyOpen.then((ok) => ok && chrome.runtime.sendMessage({ to: 'offscreen', ...m }).catch(() => undefined));
}

function setPartySession(s: Session | null) {
  partySession = s;
  if (party) toPlayers({ kind: 'session', session: s });
}

/** Make sure the hidden page has your party open (after Chrome put things to sleep). */
function ensureParty(): Promise<boolean> {
  if (!party) return Promise.resolve(false);
  if (!partyOpen) {
    const id = party.id;
    partyOpen = ask<OpenReply>({ op: 'open', id }).then(async (r) => {
      if (party?.id !== id) return false;
      if (!r?.ok) {
        partyOpen = null;
        // the party's gone (or this browser isn't in it any more): back to normal
        if (r?.error === 'gone') await endParty(false);
        return false;
      }
      setPartySession(r.session);
      void plusSaved().then((plus) => tellParty({ op: 'plus', plus }));
      return true;
    });
  }
  return partyOpen;
}

async function toParty(m: Ask) {
  if (await ensureParty()) await chrome.runtime.sendMessage({ to: 'offscreen', ...m }).catch(() => undefined);
}

/** Your name and pixel character for watch parties (from your Soultied place, if you have one). */
async function partyMe(name: string): Promise<PartyMe> {
  const r = await chrome.storage.local.get(['me', 'lastSession']);
  const saved = r.me as PartyMe | undefined;
  const place = (r.lastSession as Session | undefined)?.me;
  const me: PartyMe = {
    name: name.trim().slice(0, 40) || saved?.name || place?.name || 'Me',
    avatar: saved?.avatar || place?.avatar || randomAvatar(),
  };
  await chrome.storage.local.set({ me });
  return me;
}

async function savedName() {
  const r = await chrome.storage.local.get(['me', 'lastSession']);
  return (r.me as PartyMe | undefined)?.name || (r.lastSession as Session | undefined)?.me.name || '';
}

async function enterParty(id: string, s: Session | null) {
  const before = party;
  party = { id };
  partyOpen = Promise.resolve(true);
  await chrome.storage.local.set({ party });
  // your Soultied tab can rest while the party has the remote
  if (!before) toSite({ kind: 'bye' });
  setPartySession(s);
  if (players.size) tellParty({ op: 'ext', msg: { kind: 'hello' } });
  tellParty({ op: 'plus', plus: await plusSaved() });
}

async function startParty(name: string, title: TitleInfo | null): Promise<{ ok: true; link: string } | { ok: false; error: string }> {
  if (party) await endParty(true);
  const r = await ask<OpenReply>({ op: 'create', me: await partyMe(name), title });
  if (!r?.ok) return { ok: false, error: r?.error || 'failed' };
  await enterParty(r.id, r.session);
  return { ok: true, link: partyLink(r.id, DEFAULT_HUB) };
}

async function joinParty(id: string, name: string): Promise<PartyReply> {
  const me = await partyMe(name);
  if (party && party.id !== id) {
    if (await hasOffscreen()) await chrome.runtime.sendMessage({ to: 'offscreen', op: 'leave' }).catch(() => undefined);
    partyOpen = null;
  }
  const r = await ask<OpenReply>({ op: 'join', id, me });
  if (!r?.ok) return { ok: false, error: r?.error === 'gone' || !r ? 'failed' : r.error };
  if (party && party.id !== id) await endParty(false);
  await enterParty(r.id, r.session);
  return { ok: true, op: 'join', url: r.title ? watchUrl(r.title) : null };
}

async function endParty(tell: boolean) {
  if (!party) return;
  party = null;
  partySession = null;
  partyOpen = null;
  await chrome.storage.local.remove('party');
  if (tell && (await hasOffscreen())) await chrome.runtime.sendMessage({ to: 'offscreen', op: 'leave' }).catch(() => undefined);
  await chrome.offscreen.closeDocument().catch(() => undefined);
  // back to your Soultied place, if its tab is open (it says who you are again when asked)
  if (hub() && siteSession) {
    toPlayers({ kind: 'session', session: siteSession });
    if (siteVoice) toPlayers(siteVoice);
  } else toPlayers({ kind: 'nohub' });
  if (players.size) toSite({ kind: 'hello' });
}

/* ---------------- tabs ---------------- */

async function openHub() {
  const h = hub();
  const tab = h?.sender?.tab;
  if (tab?.id != null) {
    await chrome.tabs.update(tab.id, { active: true }).catch(() => undefined);
    if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true }).catch(() => undefined);
    return;
  }
  const { hubUrl } = await chrome.storage.local.get('hubUrl');
  await chrome.tabs.create({ url: hubUrl || DEFAULT_HUB, active: true });
}

const activeTab = () => chrome.tabs.query({ active: true, currentWindow: true }).then((t) => t[0] as chrome.tabs.Tab | undefined, () => undefined);

const isShowPage = (url: string) => {
  try {
    const h = new URL(url).hostname;
    return h.endsWith('netflix.com') || h.endsWith('primevideo.com') || (/(^|\.)amazon\./.test(h) && url.includes('/gp/video'));
  } catch {
    return false;
  }
};

const tellPlayerCount = () => tellParty({ op: 'players', count: players.size });

function onPlayer(port: chrome.runtime.Port, msg: PlayerMsg) {
  if (msg.kind === 'openHub') {
    void openHub();
    return;
  }
  if (msg.kind === 'status') {
    const tabId = port.sender?.tab?.id ?? null;
    const before = statuses.get(port);
    statuses.set(port, { ...msg.status, tabId });
    if (!before || before.connected !== msg.status.connected || before.partnerHere !== msg.status.partnerHere) badge(tabId, msg.status);
    return;
  }
  if (msg.kind === 'joinParty') {
    const id = partyIdFrom(msg.link);
    const reply = (m: ToPlayer) => {
      try {
        port.postMessage(m);
      } catch {
        // that tab closed
      }
    };
    if (!id) return reply({ kind: 'partyError', error: 'link' });
    void joinParty(id, msg.name).then((r) => reply(r.ok ? { kind: 'joined', url: r.op === 'join' ? r.url : null } : { kind: 'partyError', error: r.error }));
    return;
  }
  if (msg.kind === 'redeem') {
    void redeem(msg.code).then((res) => {
      try {
        port.postMessage({ kind: 'plusResult', res } satisfies ToPlayer);
      } catch {
        // that tab closed
      }
    });
    return;
  }
  if (msg.kind === 'startParty') {
    const title = statuses.get(port)?.title || null;
    void startParty(msg.name, title).then((r) => {
      try {
        port.postMessage((r.ok ? { kind: 'partyStarted', link: r.link } : { kind: 'partyError', error: r.error }) satisfies ToPlayer);
      } catch {
        // that tab closed
      }
    });
    return;
  }
  if (!toHub(msg) && msg.kind === 'hello') port.postMessage({ kind: 'nohub' } satisfies ToPlayer);
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'hub') {
    hubs.push(port);
    port.onMessage.addListener((msg: HubMsg) => {
      // with two Soultied tabs open, the newest one does the talking
      if (port !== hub()) return;
      if (msg.kind === 'session') {
        siteSession = msg.session;
        const hubUrl = pageUrl(port);
        if (msg.session) void chrome.storage.local.set({ lastSession: msg.session, ...(hubUrl ? { hubUrl } : {}) });
      }
      if (msg.kind === 'voice') siteVoice = msg;
      void stored.then(() => {
        if (!party) toPlayers(msg);
      });
    });
    port.onDisconnect.addListener(() => {
      hubs.splice(hubs.indexOf(port), 1);
      const next = hub();
      void stored.then(() => {
        if (party) return;
        if (!next) {
          siteSession = null;
          toPlayers({ kind: 'nohub' });
        } else if (players.size) next.postMessage({ kind: 'hello' } satisfies ExtMsg);
      });
    });
    void stored.then(() => {
      if (players.size && !party) port.postMessage({ kind: 'hello' } satisfies ExtMsg);
    });
    return;
  }

  if (port.name === 'player') {
    players.add(port);
    port.onMessage.addListener((msg: PlayerMsg) => void stored.then(() => onPlayer(port, msg)));
    port.onDisconnect.addListener(() => {
      players.delete(port);
      badge(statuses.get(port)?.tabId ?? null, null);
      statuses.delete(port);
      if (!players.size) toHub({ kind: 'bye' });
      tellPlayerCount();
    });
    void stored.then(() => {
      if (party) void ensureParty().then(tellPlayerCount);
      const s = session();
      if (!s) return;
      port.postMessage({ kind: 'session', session: s } satisfies ToPlayer);
      if (!party && siteVoice) port.postMessage(siteVoice);
    });
  }
});

/* ---------------- messages: the toolbar window, the join page, the hidden page ---------------- */

type PopupMsg =
  | { kind: 'popup' }
  | { kind: 'openHub' }
  | { kind: 'openSite' }
  | { kind: 'startParty'; name: string }
  | { kind: 'joinParty'; link: string; name: string }
  | { kind: 'leaveParty' }
  | { kind: 'openPlus' }
  /** a Soultied Plus code: typed in the toolbar window, or handed over by the Plus page (through the bridge) */
  | { kind: 'plusCode'; code: string }
  /** from the join page on Soultied's site, through the bridge */
  | { kind: 'party'; req: PartyRequest };

async function popupState() {
  await stored;
  const [r, tab] = await Promise.all([chrome.storage.local.get('lastSession'), activeTab()]);
  // after Chrome has put this worker to sleep and woken it, the names come from the last session we saw
  const s = session() || (party ? null : (r.lastSession as Session | undefined)) || null;
  const list = [...statuses.values()];
  // the tab you're looking at first, so the window talks about the show in front of you
  list.sort((a, b) => Number(b.tabId === tab?.id) - Number(a.tabId === tab?.id));
  return {
    hub: !!hub(),
    me: s?.me.name || null,
    partner: s?.partner?.name || null,
    place: party ? null : s?.place || null,
    players: list,
    // a Netflix / Prime tab the extension isn't running in (opened before it was installed)
    stale: !!tab?.id && !!tab.url && isShowPage(tab.url) && !list.some((p) => p.tabId === tab.id),
    onShow: !!tab?.url && isShowPage(tab.url),
    party: party ? { link: partyLink(party.id, DEFAULT_HUB), partner: partySession?.partner?.name || null } : null,
    name: await savedName(),
    site: DEFAULT_HUB,
    plus: await plusSaved().then((p) => (p ? { until: p.until, code: p.code } : null)),
    partyPlus: party ? partySession?.party?.plusUntil || null : null,
  };
}

async function onRequest(msg: PopupMsg, sender: { tab?: { id?: number } }): Promise<unknown> {
  await stored;
  switch (msg.kind) {
    case 'popup':
      return popupState();
    case 'openHub':
      await openHub();
      return { ok: true };
    case 'openSite':
      await chrome.tabs.create({ url: DEFAULT_HUB, active: true });
      return { ok: true };
    case 'startParty': {
      const tab = await activeTab();
      const here = [...statuses.values()].find((p) => p.tabId === tab?.id);
      return startParty(msg.name, here?.title || null);
    }
    case 'joinParty': {
      const id = partyIdFrom(msg.link);
      if (!id) return { ok: false, error: 'link' };
      const r = await joinParty(id, msg.name);
      if (r.ok && r.op === 'join') {
        // go to the show: in this tab if it's a Netflix / Prime one, otherwise a new one
        const url = r.url || 'https://www.netflix.com/browse';
        const tab = await activeTab();
        if (tab?.id != null && tab.url && isShowPage(tab.url)) await chrome.tabs.update(tab.id, { url });
        else await chrome.tabs.create({ url, active: true });
      }
      return r;
    }
    case 'leaveParty':
      await endParty(true);
      return { ok: true };
    case 'openPlus':
      await chrome.tabs.create({ url: PLUS_URL, active: true });
      return { ok: true };
    case 'plusCode':
      return redeem(msg.code);
    case 'party': {
      // only Soultied's own pages get here (that's where the bridge runs)
      if (!sender.tab) return { ok: false, error: 'failed' };
      const req = msg.req;
      if (req.op === 'peek') {
        const r = await ask<PartyReply>({ op: 'peek', id: req.id });
        if (!r) return { ok: false, error: 'offline' } satisfies PartyReply;
        return r.ok && r.op === 'peek' && !r.name ? { ...r, name: await savedName() } : r;
      }
      return joinParty(req.id, req.name);
    }
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // from the hidden page that runs watch parties
  if (msg?.to === 'background' && msg.from === 'party') {
    const m = msg as FromOffscreen;
    void stored.then(() => {
      if ('idle' in m) {
        // nothing's been open for a while (or there's no party): let it close (it opens again when needed)
        if (!party || !players.size) {
          partyOpen = null;
          void chrome.offscreen.closeDocument().catch(() => undefined);
        }
        return;
      }
      if (!party) return;
      if (m.msg.kind === 'session') setPartySession(m.msg.session);
      else toPlayers(m.msg);
    });
    return;
  }
  if (msg?.to) return; // for the hidden page
  if (!msg?.kind) return;
  void onRequest(msg as PopupMsg, sender).then(reply, () => reply({ ok: false, error: 'failed' }));
  return true; // answering in a moment
});

/*
 * Chrome only runs an extension's scripts in pages opened after it's installed
 * or updated. So that an open Netflix, Prime or Soultied tab works straight
 * away (without a refresh), put the scripts into those tabs now. Each script
 * checks whether a working copy is already there.
 */
chrome.runtime.onInstalled.addListener(() => {
  for (const cs of chrome.runtime.getManifest().content_scripts || []) {
    void chrome.tabs
      .query({ url: cs.matches })
      .then((tabs) => {
        for (const t of tabs) {
          if (t.id == null || t.discarded) continue;
          void chrome.scripting
            .executeScript({ target: { tabId: t.id, allFrames: !!cs.all_frames }, files: cs.js || [], world: cs.world === 'MAIN' ? 'MAIN' : 'ISOLATED' })
            .catch(() => undefined);
        }
      })
      .catch(() => undefined);
  }
});

// older builds had no toolbar window: the button opened Soultied
chrome.action.onClicked.addListener(() => void openHub());
