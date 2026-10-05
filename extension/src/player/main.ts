import { titleLabel, type ExtMsg, type HubMsg, type Session } from '../../../src/stream/protocol';
import { adapterFor } from './adapters';
import { Engine } from './engine';
import { Overlay } from './overlay';

/** Runs on Netflix and Prime Video pages. */

type FromBackground = HubMsg | { kind: 'nohub' };
type ToBackground =
  | ExtMsg
  | { kind: 'openHub' }
  | {
      kind: 'status';
      status: { platform: 'netflix' | 'prime'; video: boolean; connected: boolean; watching: string | null; partnerHere: boolean; partnerWatching: string | null };
    };

const adapter = adapterFor(location.hostname);
const w = window as unknown as { __soultiedPlayer?: boolean };

if (adapter && !w.__soultiedPlayer) {
  w.__soultiedPlayer = true;
  let port: chrome.runtime.Port | null = null;
  const send = (m: ToBackground) => {
    try {
      port?.postMessage(m);
    } catch {
      // reconnecting
    }
  };

  const overlay = new Overlay(() => send({ kind: 'openHub' }));
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
      if (msg.kind === 'session') engine.setSession(msg.session);
      else if (msg.kind === 'nohub') engine.setSession(null);
      else if (msg.kind === 'event') engine.handle(msg.e);
      else if (msg.kind === 'voice') engine.setTalking(msg.mine || msg.partner);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      window.setTimeout(connect, 1500);
    });
    port.postMessage({ kind: 'hello' } satisfies ToBackground);
  };

  // what we knew last time (for the no-watching-ahead check when Soultied isn't open)
  void chrome.storage.local.get(['lastSession', 'chatOpen']).then((r) => {
    if (r.lastSession) engine.cached = r.lastSession as Session;
    if (r.chatOpen === false) overlay.restoreOpen(false);
    overlay.update();
  });

  // Soultied's pixel font, handed over as bytes so the site's security rules don't block it
  void fetch(chrome.runtime.getURL('fonts/PixelifySans-Variable.ttf'))
    .then((r) => r.arrayBuffer())
    .then((buf) => {
      const f = new FontFace('Soultied Pixel', buf, { weight: '400 700' });
      return f.load().then(() => document.fonts.add(f));
    })
    .catch(() => undefined);

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
        if (type === 'keydown' && !e.repeat && !talking && engine.session) {
          talking = true;
          send({ kind: 'ptt', down: true });
        } else if (type === 'keyup') release();
      },
      true,
    );
  window.addEventListener('blur', release);

  connect();
  engine.start();
}
