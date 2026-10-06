import { clock, PLUS_URL, titleLabel, type PlusReply } from '../../../src/stream/protocol';
import type { ReactionKind } from '../../../src/pixel/watchRoom';
import type { CallView } from '../../../src/watch/call';
import { CouchCorner, faceURL, iconURL } from './couch';
import type { Engine, EngineUI } from './engine';

/**
 * Everything drawn on top of Netflix / Prime: the chat sidebar, notes,
 * reactions, the couch corner, and the waiting / countdown / guard cards.
 * It lives in a shadow root so the site's styles can't touch it (and ours
 * can't touch the site).
 */

const REACTIONS: Array<{ kind: ReactionKind; label: string }> = [
  { kind: 'heart', label: 'Send a heart' },
  { kind: 'laugh', label: 'Laugh' },
  { kind: 'wow', label: 'Wow' },
  { kind: 'cry', label: 'Cry' },
];

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; }
.root { position: fixed; inset: 0; pointer-events: none; z-index: 2147483600; font-family: 'Soultied Pixel', ui-sans-serif, system-ui, sans-serif; color: #3a2a26; font-size: 15px; line-height: 1.3; font-variant-ligatures: none; -webkit-font-smoothing: antialiased; }
button { font: inherit; cursor: pointer; }
.box { background: #f4e8d0; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, 6px 6px 0 3px rgba(0,0,0,.35); }
.btn { pointer-events: auto; border: 0; background: #b8674f; color: #fff4e2; padding: 6px 10px; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #8f4b3a; }
.btn:hover { filter: brightness(1.06); }
.btn:active { transform: translateY(2px); }
.btn.paper { background: #eadbbd; color: #3a2a26; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #d6c29c; }
.btn.sage { background: #8a9a72; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, 3px 0 0 0 #2b1e1c, inset 0 -3px 0 0 #6a7856; }
.btn[disabled] { opacity: .6; cursor: default; }
.btn.small { padding: 3px 8px; font-size: 13px; }

.tab { position: absolute; right: 0; top: 38%; pointer-events: auto; border: 0; background: #f4e8d0; padding: 10px 8px 10px 10px; display: flex; flex-direction: column; align-items: center; gap: 4px; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, -6px 6px 0 0 rgba(0,0,0,.35); }
.tab img { width: 21px; height: 18px; image-rendering: pixelated; }
.tab .badge { background: #a84f4b; color: #fff4e2; font-size: 11px; padding: 0 5px; }
.tab.hide { display: none; }

.side { position: absolute; right: 14px; top: 9%; bottom: 13%; width: 300px; display: flex; flex-direction: column; pointer-events: auto; }
.side.hide { display: none; }
.head { padding: 10px 12px 8px; border-bottom: 3px dashed #d6c29c; position: relative; }
.kicker { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #8f4b3a; }
.who { display: flex; align-items: center; gap: 7px; font-weight: 700; font-size: 17px; margin-top: 2px; }
.dot { width: 9px; height: 9px; background: #b9a98f; flex: none; }
.dot.on { background: #8a9a72; }
.close { position: absolute; right: 8px; top: 8px; }
.banners { display: flex; flex-direction: column; gap: 6px; padding: 8px 12px 0; }
.banner { background: #fff8ea; padding: 7px 9px; font-size: 13px; display: flex; flex-direction: column; gap: 6px; box-shadow: inset 0 0 0 2px #d6c29c; }
.banner .btn { align-self: flex-start; }
.controls { display: flex; gap: 8px; padding: 10px 12px 4px; flex-wrap: wrap; }
.log { list-style: none; margin: 8px 0 0; padding: 4px 12px; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 6px; scrollbar-width: thin; }
.note { font-size: 13px; color: #7a5a48; text-align: center; }
.msg { display: flex; gap: 6px; align-items: flex-start; }
.msg.mine { flex-direction: row-reverse; }
.msg img { width: 24px; height: 24px; image-rendering: pixelated; flex: none; background: #eadbbd; }
.msg span { background: #eadbbd; padding: 4px 8px; max-width: 78%; word-break: break-word; font-size: 14px; }
.msg.mine span { background: #f1dcc0; }
.reacts { display: flex; gap: 8px; padding: 6px 12px; justify-content: space-between; }
.reacts button { border: 0; background: #eadbbd; padding: 5px 9px; box-shadow: inset 0 0 0 2px #d6c29c; }
.reacts button:hover { background: #fff8ea; }
.reacts img { width: 21px; height: 21px; image-rendering: pixelated; display: block; object-fit: contain; }
.compose { display: flex; gap: 8px; padding: 6px 12px 8px; }
.compose input { flex: 1; min-width: 0; font: inherit; font-size: 14px; border: 0; padding: 6px 8px; background: #fff8ea; color: #2b1e1c; box-shadow: inset 0 0 0 2px #2b1e1c; outline: none; }
.hint { font-size: 12px; color: #7a5a48; padding: 0 12px 10px; }

.couch { position: absolute; left: 22px; bottom: 96px; pointer-events: none; filter: drop-shadow(3px 3px 0 rgba(0,0,0,.35)); }
.couch.hide { display: none; }

.toasts { position: absolute; top: 18px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; gap: 8px; align-items: center; }
.toast { padding: 6px 12px; font-size: 14px; animation: in 160ms steps(3); max-width: 60vw; }
@keyframes in { from { opacity: 0; transform: translateY(-6px); } }

.center { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; }
.card { pointer-events: auto; padding: 18px 20px; max-width: 420px; display: flex; flex-direction: column; gap: 12px; }
.card h3 { margin: 0; font-size: 22px; color: #2b1e1c; }
.card p { margin: 0; }
.card .row { display: flex; gap: 10px; flex-wrap: wrap; }
.big { font-size: 120px; font-weight: 700; color: #fff4e2; text-shadow: 6px 6px 0 #2b1e1c, -3px -3px 0 #2b1e1c, 3px -3px 0 #2b1e1c, -3px 3px 0 #2b1e1c; }
.pill { padding: 8px 14px; font-size: 16px; }

/* the Soultied handle on the right edge when you're not watching with anyone yet, and its card */
.handle { position: absolute; right: 0; top: 38%; pointer-events: auto; border: 0; background: #f4e8d0; padding: 9px 10px 9px 11px; display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 14px; color: #2b1e1c; box-shadow: 0 -3px 0 0 #2b1e1c, 0 3px 0 0 #2b1e1c, -3px 0 0 0 #2b1e1c, -6px 6px 0 0 rgba(0,0,0,.35); transition: transform 120ms steps(3); }
.handle:hover { transform: translateX(-3px); background: #fff8ea; }
.handle img { width: 21px; height: 18px; image-rendering: pixelated; }
.handle.hide { display: none; }
.connect { position: absolute; right: 14px; top: 38%; pointer-events: auto; padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 9px; width: 330px; font-size: 14px; }
.connect.hide { display: none; }
.connect .top { display: flex; align-items: center; gap: 8px; }
.connect .top img { width: 21px; height: 18px; image-rendering: pixelated; }
.connect .top b { flex: 1; font-size: 16px; color: #2b1e1c; }
.connect .x { border: 0; background: none; font-size: 15px; padding: 0 2px; color: #7a5a48; }
.connect .x:hover { color: #2b1e1c; }
.connect .or { font-size: 12px; color: #7a5a48; text-transform: uppercase; letter-spacing: .1em; border-top: 2px dashed #d6c29c; padding-top: 7px; }
.connect .muted { font-size: 12px; color: #7a5a48; }
.connect form { display: flex; gap: 8px; align-items: center; }
.connect form input { flex: 1; }
.connect input, .banner input { font: inherit; font-size: 14px; border: 0; padding: 4px 7px; background: #fff8ea; color: #2b1e1c; box-shadow: inset 0 0 0 2px #2b1e1c; outline: none; min-width: 0; }
.banner input { width: 100%; font-size: 12px; }
.banner .row { display: flex; gap: 6px; align-items: center; }
.banner .row input { flex: 1; }
.banner .muted { font-size: 12px; color: #7a5a48; }

/* cameras (Soultied Plus) */
.cams { position: absolute; left: 22px; top: 70px; display: flex; flex-direction: column; gap: 12px; pointer-events: auto; }
.cams.hide { display: none; }
.cam { width: 208px; position: relative; }
.cam .pic { position: relative; width: 208px; height: 156px; background: #2b1e1c; overflow: hidden; }
.cam video { width: 100%; height: 100%; object-fit: cover; display: block; }
.cam video.mine { transform: scaleX(-1); }
.cam .off { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; color: #cdb9a0; font-size: 12px; text-align: center; padding: 0 8px; }
.cam .off img { width: 54px; height: 54px; image-rendering: pixelated; }
.cam .tag { position: absolute; left: 6px; bottom: 6px; background: #f4e8d0; color: #2b1e1c; font-size: 12px; padding: 1px 6px; display: flex; align-items: center; gap: 5px; box-shadow: 0 0 0 2px #2b1e1c; }
.cam.talking .pic { box-shadow: 0 0 0 3px #8a9a72; }
.wave { display: inline-flex; gap: 2px; align-items: flex-end; height: 9px; }
.wave i { width: 2px; background: #6a7856; animation: wave 600ms steps(3) infinite; }
.wave i:nth-child(2) { animation-delay: 120ms; } .wave i:nth-child(3) { animation-delay: 240ms; }
@keyframes wave { 0% { height: 3px; } 50% { height: 9px; } 100% { height: 4px; } }
.calls { display: flex; gap: 8px; padding: 2px 12px 2px; flex-wrap: wrap; }
.calls .btn { touch-action: none; user-select: none; }
`;

const HINT_PLACE = 'Hold T to talk. Cameras live in your Soultied tab (“Pop out cameras”).';
const HINT_PARTY = 'Cameras and voice come with Soultied Plus.';
const HINT_PLUS = 'Hold T to talk. Your camera only goes to your person.';

const PLUS_ERRORS: Record<string, string> = {
  invalid: 'That code isn’t right. Check it and try again.',
  expired: 'That code’s time is up. Get a new one to keep Plus.',
  full: 'That code is already in use on three browsers.',
  offline: 'Couldn’t reach Soultied. Check your connection and try again.',
};

/** what the overlay can ask for */
export interface OverlayActions {
  openHub(): void;
  startParty(name: string): void;
  joinParty(link: string, name: string): void;
  redeem(code: string): void;
  camera(on: boolean): void;
  talk(down: boolean): void;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

export class Overlay implements EngineUI {
  engine!: Engine;
  readonly host: HTMLElement;
  private shadow: ShadowRoot;
  private tab: HTMLButtonElement;
  private badge: HTMLElement;
  private side: HTMLElement;
  private whoText: HTMLElement;
  private dot: HTMLElement;
  private kicker: HTMLElement;
  private banners: HTMLElement;
  private readyBtn: HTMLButtonElement;
  private lockBtn: HTMLButtonElement;
  private logEl: HTMLOListElement;
  private input: HTMLInputElement;
  private toasts: HTMLElement;
  private center: HTMLElement;
  private connect: HTMLElement;
  private handle: HTMLButtonElement;
  private hint: HTMLElement;
  private calls: HTMLElement;
  private camBtn: HTMLButtonElement;
  private talkBtn: HTMLButtonElement;
  private camsBtn: HTMLButtonElement;
  private cams: HTMLElement;
  private camMine: { root: HTMLElement; video: HTMLVideoElement; off: HTMLElement; tag: HTMLElement };
  private camTheirs: { root: HTMLElement; video: HTMLVideoElement; off: HTMLElement; tag: HTMLElement };
  /** the call (in a watch party with Soultied Plus), as the call reports it */
  call: CallView | null = null;
  private camsHidden = false;
  private plusBusy = false;
  private plusOpen = false;
  /** the start card on the right: open, and whether it opens by itself when a show starts */
  private launchOpen = false;
  private launchAuto = true;
  private couch = new CouchCorner(2);
  private unread = 0;
  private open = true;
  private seen = new Set<string>();
  private overlayCard: 'waiting' | 'countdown' | 'guard' | null = null;
  /** "Not now" on the join card: don't ask again on this page */
  private cardDismissed = false;
  private countTimer = 0;
  /** your name for a watch party (from last time) */
  myName = '';
  private starting = false;
  private plusSaid = false;
  private copied = false;
  private act: OverlayActions;

  constructor(actions: OverlayActions) {
    this.act = actions;
    this.host = document.createElement('soultied-overlay');
    // hidden until Soultied's pixel font has loaded, so nothing shows up in the site's font first
    this.host.style.visibility = 'hidden';
    window.setTimeout(() => this.fontReady(), 2500);
    this.shadow = this.host.attachShadow({ mode: 'open' });
    const style = el('style');
    style.textContent = CSS;
    const root = el('div', 'root');
    this.shadow.append(style, root);

    this.tab = el('button', 'tab hide');
    this.tab.title = 'Soultied chat';
    const heart = el('img');
    heart.src = iconURL('heart', 3);
    heart.alt = '';
    this.badge = el('span', 'badge');
    this.badge.hidden = true;
    this.tab.append(heart, this.badge);
    this.tab.onclick = () => this.setOpen(true);

    this.side = el('aside', 'side box hide');
    const head = el('div', 'head');
    this.kicker = el('div', 'kicker', 'Soultied');
    const who = el('div', 'who');
    this.dot = el('span', 'dot');
    this.whoText = el('span', '', 'Watching together');
    who.append(this.dot, this.whoText);
    const close = el('button', 'btn paper small close', 'Hide');
    close.onclick = () => this.setOpen(false);
    head.append(this.kicker, who, close);

    this.banners = el('div', 'banners');
    const controls = el('div', 'controls');
    this.readyBtn = el('button', 'btn sage small', 'I’m ready');
    this.readyBtn.title = 'When you’re both ready, a 3-2-1 countdown starts the show for both of you';
    this.readyBtn.onclick = () => this.engine.toggleReady();
    this.lockBtn = el('button', 'btn paper small', 'Take the remote');
    this.lockBtn.title = 'Only the person with the remote can pause and skip';
    this.lockBtn.onclick = () => this.engine.toggleLock();
    controls.append(this.readyBtn, this.lockBtn);

    this.logEl = el('ol', 'log');
    this.logEl.setAttribute('aria-live', 'polite');

    const reacts = el('div', 'reacts');
    for (const r of REACTIONS) {
      const b = el('button');
      b.title = r.label;
      b.setAttribute('aria-label', r.label);
      const img = el('img');
      img.src = iconURL(r.kind, 3);
      img.alt = '';
      b.append(img);
      b.onclick = () => this.engine.sendReact(r.kind);
      reacts.append(b);
    }

    const compose = el('form', 'compose');
    this.input = el('input');
    this.input.placeholder = 'Say something…';
    this.input.maxLength = 500;
    this.input.setAttribute('aria-label', 'Chat message');
    const send = el('button', 'btn small', 'Send');
    send.type = 'submit';
    compose.append(this.input, send);
    compose.onsubmit = (ev) => {
      ev.preventDefault();
      this.submit();
    };

    // cameras and voice (Soultied Plus)
    this.calls = el('div', 'calls');
    this.camBtn = el('button', 'btn sage small', 'Turn my camera on');
    this.camBtn.onclick = () => this.act.camera(!this.call?.camOn);
    this.talkBtn = el('button', 'btn paper small', 'Hold to talk');
    this.talkBtn.title = 'Or hold T';
    const up = () => this.act.talk(false);
    this.talkBtn.onpointerdown = (ev) => {
      ev.preventDefault();
      this.talkBtn.setPointerCapture?.(ev.pointerId);
      this.act.talk(true);
    };
    this.talkBtn.onpointerup = up;
    this.talkBtn.onpointercancel = up;
    this.talkBtn.onlostpointercapture = up;
    this.camsBtn = el('button', 'btn paper small', 'Hide cameras');
    this.camsBtn.onclick = () => {
      this.camsHidden = !this.camsHidden;
      this.update();
    };
    this.calls.append(this.camBtn, this.talkBtn, this.camsBtn);

    this.hint = el('div', 'hint', HINT_PLACE);
    this.side.append(head, this.banners, controls, this.calls, this.logEl, reacts, compose, this.hint);

    this.couch.canvas.className = 'couch hide';
    this.toasts = el('div', 'toasts');
    this.center = el('div', 'center');
    this.connect = el('div', 'connect box hide');

    // the handle that's always there on Netflix / Prime until you're watching with someone
    this.handle = el('button', 'handle hide');
    const hh = el('img');
    hh.src = iconURL('heart', 3);
    hh.alt = '';
    this.handle.append(hh, el('span', '', 'Watch together'));
    this.handle.title = 'Start a Soultied watch party';
    this.handle.onclick = () => {
      this.launchOpen = true;
      this.update();
    };

    this.cams = el('div', 'cams hide');
    const tile = (mine: boolean) => {
      const root = el('div', 'cam');
      const pic = el('div', 'pic box');
      const video = el('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = mine; // my own voice never plays back to me
      if (mine) video.className = 'mine';
      const off = el('div', 'off');
      const tag = el('div', 'tag');
      pic.append(video, off, tag);
      root.append(pic);
      return { root, video, off, tag };
    };
    this.camTheirs = tile(false);
    this.camMine = tile(true);
    this.cams.append(this.camTheirs.root, this.camMine.root);

    root.append(this.couch.canvas, this.cams, this.side, this.tab, this.handle, this.toasts, this.center, this.connect);
    this.mount();
    document.addEventListener('fullscreenchange', () => this.mount());
  }

  /** Stay visible in fullscreen: move inside whatever element went fullscreen. */
  private mount() {
    const fs = document.fullscreenElement;
    const parent = fs && fs !== document.documentElement && fs !== document.body ? fs : document.documentElement;
    if (this.host.parentNode !== parent) {
      parent.appendChild(this.host);
      // moving a picture out of the page pauses it: start the cameras again
      for (const v of [this.camMine.video, this.camTheirs.video]) if (v.srcObject) void v.play().catch(() => undefined);
    }
  }

  fontReady() {
    this.host.style.visibility = '';
  }

  typing() {
    return this.shadow.activeElement === this.input;
  }

  submit() {
    const t = this.input.value;
    this.input.value = '';
    this.engine.sendChat(t);
  }

  setOpen(open: boolean) {
    this.open = open;
    if (open) {
      this.unread = 0;
      this.logEl.scrollTop = this.logEl.scrollHeight;
    }
    this.update();
    try {
      void chrome.storage.local.set({ chatOpen: open });
    } catch {
      // extension reloaded
    }
  }

  restoreOpen(open: boolean) {
    this.open = open;
    this.update();
  }

  /* ---------------- EngineUI ---------------- */

  note(text: string) {
    const li = el('li', 'note', text);
    this.append(li);
    if (!this.open || !this.visible) this.toast(text);
  }

  chat(m: { id: string; by: string; text: string; mine: boolean }) {
    if (this.seen.has(m.id)) return;
    this.seen.add(m.id);
    const s = this.engine.session;
    const person = m.mine ? s?.me : s?.partner;
    const li = el('li', `msg${m.mine ? ' mine' : ''}`);
    const img = el('img');
    if (person) img.src = faceURL(person.avatar);
    img.alt = person?.name || '';
    img.title = person?.name || '';
    li.append(img, el('span', '', m.text));
    this.append(li);
    if (!m.mine && (!this.open || !this.visible)) {
      this.unread++;
      this.toast(`${person?.name || 'Them'}: ${m.text}`);
    }
    this.update();
  }

  react(kind: ReactionKind, mine: boolean) {
    const leftId = this.engine.session?.leftId;
    const meLeft = !leftId || leftId === this.engine.me;
    const side = mine === meLeft ? 'left' : 'right';
    this.couch.float(kind, side);
    if (!this.visible) this.toast(`${mine ? 'You' : this.engine.partnerName} sent ${kind === 'heart' ? 'a heart' : `a ${kind}`}`);
  }

  /* ---------------- watch parties ---------------- */

  /** The party's ready: copy the link straight away if the browser lets us. */
  partyStarted(link: string) {
    this.starting = false;
    this.cardDismissed = false;
    this.launchOpen = false;
    void this.copy(link).then((ok) => {
      this.copied = ok;
      this.toast(ok ? 'Watch party started. Link copied: send it to your person.' : 'Watch party started. Copy the link in the chat panel and send it to your person.');
      this.update();
    });
  }

  partyFailed(error: string) {
    this.starting = false;
    this.cardShown = null; // draw the card again, with its buttons back
    const said: Record<string, string> = {
      offline: 'Couldn’t reach Soultied. Check your connection and try again.',
      missing: 'That watch party doesn’t exist any more. Ask for a new link.',
      full: 'That watch party already has two people in it.',
      link: 'That doesn’t look like a Soultied watch party link.',
    };
    this.toast(said[error] || 'That didn’t work. Try again in a moment.');
    this.update();
  }

  /** Pressing T in a watch party without Soultied Plus. */
  plusNote() {
    if (this.plusSaid) return;
    this.plusSaid = true;
    this.plusOpen = true;
    this.setOpen(true);
    this.note('Talking out loud and cameras come with Soultied Plus. One of you having it covers you both.');
  }

  /** What adding a Plus code said. */
  plusResult(res: PlusReply) {
    this.plusBusy = false;
    if (res.ok) {
      this.plusOpen = false;
      const d = new Date(res.until).toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
      this.toast(`Soultied Plus is on until ${d}. Cameras and voice are ready.`);
    } else this.toast(PLUS_ERRORS[res.error] || 'That didn’t work. Try again in a moment.');
    this.update();
  }

  /** The call changed (or ended). */
  setCall(view: CallView | null) {
    const before = this.call;
    this.call = view;
    if (view?.error && view.error !== before?.error) this.toast(view.error);
    if (view?.camOn && !before?.camOn) this.camsHidden = false;
    if (view?.partnerCam && !before?.partnerCam && this.camsHidden) this.toast(`${this.engine?.partnerName || 'Your person'} turned their camera on.`);
    this.update();
  }

  /** Is Soultied Plus on for the party you're in? */
  get plusOn() {
    const u = this.engine?.party?.plusUntil;
    return !!u && u > Date.now();
  }

  private async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  countdown(startAt: number | null) {
    window.clearInterval(this.countTimer);
    if (startAt === null) {
      if (this.overlayCard === 'countdown') this.setCenter(null, null);
      return;
    }
    const big = el('div', 'big');
    this.setCenter(big, 'countdown');
    const step = () => {
      const left = Math.ceil((startAt - Date.now()) / 1000);
      big.textContent = left > 0 ? String(Math.min(3, left)) : '▶';
    };
    step();
    this.countTimer = window.setInterval(step, 100);
  }

  waiting(text: string | null) {
    if (text === null) {
      if (this.overlayCard === 'waiting') this.setCenter(null, null);
      return;
    }
    if (this.overlayCard === 'guard' || this.overlayCard === 'countdown') return;
    this.setCenter(el('div', 'box pill', text), 'waiting');
  }

  guard(g: { show: string; episode: string; partner: string; onWait(): void; onWatch(): void } | null) {
    if (!g) {
      if (this.overlayCard === 'guard') this.setCenter(null, null);
      return;
    }
    const card = el('div', 'box card');
    card.append(
      el('h3', '', 'Hold on, no watching ahead!'),
      el('p', '', `You and ${g.partner} are watching ${g.show} together, and ${g.partner} hasn’t seen ${g.episode || 'this one'} with you yet.`),
    );
    const row = el('div', 'row');
    const wait = el('button', 'btn sage', `Wait for ${g.partner}`);
    wait.onclick = () => g.onWait();
    const go = el('button', 'btn paper', 'Watch anyway');
    go.onclick = () => g.onWatch();
    row.append(wait, go);
    card.append(row);
    this.setCenter(card, 'guard');
  }

  private setCenter(node: HTMLElement | null, kind: Overlay['overlayCard']) {
    this.center.replaceChildren(...(node ? [node] : []));
    this.overlayCard = kind;
  }

  /* ---------------- drawing ---------------- */

  private get visible() {
    return this.engine?.hasVideo ?? false;
  }

  private append(li: HTMLElement) {
    const stick = this.logEl.scrollHeight - this.logEl.scrollTop - this.logEl.clientHeight < 40;
    this.logEl.append(li);
    while (this.logEl.children.length > 150) this.logEl.firstElementChild?.remove();
    if (stick || li.classList.contains('mine')) this.logEl.scrollTop = this.logEl.scrollHeight;
  }

  private toast(text: string) {
    const t = el('div', 'box toast', text);
    this.toasts.append(t);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    window.setTimeout(() => t.remove(), 4200);
  }

  private cardShown: string | null = null;
  private invite: { link: string; copied: boolean; el: HTMLElement } | null = null;

  private inviteBanner(link: string) {
    const b = el('div', 'banner');
    b.append(el('span', '', this.copied ? 'Link copied. Send it to your person; it brings them to this show.' : 'Send this link to your person; it brings them to this show.'));
    const row = el('div', 'row');
    const field = el('input');
    field.readOnly = true;
    field.value = link;
    field.setAttribute('aria-label', 'Watch party link');
    field.onfocus = () => field.select();
    const copy = el('button', 'btn small', 'Copy');
    copy.onclick = () =>
      void this.copy(link).then((ok) => {
        if (!ok) field.select();
        copy.textContent = ok ? 'Copied' : `Press ${/Mac/i.test(navigator.platform) ? '⌘C' : 'Ctrl+C'}`;
      });
    row.append(field, copy);
    b.append(row);
    return b;
  }

  /** your name, a button (the watch party card) */
  private nameForm(label: string, busy: boolean, extra: HTMLInputElement | null, go: (name: string, extra: string) => void) {
    const form = el('form');
    const name = el('input');
    name.placeholder = 'Your name';
    name.maxLength = 40;
    name.value = this.myName;
    name.setAttribute('aria-label', 'Your name');
    const b = el('button', 'btn small', busy ? `${label}…` : label);
    b.type = 'submit';
    b.disabled = busy;
    form.append(name, b);
    form.onsubmit = (ev) => {
      ev.preventDefault();
      const n = name.value.trim();
      if (!n) return name.focus();
      if (extra && !extra.value.trim()) return extra.focus();
      this.myName = n;
      b.textContent = `${label}…`;
      b.disabled = true;
      go(n, extra?.value.trim() || '');
    };
    return form;
  }

  /**
   * The card on the right: start a watch party (or open your Soultied place), join one from a link,
   * or catch up with your person who's already watching something.
   */
  private drawCard(card: 'start' | 'join' | null) {
    const e = this.engine;
    const key = card === 'start' ? `start|${this.starting}|${e.partner?.name || ''}|${e.hasVideo}` : card;
    if (key === this.cardShown && card !== 'join') return;
    this.cardShown = key;
    if (!card) {
      this.connect.replaceChildren();
      return;
    }
    const top = el('div', 'top');
    const heart = el('img');
    heart.src = iconURL('heart', 3);
    heart.alt = '';
    const x = el('button', 'x', '✕');
    x.title = 'Not now';
    x.setAttribute('aria-label', 'Not now');
    top.append(heart, el('b', '', card === 'join' ? 'Soultied' : 'Watch together'), x);

    if (card === 'join') {
      x.onclick = () => {
        this.cardDismissed = true;
        this.update();
      };
      const go = el('button', 'btn small', 'Join them');
      go.onclick = () => e.goToPartner();
      const row = el('div');
      row.append(go);
      this.connect.replaceChildren(top, el('div', '', `${e.partnerName} is watching ${titleLabel(e.partnerWhere!.title)}.`), row);
      return;
    }

    x.onclick = () => {
      this.launchOpen = false;
      this.launchAuto = false;
      this.update();
    };
    const parts: HTMLElement[] = [top];
    const who = e.partner?.name;
    if (who) {
      // you have a Soultied place: it carries everything between you two
      const open = el('button', 'btn sage small', 'Open Soultied');
      open.onclick = () => this.act.openHub();
      const row = el('div');
      row.append(open);
      parts.push(el('div', '', `Watching with ${who}? Open your Soultied place and keep that tab open while you watch.`), row);
      parts.push(el('div', 'or', 'Or, with anyone'));
    } else {
      parts.push(el('div', '', 'Watch this with someone far away, in sync, with a chat and a little couch on the show.'));
    }
    parts.push(
      this.nameForm('Start a watch party', this.starting, null, (n) => {
        this.starting = true;
        this.act.startParty(n);
      }),
    );
    if (!e.hasVideo) parts.push(el('div', 'muted', 'You can start now and pick the show after: your person follows you there.'));
    // or the other way round: someone sent you a link
    parts.push(el('div', 'or', 'Got a link?'));
    const link = el('input');
    link.placeholder = 'Paste the watch party link';
    link.setAttribute('aria-label', 'Watch party link');
    const joinBox = el('div');
    joinBox.style.cssText = 'display:flex;flex-direction:column;gap:6px';
    joinBox.append(link, this.nameForm('Join', false, link, (n, l) => this.act.joinParty(l, n)));
    parts.push(joinBox);
    this.connect.replaceChildren(...parts);
  }

  /** "Cameras and voice": get Soultied Plus, or add the code you got. */
  private plusBanner() {
    const b = el('div', 'banner');
    b.append(el('span', '', 'Cameras and voice for both of you come with Soultied Plus. One of you having it is enough.'));
    const row = el('div', 'row');
    if (!this.plusOpen) {
      const get = el('button', 'btn small', 'Get Plus');
      get.onclick = () => window.open(PLUS_URL, '_blank', 'noopener');
      const have = el('button', 'btn paper small', 'I have a code');
      have.onclick = () => {
        this.plusOpen = true;
        this.update();
        (this.banners.querySelector('input[data-plus]') as HTMLInputElement | null)?.focus();
      };
      row.append(get, have);
      b.append(row);
      return b;
    }
    const form = el('form', 'row');
    const code = el('input');
    code.placeholder = 'XXXX-XXXX-XXXX';
    code.dataset.plus = '1';
    code.maxLength = 24;
    code.autocomplete = 'off';
    code.spellcheck = false;
    code.setAttribute('aria-label', 'Soultied Plus code');
    const add = el('button', 'btn small', this.plusBusy ? 'Adding…' : 'Add');
    add.type = 'submit';
    add.disabled = this.plusBusy;
    form.append(code, add);
    form.onsubmit = (ev) => {
      ev.preventDefault();
      const c = code.value.trim();
      if (c.replace(/[^a-z0-9]/gi, '').length < 8) return code.focus();
      this.plusBusy = true;
      add.textContent = 'Adding…';
      add.disabled = true;
      this.act.redeem(c);
    };
    b.append(form);
    const get = el('button', 'btn paper small', 'Get Plus');
    get.onclick = () => window.open(PLUS_URL, '_blank', 'noopener');
    const row2 = el('div', 'row');
    row2.append(el('span', 'muted', 'No code yet?'), get);
    b.append(row2);
    return b;
  }

  private drawTile(t: Overlay['camMine'], stream: MediaStream | null, camOn: boolean, talking: boolean, name: string, avatarFace: string, offText: string) {
    const hasVideo = !!stream && camOn && stream.getVideoTracks().some((tr) => tr.readyState === 'live');
    if (t.video.srcObject !== stream) {
      t.video.srcObject = stream;
      if (stream) void t.video.play().catch(() => undefined);
    }
    t.video.style.visibility = hasVideo ? 'visible' : 'hidden';
    t.root.classList.toggle('talking', talking);
    if (hasVideo) t.off.replaceChildren();
    else if (t.off.dataset.k !== avatarFace + offText) {
      const face = el('img');
      face.src = avatarFace;
      face.alt = '';
      t.off.replaceChildren(face, el('span', '', offText));
    }
    t.off.dataset.k = hasVideo ? '' : avatarFace + offText;
    const tag = [el('span', '', name)];
    if (talking) {
      const w = el('span', 'wave');
      w.append(el('i'), el('i'), el('i'));
      tag.push(w);
    }
    t.tag.replaceChildren(...tag);
  }

  private drawCams() {
    const e = this.engine;
    const c = this.call;
    const s = e?.session;
    const show = !!c && !!s && this.plusOn && e.hasVideo && (c.camOn || c.partnerCam) && !this.camsHidden;
    this.cams.classList.toggle('hide', !show);
    if (!show || !c || !s) return;
    const partner = s.partner;
    this.drawTile(
      this.camTheirs,
      c.remote,
      c.partnerCam,
      c.partnerTalking,
      partner?.name || 'Your person',
      partner ? faceURL(partner.avatar) : '',
      c.partnerCam ? (c.stuck ? 'Can’t connect' : 'Connecting…') : 'Camera off',
    );
    this.drawTile(this.camMine, c.local, c.camOn, c.talking, 'You', faceURL(s.me.avatar), 'Your camera is off');
  }

  update() {
    const e = this.engine;
    if (!e) return;
    const s = e.session;
    const video = e.hasVideo;
    const partner = s?.partner || null;

    // Not watching with anyone yet: the Soultied handle on the right, and its card (it opens by itself
    // once, when a show starts). Connected but your person's on something else: offer to join them.
    const pwNow = e.partnerWhere;
    if (!s && video && this.launchAuto && !this.launchOpen) {
      this.launchOpen = true;
      this.launchAuto = false;
    }
    const card: 'start' | 'join' | null = !s
      ? this.launchOpen || this.starting
        ? 'start'
        : null
      : !this.cardDismissed && !video && e.partnerHere && pwNow?.title
        ? 'join'
        : null;
    this.connect.classList.toggle('hide', !card);
    this.drawCard(card);
    this.handle.classList.toggle('hide', !!s || card === 'start');

    // the chat: while a show's on, or any time in a watch party (to send the link before you pick something)
    const on = !!s && (video || !!s.party);

    this.side.classList.toggle('hide', !on || !this.open);
    this.tab.classList.toggle('hide', !on || this.open);
    this.badge.hidden = this.unread === 0;
    this.badge.textContent = String(this.unread);

    // couch corner (on the show)
    const onShow = video && !!s;
    this.couch.canvas.classList.toggle('hide', !onShow);
    if (s) {
      const meLeft = !s.leftId || s.leftId === s.me.id;
      const mine = { avatar: s.me.avatar, here: true };
      const theirs = { avatar: partner?.avatar || null, here: e.partnerHere };
      this.couch.left = meLeft ? mine : theirs;
      this.couch.right = meLeft ? theirs : mine;
      this.couch.closeness = s.closeness;
    }
    this.couch.run(onShow);
    this.drawCams();
    if (!on) return;

    const party = s!.party || null;
    this.kicker.textContent = party ? 'Soultied · Watch party' : `Soultied · ${s!.place}`;
    const name = e.partnerName;
    this.dot.classList.toggle('on', e.partnerHere);
    this.whoText.textContent = !partner
      ? party
        ? 'Waiting for your person to join'
        : 'Invite your person in Soultied first'
      : e.partnerHere
        ? `${name} is on the couch`
        : `${name} isn’t here yet`;
    const plus = !!party && this.plusOn;
    this.hint.textContent = !party ? HINT_PLACE : plus ? HINT_PLUS : HINT_PARTY;

    // banners
    const bs: HTMLElement[] = [];
    const pw = e.partnerWhere;
    if (party && !partner) {
      // the link to send (until someone's taken the other seat), kept as it is between updates
      if (this.invite?.link !== party.link || this.invite.copied !== this.copied)
        this.invite = { link: party.link, copied: this.copied, el: this.inviteBanner(party.link) };
      bs.push(this.invite.el);
    } else if (party && !video) {
      // in the party, nothing on yet
      const b = el('div', 'banner');
      b.append(el('span', '', pw?.title && e.partnerHere ? `${name} is watching ${titleLabel(pw.title)}.` : `Pick something to watch: ${name} can follow you there.`));
      if (pw?.title && e.partnerHere) {
        const go = el('button', 'btn small', 'Join them');
        go.onclick = () => e.goToPartner();
        b.append(go);
      }
      bs.push(b);
    } else if (e.partnerHere && pw?.title && e.title && pw.title.key !== e.title.key) {
      const b = el('div', 'banner');
      b.append(el('span', '', `${name} is watching ${titleLabel(pw.title)}.`));
      const go = el('button', 'btn small', 'Go there');
      go.onclick = () => e.goToPartner();
      b.append(go);
      bs.push(b);
    } else {
      const c = e.continueTarget();
      if (c) {
        const b = el('div', 'banner');
        b.append(el('span', '', `Last time together you were on ${c.episode ? c.episode.split(' · ')[0] : c.show}, at ${clock(c.pos)}.`));
        const go = el('button', 'btn small', 'Pick up there');
        go.onclick = () => e.goTo(e.title?.platform === 'netflix' ? `${c.url}?t=${Math.floor(c.pos)}` : c.url);
        b.append(go);
        bs.push(b);
      }
    }
    // cameras and voice: Soultied Plus (once there's someone to call)
    if (party && partner && !plus) {
      const keep = this.banners.querySelector('input[data-plus]') as HTMLInputElement | null;
      const typed = keep?.value || '';
      const focused = !!keep && this.shadow.activeElement === keep;
      const pb = this.plusBanner();
      const field = pb.querySelector('input[data-plus]') as HTMLInputElement | null;
      if (field && typed) field.value = typed;
      bs.push(pb);
      if (focused) queueMicrotask(() => field?.focus());
    }
    // a banner coming or going changes the chat's height: stay at the newest line if you were there
    const stick = this.logEl.scrollHeight - this.logEl.scrollTop - this.logEl.clientHeight < 40;
    this.banners.replaceChildren(...bs);
    if (stick) this.logEl.scrollTop = this.logEl.scrollHeight;

    // countdown + remote
    this.readyBtn.disabled = !e.partnerHere;
    this.readyBtn.textContent = e.ready.me
      ? e.ready.partner
        ? 'Starting…'
        : `Ready ✓ (waiting for ${name})`
      : e.ready.partner
        ? `${name} is ready. Me too!`
        : 'I’m ready';
    const mineLock = e.lock.on && e.lock.by === e.me;
    this.lockBtn.disabled = e.lock.on && !mineLock;
    this.lockBtn.textContent = mineLock ? 'You have the remote' : e.lock.on ? `${name} has the remote` : 'Take the remote';
    this.lockBtn.classList.toggle('sage', mineLock);
    this.lockBtn.classList.toggle('paper', !mineLock);

    // cameras and voice
    const c = this.call;
    this.calls.style.display = plus && partner && video && c ? '' : 'none';
    if (c) {
      this.camBtn.textContent = c.busy === 'cam' ? 'Starting camera…' : c.camOn ? 'Turn my camera off' : 'Turn my camera on';
      this.camBtn.disabled = c.busy === 'cam';
      this.camBtn.classList.toggle('sage', !c.camOn);
      this.camBtn.classList.toggle('paper', c.camOn);
      this.talkBtn.textContent = c.talking ? 'Talking…' : c.busy === 'mic' ? 'Allow the mic…' : 'Hold to talk';
      this.talkBtn.classList.toggle('paper', !c.talking);
      this.camsBtn.style.display = c.camOn || c.partnerCam ? '' : 'none';
      this.camsBtn.textContent = this.camsHidden ? 'Show cameras' : 'Hide cameras';
    }
  }
}
