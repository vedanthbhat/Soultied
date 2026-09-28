import type { ExtMsg, HubMsg, Session } from '../../src/stream/protocol';

/**
 * The switchboard. Your Soultied tab connects as a "hub" (it's signed in and
 * talks to your person); every Netflix / Prime tab connects as a "player".
 * Messages from players go to the newest hub, and everything the hub says goes
 * to every player.
 */

const DEFAULT_HUB = 'https://soultied.app/';

type PlayerMsg = ExtMsg | { kind: 'openHub' };
type ToPlayer = HubMsg | { kind: 'nohub' };

const hubs: chrome.runtime.Port[] = [];
const players = new Set<chrome.runtime.Port>();
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
        if (msg.session) void chrome.storage.local.set({ lastSession: msg.session, hubUrl: msg.session.hubUrl });
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
      if (!toHub(msg) && msg.kind === 'hello') port.postMessage({ kind: 'nohub' } satisfies ToPlayer);
    });
    port.onDisconnect.addListener(() => {
      players.delete(port);
      if (!players.size) toHub({ kind: 'bye' });
    });
    if (session && hub()) {
      port.postMessage({ kind: 'session', session } satisfies ToPlayer);
      if (voice) port.postMessage(voice);
    }
  }
});

chrome.action.onClicked.addListener(() => void openHub());
