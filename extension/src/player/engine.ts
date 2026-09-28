import { clock, titleLabel, type ExtMsg, type Person, type Session, type StreamEvent, type TitleInfo, type TogetherLog, type Where } from '../../../src/stream/protocol';
import { projectedPosition } from '../../../src/watch/sync';
import type { ReactionKind } from '../../../src/pixel/watchRoom';
import type { Adapter } from './adapters';

/** What the engine asks of the on-screen overlay. */
export interface EngineUI {
  /** a little line in the chat (and a toast if the chat is hidden) */
  note(text: string): void;
  chat(m: { id: string; by: string; text: string; mine: boolean }): void;
  react(kind: ReactionKind, mine: boolean): void;
  /** presence, banners, buttons */
  update(): void;
  /** big 3-2-1, starting at a moment on this device's clock */
  countdown(startAt: number | null): void;
  /** "Waiting for Rohan…" over the video, or null to clear */
  waiting(text: string | null): void;
  /** the "don't watch ahead" check */
  guard(g: { show: string; episode: string; partner: string; onWait(): void; onWatch(): void } | null): void;
}

type Outgoing = StreamEvent extends infer T ? (T extends StreamEvent ? Omit<T, 'by' | 'at'> : never) : never;

const PRESENT_MS = 50_000;
const PING_MS = 20_000;
const STATE_MS = 15_000;
const TOGETHER_COUNTS_AFTER = 120; // seconds watched together before an episode counts as "seen together"

export class Engine {
  session: Session | null = null;
  /** the last session we saw (kept on this computer), for the guard when Soultied isn't open */
  cached: Session | null = null;

  title: TitleInfo | null = null;
  key: string | null = null;
  partnerSeen = 0;
  partnerWhere: Where | null = null;
  partnerBuffering = false;
  lock = { on: false, by: '' };
  ready = { me: false, partner: false };
  hold: 'partner' | null = null;
  countingDown = false;

  private v: HTMLVideoElement | null = null;
  private expected = { pos: 0, at: 0, playing: false };
  private suppressUntil = 0;
  private leader = false;
  private bufferingSent = false;
  private inAd = false;
  private waitTimer = 0;
  private lastPing = 0;
  private lastState = 0;
  private helloAt = 0;
  private partnerHelloAt = 0;
  private together = 0;
  private lastWatched = 0;
  private lastTick = Date.now();
  private guardOK = new Set<string>();
  private guardOpen = false;
  private dipped: number | null = null;
  private timer = 0;

  constructor(
    private a: Adapter,
    private out: (m: ExtMsg) => void,
    private ui: EngineUI,
  ) {}

  /* ---------------- who's here ---------------- */

  get me() {
    return this.session?.me.id || '';
  }
  get partner(): Person | null {
    return this.session?.partner || this.cached?.partner || null;
  }
  get partnerName() {
    return this.partner?.name || 'your person';
  }
  get partnerHere() {
    return !!this.session?.partner && Date.now() - this.partnerSeen < PRESENT_MS;
  }
  get log(): TogetherLog | null {
    return this.session?.log || this.cached?.log || null;
  }
  get hasVideo() {
    return !!this.v;
  }
  get lockedOut() {
    return this.lock.on && this.lock.by !== this.me && this.partnerHere;
  }

  setSession(s: Session | null) {
    const had = !!this.session;
    this.session = s;
    if (s) this.cached = s;
    if (!s) {
      this.partnerSeen = 0;
      this.partnerWhere = null;
      this.clearHold();
    }
    if (s && !had && this.v) this.sayHello();
    this.ui.update();
  }

  start() {
    this.timer = window.setInterval(() => this.tick(), 500);
    window.addEventListener('pagehide', this.leave);
    this.tick();
  }

  where(): Where {
    const v = this.v;
    return { title: this.title, pos: v ? v.currentTime : 0, playing: v ? !v.paused : false };
  }

  private send(e: Outgoing) {
    if (!this.session) return;
    this.out({ kind: 'send', e: { ...e, by: this.me, at: Date.now() } as StreamEvent });
  }

  private sayHello() {
    this.helloAt = Date.now();
    this.lastPing = this.helloAt;
    this.send({ type: 'hello', ...this.where(), buffering: this.bufferingSent });
  }

  private leave = () => {
    if (this.together >= TOGETHER_COUNTS_AFTER && this.title) this.out({ kind: 'watched', title: this.title, pos: this.v?.currentTime || 0 });
    this.send({ type: 'bye' });
  };

  /* ---------------- the video element ---------------- */

  private attach(v: HTMLVideoElement | null) {
    if (this.v) {
      this.v.removeEventListener('play', this.onPlay);
      this.v.removeEventListener('pause', this.onPause);
      this.v.removeEventListener('seeked', this.onSeeked);
      this.v.removeEventListener('waiting', this.onWaiting);
      this.v.removeEventListener('playing', this.onFlowing);
      this.v.removeEventListener('canplay', this.onFlowing);
    }
    this.v = v;
    if (!v) {
      this.send({ type: 'bye' });
      this.ui.update();
      return;
    }
    v.addEventListener('play', this.onPlay);
    v.addEventListener('pause', this.onPause);
    v.addEventListener('seeked', this.onSeeked);
    v.addEventListener('waiting', this.onWaiting);
    v.addEventListener('playing', this.onFlowing);
    v.addEventListener('canplay', this.onFlowing);
    this.expected = { pos: v.currentTime, at: Date.now(), playing: !v.paused };
    if (this.session) this.sayHello();
    // started playing on its own (autoplay) before we were watching
    if (!v.paused) this.guardCheck();
    this.ui.update();
  }

  /** we caused this play/pause/seek ourselves (following your person) */
  private ours(playing?: boolean) {
    return Date.now() < this.suppressUntil && (playing === undefined || playing === this.expected.playing);
  }

  private onPlay = () => {
    if (this.ours(true)) return;
    const v = this.v!;
    // the "no watching ahead" card is up: choose there first
    if (this.guardOpen) return this.apply({ pos: v.currentTime, playing: false });
    if (this.lockedOut) return this.revert();
    if (this.guardCheck()) return;
    if (this.hold) this.clearHold(); // you chose not to wait
    this.leader = true;
    this.expected = { pos: v.currentTime, at: Date.now(), playing: true };
    this.send({ type: 'play', pos: v.currentTime, key: this.key });
    this.resetReady();
  };

  private onPause = () => {
    if (this.ours(false)) return;
    if (this.guardOpen) return;
    const v = this.v!;
    if (v.ended) return;
    if (this.lockedOut) return this.revert();
    this.leader = true;
    this.expected = { pos: v.currentTime, at: Date.now(), playing: false };
    this.send({ type: 'pause', pos: v.currentTime, key: this.key });
  };

  private onSeeked = () => {
    if (this.ours()) return;
    const v = this.v!;
    const now = Date.now();
    const guess = projectedPosition(this.expected.pos, this.expected.at, this.expected.playing, now);
    if (Math.abs(v.currentTime - guess) < 1.5) return;
    if (this.lockedOut) return this.revert();
    this.leader = true;
    this.expected = { pos: v.currentTime, at: now, playing: !v.paused };
    this.send({ type: 'seek', pos: v.currentTime, playing: !v.paused, key: this.key });
  };

  private onWaiting = () => {
    if (this.waitTimer) return;
    this.waitTimer = window.setTimeout(() => {
      this.waitTimer = 0;
      const v = this.v;
      if (v && !v.paused && v.readyState < 3) this.sendBuffering(true);
    }, 900);
  };

  private onFlowing = () => {
    window.clearTimeout(this.waitTimer);
    this.waitTimer = 0;
    if (this.bufferingSent && !this.inAd) this.sendBuffering(false);
  };

  private sendBuffering(on: boolean) {
    if (on === this.bufferingSent) return;
    this.bufferingSent = on;
    this.send({ type: 'buffering', on, pos: this.v?.currentTime || 0 });
  }

  /** go to a spot without it counting as something I did */
  private apply(to: { pos: number; playing: boolean }) {
    const v = this.v;
    if (!v) return;
    this.suppressUntil = Date.now() + 1600;
    this.expected = { pos: to.pos, at: Date.now(), playing: to.playing };
    if (Math.abs(v.currentTime - to.pos) > 1) this.a.seek(to.pos);
    if (to.playing && v.paused) this.a.play();
    else if (!to.playing && !v.paused) this.a.pause();
  }

  /** your person has the remote: undo what I just did */
  private revert() {
    const e = this.expected;
    this.apply({ pos: projectedPosition(e.pos, e.at, e.playing), playing: e.playing });
    this.ui.note(`${this.partnerName} has the remote right now.`);
  }

  private clearHold() {
    if (!this.hold) return;
    this.hold = null;
    this.ui.waiting(null);
  }

  /* ---------------- every half second ---------------- */

  private tick() {
    const now = Date.now();
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;

    const key = this.a.currentKey();
    if (key !== this.key) this.changedTitle(key);
    const v = key ? this.a.video() : null;
    if (v !== this.v) this.attach(v);
    if (!this.v) return;
    if (this.title && !this.title.episode && this.title.show.match(/^(Netflix|Prime Video)$/)) this.refreshTitle();

    // an ad counts as "wait for me"
    const ad = this.a.inAd();
    if (ad !== this.inAd) {
      this.inAd = ad;
      if (ad) this.sendBuffering(true);
      else if (this.v.readyState >= 3) this.sendBuffering(false);
    }

    // keep "where we should be" current (seeks that didn't fire an event still get noticed)
    if (!this.ours() && !this.inAd && !this.countingDown) {
      const cur = this.v.currentTime;
      const guess = projectedPosition(this.expected.pos, this.expected.at, this.expected.playing, now);
      if (Math.abs(cur - guess) > 3 && !this.v.seeking && this.v.readyState >= 3) this.onSeeked();
      else this.expected = { pos: cur, at: now, playing: !this.v.paused };
    }

    if (this.session) {
      if (now - this.lastPing > PING_MS) {
        this.lastPing = now;
        this.send({ type: 'ping', ...this.where(), buffering: this.bufferingSent });
      }
      if (this.leader && !this.v.paused && this.partnerHere && now - this.lastState > STATE_MS) {
        this.lastState = now;
        this.send({ type: 'state', ...this.where() });
      }
      // your person's tab went quiet
      if (this.partnerSeen && now - this.partnerSeen > PRESENT_MS) {
        this.partnerSeen = 0;
        this.partnerWhere = null;
        this.clearHold();
        this.ui.update();
      }
    }

    // time watched together
    const sameThing = this.partnerHere && !!this.title && this.partnerWhere?.title?.key === this.key;
    if (sameThing && !this.v.paused && this.title) {
      this.together += dt;
      const crossed = this.together >= TOGETHER_COUNTS_AFTER && this.lastWatched === 0;
      if (crossed || (this.lastWatched && now - this.lastWatched > 300_000)) {
        this.lastWatched = now;
        this.out({ kind: 'watched', title: this.title, pos: this.v.currentTime });
      }
    }
  }

  private changedTitle(key: string | null) {
    const from = this.key;
    if (from && this.title && this.together >= TOGETHER_COUNTS_AFTER) this.out({ kind: 'watched', title: this.title, pos: this.v?.currentTime || 0 });
    this.key = key;
    this.title = null;
    this.together = 0;
    this.lastWatched = 0;
    this.leader = false;
    this.resetReady();
    this.ui.update();
    if (!key) return;
    void this.a.title().then((t) => {
      if (this.key !== key) return;
      this.title = t;
      if (t) this.send({ type: 'title', title: t, from });
      this.ui.update();
      if (t && this.v && !this.v.paused) this.guardCheck();
    });
  }

  private refreshing = false;
  private refreshTitle() {
    if (this.refreshing) return;
    this.refreshing = true;
    const key = this.key;
    window.setTimeout(() => {
      void this.a.title().then((t) => {
        this.refreshing = false;
        if (!t || this.key !== key || !this.title || t.show === this.title.show) return;
        this.title = t;
        this.send({ type: 'title', title: t, from: null });
        this.ui.update();
      });
    }, 2000);
  }

  /* ---------------- from your person ---------------- */

  handle(e: StreamEvent) {
    if (!this.session || e.by === this.me) return;
    if (this.session.partner && e.by !== this.session.partner.id) return;
    if (e.type === 'rtc' || e.type === 'media') return;
    const was = this.partnerHere;
    this.partnerSeen = e.type === 'bye' ? 0 : Date.now();
    const name = this.partnerName;
    const nf = this.a.platform === 'netflix';

    switch (e.type) {
      case 'hello': {
        this.partnerWhere = { title: e.title, pos: e.pos, playing: e.playing };
        this.partnerHelloAt = Date.now();
        if (!was) this.ui.note(`${name} is on the couch.`);
        if (this.v) this.send({ type: 'state', reply: true, ...this.where() });
        if (this.lock.on && this.lock.by === this.me) this.send({ type: 'lock', on: true });
        if (this.ready.me) this.send({ type: 'ready', on: true });
        this.setPartnerBuffering(!!e.buffering, e.pos);
        break;
      }
      case 'ping':
        this.partnerWhere = { title: e.title, pos: e.pos, playing: e.playing };
        if (!was) this.ui.note(`${name} is on the couch.`);
        this.setPartnerBuffering(!!e.buffering, e.pos);
        break;
      case 'bye':
        if (was) this.ui.note(`${name} got up from the couch.`);
        this.partnerWhere = null;
        this.setPartnerBuffering(false, 0);
        this.ready.partner = false;
        if (this.lock.by === this.session.partner?.id) this.lock = { on: false, by: '' };
        break;
      case 'play':
        if (!this.same(e.key)) break;
        this.leader = false;
        this.clearHold();
        this.apply({ pos: projectedPosition(e.pos, e.at, true), playing: true });
        this.ui.note(`${name} pressed play.`);
        this.resetReady();
        break;
      case 'pause':
        if (!this.same(e.key)) break;
        this.leader = false;
        this.clearHold();
        this.apply({ pos: e.pos, playing: false });
        this.ui.note(nf ? `${name} paused at ${clock(e.pos)}.` : `${name} paused.`);
        break;
      case 'seek': {
        if (!this.same(e.key)) break;
        this.leader = false;
        const pos = projectedPosition(e.pos, e.at, e.playing);
        const cur = this.v?.currentTime ?? pos;
        this.apply({ pos, playing: e.playing });
        this.ui.note(nf ? `${name} skipped to ${clock(pos)}.` : `${name} skipped ${pos > cur ? 'ahead' : 'back'}.`);
        break;
      }
      case 'state': {
        this.partnerWhere = { title: e.title, pos: e.pos, playing: e.playing };
        if (!this.v || !e.title || e.title.key !== this.key || this.countingDown) break;
        const pos = projectedPosition(e.pos, e.at, e.playing);
        if (e.reply) {
          // they were here first: catch up with them (if we both just arrived, one of us follows)
          const bothNew = Math.abs(this.partnerHelloAt - this.helloAt) < 5000 && this.partnerHelloAt > 0;
          if (this.leader || (bothNew && this.me < e.by)) break;
          if (Math.abs(this.v.currentTime - pos) > 2 || e.playing !== !this.v.paused) {
            this.apply({ pos, playing: e.playing });
            this.ui.note(`Caught up with ${name}.`);
          }
        } else if (!this.leader && !this.hold) {
          if (Math.abs(this.v.currentTime - pos) > 2 || e.playing !== !this.v.paused) this.apply({ pos, playing: e.playing });
        }
        break;
      }
      case 'buffering':
        this.setPartnerBuffering(e.on, e.pos);
        break;
      case 'title': {
        const prev = this.partnerWhere?.title?.key || e.from;
        this.partnerWhere = { title: e.title, pos: 0, playing: false };
        // they moved on to the next episode of what we were watching together: come along
        const sameShow = !!this.title && e.title.showKey === this.title.showKey;
        if (prev && prev === this.key && sameShow && e.title.key !== this.key && this.a.platform === 'netflix' && e.title.platform === 'netflix') {
          this.ui.note(`Following ${name} to ${titleLabel(e.title)}.`);
          window.setTimeout(() => location.assign(this.a.linkAt(e.title, 0)), 1200);
        }
        break;
      }
      case 'chat':
        this.ui.chat({ id: e.id, by: e.by, text: e.text, mine: false });
        break;
      case 'react':
        this.ui.react(e.kind, false);
        break;
      case 'lock':
        this.lock = e.on ? { on: true, by: e.by } : { on: false, by: '' };
        this.ui.note(e.on ? `${name} took the remote. Only they can pause and skip.` : `${name} put the remote down.`);
        break;
      case 'ready':
        this.ready.partner = e.on;
        if (e.on) this.ui.note(this.ready.me ? `${name} is ready too.` : `${name} is ready. Press “I'm ready” to start together.`);
        this.maybeCountdown();
        break;
      case 'countdown':
        if (!this.same(e.key)) break;
        this.runCountdown(e.pos, e.at + e.inMs, false);
        break;
    }
    this.ui.update();
  }

  private same(key: string | null) {
    return !key || !this.key || key === this.key;
  }

  private setPartnerBuffering(on: boolean, pos: number) {
    if (on === this.partnerBuffering) return;
    this.partnerBuffering = on;
    const v = this.v;
    if (!v) return;
    if (on && !v.paused) {
      this.hold = 'partner';
      this.apply({ pos: v.currentTime, playing: false });
      this.ui.waiting(`Waiting for ${this.partnerName}…`);
    } else if (!on && this.hold) {
      this.hold = null;
      this.ui.waiting(null);
      this.apply({ pos: pos || v.currentTime, playing: true });
    }
  }

  /* ---------------- things you do in the overlay ---------------- */

  sendChat(text: string) {
    const t = text.trim().slice(0, 500);
    if (!t || !this.session) return;
    const id = `${this.me}-${Date.now().toString(36)}`;
    this.send({ type: 'chat', id, text: t });
    this.ui.chat({ id, by: this.me, text: t, mine: true });
  }

  sendReact(kind: ReactionKind) {
    this.send({ type: 'react', kind });
    this.ui.react(kind, true);
  }

  toggleLock() {
    if (this.lock.on && this.lock.by !== this.me) return;
    const on = !this.lock.on;
    this.lock = on ? { on: true, by: this.me } : { on: false, by: '' };
    this.send({ type: 'lock', on });
    this.ui.note(on ? `You have the remote. Only you can pause and skip.` : `You put the remote down.`);
    this.ui.update();
  }

  toggleReady() {
    if (!this.partnerHere) {
      this.ui.note(`The countdown starts once ${this.partnerName} is here too.`);
      return;
    }
    this.ready.me = !this.ready.me;
    this.send({ type: 'ready', on: this.ready.me });
    if (this.ready.me && !this.ready.partner) this.ui.note(`Ready. Waiting for ${this.partnerName}…`);
    this.maybeCountdown();
    this.ui.update();
  }

  private resetReady() {
    if (this.ready.me) this.send({ type: 'ready', on: false });
    this.ready = { me: false, partner: false };
  }

  private maybeCountdown() {
    const p = this.session?.partner;
    if (!p || !this.v || !this.ready.me || !this.ready.partner || this.me > p.id) return;
    const pos = this.v.currentTime;
    this.send({ type: 'countdown', pos, inMs: 3500, key: this.key });
    this.runCountdown(pos, Date.now() + 3500, true);
  }

  private runCountdown(pos: number, startAt: number, mine: boolean) {
    this.ready = { me: false, partner: false };
    this.countingDown = true;
    this.clearHold();
    this.apply({ pos, playing: false });
    this.ui.countdown(startAt);
    window.setTimeout(
      () => {
        this.countingDown = false;
        this.ui.countdown(null);
        this.leader = mine;
        this.apply({ pos, playing: true });
      },
      Math.max(0, startAt - Date.now()),
    );
  }

  /** Jump to what your person is watching. */
  goToPartner() {
    const w = this.partnerWhere;
    if (!w?.title) return;
    location.assign(this.a.linkAt(w.title, projectedPosition(w.pos, Date.now(), false)));
  }

  /**
   * Where the two of you left off on this show, when that's worth pointing
   * out: you're on your own, or you're both behind where you'd got to.
   * (Moving on to the next episode together doesn't need a reminder.)
   */
  continueTarget() {
    const t = this.title;
    const log = this.log;
    if (!t || !log) return null;
    const s = log.shows[t.showKey];
    if (!s || s.key === t.key) return null;
    if (!this.partnerHere) return s;
    const order = (ep: string) => {
      const m = ep.match(/S(\d+):E(\d+)/);
      return m ? Number(m[1]) * 1000 + Number(m[2]) : null;
    };
    const here = order(t.episode);
    const there = order(s.episode);
    if (here !== null && there !== null) return here < there ? s : null;
    return this.v && this.v.paused && this.v.currentTime < 30 ? s : null;
  }

  goTo(url: string) {
    location.assign(url);
  }

  /* ---------------- don't watch ahead ---------------- */

  /** Returns true (and pauses) if you're about to watch an episode of "your" show without your person. */
  private guardCheck() {
    const t = this.title;
    const log = this.log;
    if (!t || !log || !this.partner || this.partnerHere || this.guardOpen) return false;
    if (!log.shows[t.showKey] || log.seen[t.key] || this.guardOK.has(t.key)) return false;
    this.guardOpen = true;
    this.apply({ pos: this.v?.currentTime || 0, playing: false });
    this.ui.guard({
      show: t.show,
      episode: t.episode,
      partner: this.partnerName,
      onWait: () => {
        this.guardOpen = false;
        this.ui.guard(null);
      },
      onWatch: () => {
        this.guardOpen = false;
        this.guardOK.add(t.key);
        this.ui.guard(null);
        this.a.play();
      },
    });
    return true;
  }

  /* ---------------- talking: turn the show down ---------------- */

  setTalking(anyone: boolean) {
    const v = this.v;
    if (!v) return;
    if (anyone && this.dipped === null) {
      this.dipped = v.volume;
      this.a.setVolume(Math.max(0.04, v.volume * 0.3));
    } else if (!anyone && this.dipped !== null) {
      this.a.setVolume(this.dipped);
      this.dipped = null;
    }
  }
}
