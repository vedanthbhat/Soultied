import type { ExtMsg, HubMsg, Session } from '../../src/stream/protocol';

/**
 * The switchboard. Your Soultied tab connects as a "hub" (it's signed in and
 * talks to your person); every Netflix / Prime tab connects as a "player".
 * Messages from players go to the newest hub, and everything the hub says goes
 * to every player.
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
}

type PlayerMsg = ExtMsg | { kind: 'openHub' } | { kind: 'status'; status: PlayerStatus };
type ToPlayer = HubMsg | { kind: 'nohub' };

const hubs: chrome.runtime.Port[] = [];
const players = new Set<chrome.runtime.Port>();
const statuses = new Map<chrome.runtime.Port, PlayerStatus>();
let session: Session | null = null;
let voice: HubMsg | null = null;

const hub = () => hubs[hubs.length - 1] || null;

function toPlayers(msg: ToPlayer) {
  players.forEach((p) => {
    try {
      p.postMessage(msg);
    } catch {
      // that tab is going away
    }
  });
}

function toHub(msg: ExtMsg) {
  const h = hub();
  if (!h) return false;
  try {
    h.postMessage(msg);
    return true;
  } catch {
    return false;
  }
}

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

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'hub') {
    hubs.push(port);
    port.onMessage.addListener((msg: HubMsg) => {
      // with two Soultied tabs open, the newest one does the talking
      if (port !== hub()) return;
      if (msg.kind === 'session') {
        session = msg.session;
        const hubUrl = pageUrl(port);
        if (msg.session) void chrome.storage.local.set({ lastSession: msg.session, ...(hubUrl ? { hubUrl } : {}) });
      }
      if (msg.kind === 'voice') voice = msg;
      toPlayers(msg);
    });
    port.onDisconnect.addListener(() => {
      hubs.splice(hubs.indexOf(port), 1);
      const next = hub();
      if (!next) {
        session = null;
        toPlayers({ kind: 'nohub' });
      } else if (players.size) next.postMessage({ kind: 'hello' } satisfies ExtMsg);
    });
    if (players.size) port.postMessage({ kind: 'hello' } satisfies ExtMsg);
    return;
  }

  if (port.name === 'player') {
    players.add(port);
    port.onMessage.addListener((msg: PlayerMsg) => {
      if (msg.kind === 'openHub') {
        void openHub();
        return;
      }
      if (msg.kind === 'status') {
        statuses.set(port, msg.status);
        return;
      }
      if (!toHub(msg) && msg.kind === 'hello') port.postMessage({ kind: 'nohub' } satisfies ToPlayer);
    });
    port.onDisconnect.addListener(() => {
      players.delete(port);
      statuses.delete(port);
      if (!players.size) toHub({ kind: 'bye' });
    });
    if (session && hub()) {
      port.postMessage({ kind: 'session', session } satisfies ToPlayer);
      if (voice) port.postMessage(voice);
    }
  }
});

// the toolbar window asks how things stand (or to open Soultied)
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.kind === 'openHub') {
    void openHub();
    return;
  }
  if (msg?.kind !== 'popup') return;
  void chrome.storage.local.get('lastSession').then((r) => {
    // after Chrome has put this worker to sleep and woken it, the names come from the last session we saw
    const s = session || (r.lastSession as Session | undefined) || null;
    reply({
      hub: !!hub(),
      me: s?.me.name || null,
      partner: s?.partner?.name || null,
      place: s?.place || null,
      players: [...statuses.values()],
    });
  });
  return true; // answering in a moment
});

// older builds had no toolbar window: the button opened Soultied
chrome.action.onClicked.addListener(() => void openHub());
