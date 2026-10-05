import { clock, titleLabel } from '../../../src/stream/protocol';
import type { ReactionKind } from '../../../src/pixel/watchRoom';
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

.connect { position: absolute; left: 22px; bottom: 96px; pointer-events: auto; padding: 10px 12px; display: flex; flex-wrap: wrap; gap: 8px 10px; align-items: center; max-width: 430px; font-size: 14px; }
.connect > span { flex-basis: 100%; }
.connect.hide { display: none; }
.connect form { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.connect input, .banner input { font: inherit; font-size: 14px; border: 0; padding: 4px 7px; background: #fff8ea; color: #2b1e1c; box-shadow: inset 0 0 0 2px #2b1e1c; outline: none; min-width: 0; }
.connect input { width: 130px; }
.banner input { width: 100%; font-size: 12px; }
.banner .row { display: flex; gap: 6px; align-items: center; }
`;

const HINT_PLACE = 'Hold T to talk. Cameras live in your Soultied tab (“Pop out cameras”).';
const HINT_PARTY = 'Voice and cameras are coming with Soultied Plus.';

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
  private hint: HTMLElement;
  private couch = new CouchCorner(2);
  private unread = 0;
  private open = true;
  private seen = new Set<string>();
  private overlayCard: 'waiting' | 'countdown' | 'guard' | null = null;
  /** "Not now" on the little card: don't ask again on this page */
  private cardDismissed = false;
  private countTimer = 0;
  /** your name for a watch party (from last time) */
  myName = '';
  private starting = false;
  private plusSaid = false;
  private copied = false;
  private openHub: () => void;
  private startParty: (name: string) => void;

  constructor(actions: { openHub: () => void; startParty: (name: string) => void }) {
    this.openHub = actions.openHub;
    this.startParty = actions.startParty;
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

    this.hint = el('div', 'hint', HINT_PLACE);
    this.side.append(head, this.banners, controls, this.logEl, reacts, compose, this.hint);

    this.couch.canvas.className = 'couch hide';
    this.toasts = el('div', 'toasts');
    this.center = el('div', 'center');
    this.connect = el('div', 'connect box hide');

    root.append(this.couch.canvas, this.side, this.tab, this.toasts, this.center, this.connect);
    this.mount();
    document.addEventListener('fullscreenchange', () => this.mount());
  }

  /** Stay visible in fullscreen: move inside whatever element went fullscreen. */
  private mount() {
    const fs = document.fullscreenElement;
    const parent = fs && fs !== document.documentElement && fs !== document.body ? fs : document.documentElement;
    if (this.host.parentNode !== parent) parent.appendChild(this.host);
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
    void this.copy(link).then((ok) => {
      this.copied = ok;
      this.toast(ok ? 'Watch party started. Link copied: send it to your person.' : 'Watch party started. Copy the link in the chat panel and send it to your person.');
      this.update();
    });
  }

  partyFailed(error: string) {
    this.starting = false;
    this.cardShown = null; // draw the card again, with its button back
    this.toast(error === 'offline' ? 'Couldn’t reach Soultied. Check your connection and try again.' : 'Couldn’t start a watch party. Try again in a moment.');
    this.update();
  }

  /** Pressing T in a watch party. */
  plusNote() {
    if (this.plusSaid) return;
    this.plusSaid = true;
    this.note('Talking out loud and cameras are coming with Soultied Plus. For now, there’s the chat.');
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

  private cardShown: 'offline' | 'start' | 'join' | null = null;
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

  private drawCard(card: 'offline' | 'start' | 'join' | null) {
    this.cardShown = card;
    const e = this.engine;
    if (!card) {
      this.connect.replaceChildren();
      return;
    }
    const later = el('button', 'btn paper small', 'Not now');
    later.onclick = () => {
      this.cardDismissed = true;
      this.update();
    };
    if (card === 'start') {
      // no Soultied place: start a watch party right here
      const form = el('form');
      const name = el('input');
      name.placeholder = 'Your name';
      name.maxLength = 40;
      name.value = this.myName;
      name.setAttribute('aria-label', 'Your name');
      const go = el('button', 'btn small', this.starting ? 'Starting…' : 'Start a watch party');
      go.type = 'submit';
      go.disabled = this.starting;
      form.append(name, go);
      form.onsubmit = (ev) => {
        ev.preventDefault();
        const n = name.value.trim();
        if (!n) {
          name.focus();
          return;
        }
        this.myName = n;
        this.starting = true;
        go.textContent = 'Starting…';
        go.disabled = true;
        this.startParty(n);
      };
      this.connect.replaceChildren(el('span', '', 'Watching with someone far away? Start a watch party and send them the link.'), form, later);
      return;
    }
    const who = e.partner?.name;
    const text =
      card === 'offline'
        ? who
          ? `Open Soultied to watch with ${who}. Keep that tab open while you watch.`
          : 'Open your Soultied place to watch together.'
        : `${e.partnerName} is watching ${titleLabel(e.partnerWhere!.title)}.`;
    const go = el('button', 'btn small', card === 'offline' ? 'Open Soultied' : 'Join them');
    go.onclick = () => (card === 'offline' ? this.openHub() : e.goToPartner());
    this.connect.replaceChildren(el('span', '', text), go, later);
  }

  update() {
    const e = this.engine;
    if (!e) return;
    const s = e.session;
    const video = e.hasVideo;
    const partner = s?.partner || null;

    // One small card when there's something to do and nothing's playing yet (or you're not connected):
    // open Soultied (you have a place), start a watch party (you don't), or join your person, who's
    // already watching something.
    const pwNow = e.partnerWhere;
    const card: 'offline' | 'start' | 'join' | null = this.cardDismissed
      ? null
      : !s && e.partner
        ? 'offline'
        : !s && video
          ? 'start'
          : s && !video && e.partnerHere && pwNow?.title
            ? 'join'
            : null;
    this.connect.classList.toggle('hide', !card);
    if (card !== this.cardShown || card === 'join') this.drawCard(card);

    const on = video && !!s;

    this.side.classList.toggle('hide', !on || !this.open);
    this.tab.classList.toggle('hide', !on || this.open);
    this.badge.hidden = this.unread === 0;
    this.badge.textContent = String(this.unread);

    // couch corner
    this.couch.canvas.classList.toggle('hide', !on);
    if (s) {
      const meLeft = !s.leftId || s.leftId === s.me.id;
      const mine = { avatar: s.me.avatar, here: true };
      const theirs = { avatar: partner?.avatar || null, here: e.partnerHere };
      this.couch.left = meLeft ? mine : theirs;
      this.couch.right = meLeft ? theirs : mine;
      this.couch.closeness = s.closeness;
    }
    this.couch.run(on);
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
    this.hint.textContent = party ? HINT_PARTY : HINT_PLACE;

    // banners
    const bs: HTMLElement[] = [];
    const pw = e.partnerWhere;
    if (party && !partner) {
      // the link to send (until someone's taken the other seat), kept as it is between updates
      if (this.invite?.link !== party.link || this.invite.copied !== this.copied)
        this.invite = { link: party.link, copied: this.copied, el: this.inviteBanner(party.link) };
      bs.push(this.invite.el);
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
  }
}
