import { titleLabel, type CallCmd, type ExtMsg, type HubMsg, type Platform, type PlusReply, type Session, type TitleInfo } from '../../../src/stream/protocol';
import { stuckMessage } from '../../../src/watch/call';
import { adapterFor } from './adapters';
import { CamView } from './camview';
import { Engine } from './engine';
import { Overlay } from './overlay';
import { TileButtons } from './tiles';

/** Runs on the streaming sites' pages (Netflix, Prime Video and the others in SERVICES). */

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
        platform: Platform;
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
  /** the film plays in a frame of its own on this page (Crunchyroll): the copy in there does everything */
  let standby = !!adapter.standby?.();
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
    overlay.volumes = f ? { mic: f.micVolume, speaker: f.speakerVolume, isolation: f.isolation } : null;
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
    isolation: (on) => callCmd({ op: 'isolation', on }),
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
    if (standby || port) return;
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
  // (said once per page: a place without Plus, and you held T)
  let placePlusSaid = false;
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
        // with a Soultied place, talking out loud comes with the place's Plus (the call is in your Soultied tab)
        if (engine.session?.plus === false) {
          if (type === 'keydown' && !e.repeat && !placePlusSaid) {
            placePlusSaid = true;
            overlay.note('Talking out loud and cameras come with Soultied Plus. Add it in your Soultied tab, under Watch together.');
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

  // "Watch together" on the site's own show cards (Netflix and Prime): a party for that show, and on it goes
  const platform = adapter.platform;
  if (platform === 'netflix' || platform === 'prime') {
    const tiles = new TileButtons(platform, (title, go) => overlay.startFor(title, go));
    tiles.start();
    window.setInterval(() => tiles.setLabel(engine.party ? 'Watch this together' : 'Watch together'), 1000);
  }

  // a site whose film can play in a frame of its own: stand back while it does (and come back when it doesn't)
  if (adapter.standby) {
    const sync = () => {
      overlay.host.style.display = standby ? 'none' : '';
      if (standby) {
        const p = port;
        port = null;
        engine.setSession(null);
        cams.set(null);
        try {
          p?.disconnect();
        } catch {
          // already gone
        }
      } else connect();
    };
    window.setInterval(() => {
      const now = !!adapter.standby?.();
      if (now === standby) return;
      standby = now;
      sync();
    }, 1000);
    // (the frame turns up a moment after the page: look before saying hello)
    window.setTimeout(() => {
      standby = !!adapter.standby?.();
      sync();
    }, 1500);
  } else connect();

  /* ---------- after your first proper watch party: rate Soultied (and Plus, if you watched without it) ---------- */
  const GOOD_PARTY_S = 10 * 60;
  let thanks: { good: boolean; asked: boolean } | null = null;
  void chrome.storage.local
    .get(['goodParty', 'reviewAsked'])
    .then((r) => {
      thanks = { good: !!r.goodParty, asked: !!r.reviewAsked };
    })
    .catch(() => undefined);
  let wasParty = false;
  let hadPlus = false;
  let partyPartner = '';
  let quietSince = 0;
  window.setInterval(() => {
    if (!thanks || thanks.asked || standby) return;
    const p = engine.party;
    if (p) {
      wasParty = true;
      hadPlus = hadPlus || plusOn();
      partyPartner = engine.session?.partner?.name || partyPartner;
      if (!thanks.good && engine.partyWatched >= GOOD_PARTY_S) {
        thanks.good = true;
        void chrome.storage.local.set({ goodParty: Date.now() }).catch(() => undefined);
      }
    }
    if (!thanks.good) return;
    const v = adapter.video();
    // the moment: the party's over, your person left, or the film reached its end (and nothing's playing)
    // (or, after one on another day, when you're back and not watching with anyone)
    const over = wasParty ? !p || engine.partnerLeft || !!v?.ended : !engine.session;
    const still = !v || v.paused || v.ended;
    if (!over || !still) {
      quietSince = 0;
      return;
    }
    // (a moment's quiet first, so it never lands on top of something happening)
    if (!quietSince) quietSince = Date.now();
    if (Date.now() - quietSince < (wasParty ? 2500 : 8000)) return;
    // (once, across all your tabs)
    const t = thanks;
    t.asked = true;
    void chrome.storage.local
      .get('reviewAsked')
      .then((r) => {
        if (r.reviewAsked) return;
        const shown = overlay.thanks({ partner: partyPartner || 'your person', plus: !hadPlus, onClose: () => undefined });
        if (shown) void chrome.storage.local.set({ reviewAsked: Date.now() });
        else t.asked = false;
      })
      .catch(() => {
        t.asked = false;
      });
  }, 1000);

  engine.start();
}
