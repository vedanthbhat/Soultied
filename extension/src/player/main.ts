import { titleLabel, type CallCmd, type ExtMsg, type HubMsg, type PlusReply, type Session, type TitleInfo } from '../../../src/stream/protocol';
import { stuckMessage } from '../../../src/watch/call';
import { adapterFor } from './adapters';
import { CamView } from './camview';
import { Engine } from './engine';
import { Overlay } from './overlay';
import { TileButtons } from './tiles';

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
  | { kind: 'startParty'; name: string; title?: TitleInfo | null }
  | { kind: 'joinParty'; link: string; name: string }
  | { kind: 'redeem'; code: string }
  | { kind: 'call'; cmd: CallCmd }
  | { kind: 'leaveParty' }
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
  // The call runs in the extension's hidden page, so it carries on while you switch shows. This tab
  // shows it (the pictures come over a local link) and passes on what you press.
  let stuckSaid = false;
  let askedSaid = false;
  /** holding T (or the Talk button) right now */
  let holding = false;
  const plusOn = () => {
    const u = engine.party?.plusUntil;
    return !!u && u > Date.now();
  };
  const callCmd = (cmd: CallCmd) => send({ kind: 'call', cmd });
  const cams = new CamView(() => {
    const f = cams.flags;
    overlay.volumes = f ? { mic: f.micVolume, speaker: f.speakerVolume } : null;
    overlay.setCall(cams.view);
    if (f) engine.setTalking(f.talking || f.partnerTalking);
    if (f?.stuck && !stuckSaid) {
      stuckSaid = true;
      overlay.note(stuckMessage(engine.partnerName));
    } else if (!f?.stuck) stuckSaid = false;
    if (f?.asking && !askedSaid) {
      askedSaid = true;
      overlay.note('Allow your camera and mic in the small Soultied window (just this once).');
    } else if (!f?.asking) askedSaid = false;
  });
  // the pictures, while something's showing here and a camera is on
  window.setInterval(() => {
    const f = cams.flags;
    cams.show(engine.hasVideo && !!f && (f.camOn || f.partnerCam));
  }, 700);

  const overlay = new Overlay({
    openHub: () => send({ kind: 'openHub' }),
    startParty: (name, title) => send({ kind: 'startParty', name, title: title || null }),
    joinParty: (link, name) => send({ kind: 'joinParty', link, name }),
    redeem: (code) => send({ kind: 'redeem', code }),
    camera: (on) => {
      if (!cams.flags) return overlay.plusNote();
      callCmd({ op: 'camera', on });
    },
    talk: (down) => {
      if (!cams.flags) {
        if (down) overlay.plusNote();
        return;
      }
      holding = down;
      callCmd({ op: 'talk', down });
    },
    mic: (open) => {
      if (!cams.flags) return overlay.plusNote();
      callCmd({ op: 'mic', open });
    },
    leaveParty: () => send({ kind: 'leaveParty' }),
    micVolume: (v) => callCmd({ op: 'micVolume', v }),
    speakerVolume: (v) => callCmd({ op: 'speakerVolume', v }),
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
        if (!msg.session?.party) cams.set(null);
      } else if (msg.kind === 'nohub') {
        engine.setSession(null);
        cams.set(null);
      } else if (msg.kind === 'event') {
        // (the call's own signalling stays in the hidden page)
        if (msg.e.type !== 'rtc' && msg.e.type !== 'media') engine.handle(msg.e);
      } else if (msg.kind === 'call') cams.set(msg.flags);
      else if (msg.kind === 'voice') {
        if (!cams.flags) engine.setTalking(msg.mine || msg.partner);
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
            holding = true;
            callCmd({ op: 'talk', down: true });
          } else if (type === 'keyup' && holding) {
            holding = false;
            callCmd({ op: 'talk', down: false });
          }
          return;
        }
        if (type === 'keydown' && !e.repeat && !talking && engine.session) {
          talking = true;
          send({ kind: 'ptt', down: true });
        } else if (type === 'keyup') release();
      },
      true,
    );
  // let go of Talk if you leave the window (or the page) while holding it; the call itself carries on
  const letGo = () => {
    release();
    if (!holding) return;
    holding = false;
    callCmd({ op: 'talk', down: false });
  };
  window.addEventListener('blur', letGo);
  window.addEventListener('pagehide', letGo);

  // "Watch together" on the site's own show cards: a party for that show, and on it goes
  const tiles = new TileButtons(adapter.platform, (title, go) => overlay.startFor(title, go));
  tiles.start();
  window.setInterval(() => tiles.setLabel(engine.party ? 'Watch this together' : 'Watch together'), 1000);

  connect();
  engine.start();
}
