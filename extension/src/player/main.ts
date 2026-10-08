import { titleLabel, type ExtMsg, type HubMsg, type PlusReply, type Session, type StreamEvent, type TitleInfo } from '../../../src/stream/protocol';
import { stuckMessage, WatchCall } from '../../../src/watch/call';
import type { WatchEvent } from '../../../src/watch/sync';
import { adapterFor } from './adapters';
import { Engine } from './engine';
import { Overlay } from './overlay';

/** Runs on Netflix and Prime Video pages. */

type FromBackground =
  | HubMsg
  | { kind: 'nohub' }
  | { kind: 'partyStarted'; link: string }
  | { kind: 'partyError'; error: string }
  | { kind: 'joined'; url: string | null }
  | { kind: 'plusResult'; res: PlusReply }
  /** Soultied opened this tab to bring you to what your person put on */
  | { kind: 'follow'; key: string };
type ToBackground =
  | ExtMsg
  | { kind: 'openHub' }
  | { kind: 'startParty'; name: string }
  | { kind: 'joinParty'; link: string; name: string }
  | { kind: 'redeem'; code: string }
  | {
      kind: 'status';
      status: {
        platform: 'netflix' | 'prime';
        video: boolean;
        connected: boolean;
        watching: string | null;
        partnerHere: boolean;
        partnerWatching: string | null;
        title: TitleInfo | null;
      };
    };

const adapter = adapterFor(location.hostname);
const w = window as unknown as { __soultiedPlayer?: () => boolean };
const alive = () => {
  try {
    return !!chrome.runtime?.id;
  } catch {
    return false;
  }
};
// After the extension updates, it puts this script into pages that were already open. Chrome has cut the
// old copy off from the extension by then, so the new one takes over (and clears away the old one's overlay).
let running = false;
try {
  running = !!w.__soultiedPlayer?.();
} catch {
  running = false;
}

if (adapter && !running) {
  w.__soultiedPlayer = alive;
  document.querySelectorAll('soultied-overlay').forEach((n) => n.remove());
  let port: chrome.runtime.Port | null = null;
  const send = (m: ToBackground) => {
    try {
      port?.postMessage(m);
    } catch {
      // reconnecting
    }
  };

  /* ---------- cameras and voice in a watch party with Soultied Plus ---------- */
  // The call runs in the tab that's showing something (one call, even with a second Netflix tab open).
  let call: WatchCall | null = null;
  let callFor = '';
  let stuckSaid = false;
  const plusOn = () => {
    const u = engine.party?.plusUntil;
    return !!u && u > Date.now();
  };
  const endCall = () => {
    call?.destroy();
    call = null;
    callFor = '';
    overlay.setCall(null);
    engine.setTalking(false);
  };
  /** Start, keep or end the call, to match who's in the party and whether Plus is on. */
  const syncCall = () => {
    const s = engine.session;
    const want = !!s?.party && !!s.partner && plusOn() && (engine.hasVideo || !!call);
    const key = want ? `${s!.me.id}|${s!.party!.id}|${s!.partner!.id}` : '';
    if (key === callFor) return;
    endCall();
    if (!want) return;
    callFor = key;
    const c = new WatchCall(s!.me.id, (e: WatchEvent) => send({ kind: 'send', e: e as StreamEvent }));
    call = c;
    c.setPartner(s!.partner!.id);
    c.subscribe(() => {
      if (call !== c) return;
      overlay.setCall(c.view);
      engine.setTalking(c.view.talking || c.view.partnerTalking);
      if (c.view.stuck && !stuckSaid) {
        stuckSaid = true;
        overlay.note(stuckMessage(engine.partnerName));
      } else if (!c.view.stuck) stuckSaid = false;
    });
    overlay.setCall(c.view);
    // say what's on here, so the other side knows whether to expect a picture
    c.announce();
  };
  window.setInterval(syncCall, 1000);

  const overlay = new Overlay({
    openHub: () => send({ kind: 'openHub' }),
    startParty: (name) => send({ kind: 'startParty', name }),
    joinParty: (link, name) => send({ kind: 'joinParty', link, name }),
    redeem: (code) => send({ kind: 'redeem', code }),
    camera: (on) => {
      syncCall();
      void call?.setCamera(on);
    },
    talk: (down) => {
      if (!call) {
        if (down) overlay.plusNote();
        return;
      }
      void call.talk(down);
    },
    mic: (open) => {
      syncCall();
      if (!call) return overlay.plusNote();
      void call.setMic(open);
    },
  });
  const engine = new Engine(adapter, (m) => send(m), overlay);
  overlay.engine = engine;

  // how things stand here, for the toolbar window (sent when it changes)
  let lastStatus = '';
  const reportStatus = () => {
    const pw = engine.partnerWhere?.title;
    const status = {
      platform: adapter.platform,
      video: engine.hasVideo,
      connected: !!engine.session,
      watching: engine.title ? titleLabel(engine.title) : null,
      partnerHere: engine.partnerHere,
      partnerWatching: pw ? titleLabel(pw) : null,
      title: engine.title,
    };
    const json = JSON.stringify(status);
    if (json === lastStatus || !port) return;
    lastStatus = json;
    send({ kind: 'status', status });
  };
  window.setInterval(reportStatus, 1500);

  const connect = () => {
    lastStatus = '';
    try {
      port = chrome.runtime.connect({ name: 'player' });
    } catch {
      // the extension was updated or removed; a page reload picks the new one up
      port = null;
      engine.setSession(null);
      return;
    }
    port.onMessage.addListener((msg: FromBackground) => {
      if (msg.kind === 'session') {
        engine.setSession(msg.session);
        syncCall();
      } else if (msg.kind === 'nohub') {
        engine.setSession(null);
        syncCall();
      } else if (msg.kind === 'event') {
        const e = msg.e;
        if (e.type === 'rtc' || e.type === 'media') {
          // a call only in the tab that's running one (or showing something, to answer)
          if (!call && engine.hasVideo) syncCall();
          if (call) void call.handle(e as WatchEvent);
          return;
        }
        engine.handle(e);
        // they (re)joined: make sure they know what's on here
        if (e.type === 'hello' && call) call.announce();
      } else if (msg.kind === 'voice') {
        if (!call) engine.setTalking(msg.mine || msg.partner);
      } else if (msg.kind === 'partyStarted') overlay.partyStarted(msg.link);
      else if (msg.kind === 'partyError') overlay.partyFailed(msg.error);
      else if (msg.kind === 'plusResult') overlay.plusResult(msg.res);
      else if (msg.kind === 'follow') engine.followHere(msg.key);
      else if (msg.kind === 'joined') {
        // joined from the card on this page: go to their show (or stay here to pick one)
        if (msg.url && msg.url !== location.href) location.href = msg.url;
      }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      window.setTimeout(connect, 1500);
    });
    port.postMessage({ kind: 'hello' } satisfies ToBackground);
  };

  // what we knew last time (for the no-watching-ahead check when Soultied isn't open)
  void chrome.storage.local.get(['lastSession', 'chatOpen', 'me']).then((r) => {
    if (r.lastSession) engine.cached = r.lastSession as Session;
    if (r.chatOpen === false) overlay.restoreOpen(false);
    overlay.myName = (r.me as { name?: string } | undefined)?.name || (r.lastSession as Session | undefined)?.me.name || '';
    overlay.update();
  });

  // Soultied's pixel font, handed over as bytes so the site's security rules don't block it
  void fetch(chrome.runtime.getURL('fonts/PixelifySans-Variable.ttf'))
    .then((r) => r.arrayBuffer())
    .then((buf) => {
      const f = new FontFace('Soultied Pixel', buf, { weight: '400 700' });
      return f.load().then(() => document.fonts.add(f));
    })
    .catch(() => undefined)
    .finally(() => overlay.fontReady());

  // Keys typed into our chat box stay ours (Netflix would pause on the space bar).
  // Anywhere else, hold T to talk.
  let talking = false;
  const editable = (t: EventTarget | null) =>
    t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  const release = () => {
    if (!talking) return;
    talking = false;
    send({ kind: 'ptt', down: false });
  };
  for (const type of ['keydown', 'keyup', 'keypress'] as const)
    window.addEventListener(
      type,
      (ev) => {
        const e = ev as KeyboardEvent;
        if (e.composedPath().includes(overlay.host)) {
          e.stopImmediatePropagation();
          if (type === 'keydown' && e.key === 'Enter' && overlay.typing()) {
            e.preventDefault();
            overlay.submit();
          }
          return;
        }
        if (e.code !== 'KeyT' || editable(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
        // in a watch party, talking out loud comes with Soultied Plus (the call is in this tab)
        if (engine.party) {
          if (!plusOn()) {
            if (type === 'keydown' && !e.repeat) overlay.plusNote();
            return;
          }
          if (type === 'keydown' && !e.repeat) {
            syncCall();
            void call?.talk(true);
          } else if (type === 'keyup') void call?.talk(false);
          return;
        }
        if (type === 'keydown' && !e.repeat && !talking && engine.session) {
          talking = true;
          send({ kind: 'ptt', down: true });
        } else if (type === 'keyup') release();
      },
      true,
    );
  window.addEventListener('blur', () => {
    release();
    if (call?.view.talking) void call.talk(false);
  });
  window.addEventListener('pagehide', () => call?.destroy());

  connect();
  engine.start();
}
