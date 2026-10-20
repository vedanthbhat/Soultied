import type { LiveChannel } from '../../cloud/live';
import { iceNow, loadIce } from '../../watch/ice';
import type { Seat } from '../types';

/**
 * The line between the two of you during a live game.
 *
 * It tries to connect your two browsers directly (WebRTC data channels), which
 * is quick enough for air hockey. Setting that up goes over the same live
 * channel as the watch room's play/pause, and so does every message until (or
 * unless) the direct line opens: if a network blocks direct links, the game
 * still works, just a little slower, and fast-changing things are sent less
 * often. Between two tabs of one browser the channel itself is instant.
 *
 * Messages are numbered, so one that arrives twice (over both routes while the
 * direct line opens) is only handled once.
 */

export type LinkMode = 'waiting' | 'connecting' | 'direct' | 'relay' | 'local';

export type PlayWire =
  | { t: 'hi'; by: string; at: number; mid: string; sid: string; seat: Seat }
  | { t: 'bye'; by: string; at: number; mid: string; sid: string }
  | { t: 'rtc'; by: string; at: number; mid: string; sid: string; to: string; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null }
  | { t: 'm'; by: string; at: number; mid: string; sid: string; n: number; fast?: boolean; d: unknown };

interface DcMsg {
  t: 'm' | 'ping';
  n?: number;
  fast?: boolean;
  d?: unknown;
}

/** how long without a word before we think they've gone */
const GONE_DIRECT_MS = 6000;
const GONE_RELAY_MS = 12000;
/** how long the direct line gets to open before we settle for the channel */
const DIRECT_WAIT_MS = 6500;
/** the slowest we'll send fast-changing things over the channel */
const RELAY_FAST_MS = 220;

export interface LinkOptions {
  chan: LiveChannel<PlayWire>;
  /** my account id (the channel checks it) */
  me: string;
  seat: Seat;
  /** the match this link is for; anything about another match is ignored */
  mid: string;
  onMessage: (d: unknown) => void;
  onChange: () => void;
}

export class GameLink {
  mode: LinkMode = 'waiting';
  partnerHere = false;
  private sid = Math.random().toString(36).slice(2, 10);
  private partnerSid: string | null = null;
  private lastHeard = 0;
  private pc: RTCPeerConnection | null = null;
  private rel: RTCDataChannel | null = null;
  private fast: RTCDataChannel | null = null;
  private pendingIce: RTCIceCandidateInit[] = [];
  private ice: RTCIceServer[] = iceNow();
  private outN = 0;
  /** reliable messages already handled (a recent window), and the newest fast one */
  private seenRel = new Set<number>();
  private inFast = 0;
  private fastQueued: unknown = undefined;
  private fastTimer = 0;
  private lastFastSent = 0;
  private timers: number[] = [];
  private directTimer = 0;
  private closed = false;
  private off: (() => void) | null = null;

  constructor(private o: LinkOptions) {}

  get local() {
    return this.o.chan.kind === 'local';
  }

  start() {
    this.off = this.o.chan.subscribe((e) => this.onWire(e));
    if (this.local) this.mode = 'local';
    loadIce().then((s) => (this.ice = s));
    this.hello();
    // a heartbeat: over the direct line when there is one (it's free), over the channel otherwise
    this.timers.push(
      window.setInterval(() => {
        if (this.closed) return;
        if (this.mode === 'direct') this.dcSend(this.rel, { t: 'ping' });
        const quiet = Date.now() - this.lastHeard;
        if (this.mode !== 'direct' && (this.local ? quiet > 1500 : quiet > 3500)) this.hello();
        const gone = this.mode === 'direct' ? GONE_DIRECT_MS : GONE_RELAY_MS;
        if (this.partnerHere && quiet > gone) {
          this.partnerHere = false;
          this.o.onChange();
        }
      }, 1000),
    );
    this.o.onChange();
  }

  private hello() {
    this.wire({ t: 'hi', seat: this.o.seat });
  }

  private wire(e: Omit<PlayWire, 'by' | 'at' | 'mid' | 'sid'> & Record<string, unknown>) {
    if (this.closed) return;
    // Firestore won't store `undefined`, so anything left undefined is dropped on the way
    const out = JSON.parse(JSON.stringify({ ...e, by: this.o.me, at: Date.now(), mid: this.o.mid, sid: this.sid })) as PlayWire;
    this.o.chan.send(out);
  }

  private heard() {
    this.lastHeard = Date.now();
    if (!this.partnerHere) {
      this.partnerHere = true;
      this.o.onChange();
    }
  }

  private onWire(e: PlayWire) {
    if (this.closed || !e || e.mid !== this.o.mid || e.by === this.o.me) return;
    if (e.t === 'hi') {
      this.heard();
      if (e.sid !== this.partnerSid) {
        // someone new (or them after a reload): tell them we're here, and connect afresh
        this.partnerSid = e.sid;
        this.seenRel.clear();
        this.inFast = 0;
        this.hello();
        if (!this.local) {
          if (this.mode === 'direct' || this.mode === 'waiting') this.setMode('connecting');
          if (this.o.seat === 'a') this.offer();
          this.armDirectTimer();
        }
      }
      return;
    }
    if (e.sid !== this.partnerSid) return;
    if (e.t === 'bye') {
      this.partnerHere = false;
      this.partnerSid = null;
      this.dropPc();
      if (!this.local) this.setMode('waiting');
      this.o.onChange();
      return;
    }
    this.heard();
    if (e.t === 'm') this.take(e.n, !!e.fast, e.d);
    else if (e.t === 'rtc' && e.to === this.sid) void this.onRtc(e);
  }

  private take(n: number, fast: boolean, d: unknown) {
    if (fast) {
      if (n <= this.inFast) return;
      this.inFast = n;
    } else {
      if (this.seenRel.has(n)) return;
      this.seenRel.add(n);
      if (this.seenRel.size > 400) for (const k of [...this.seenRel].slice(0, 200)) this.seenRel.delete(k);
    }
    this.o.onMessage(d);
  }

  private setMode(m: LinkMode) {
    if (this.mode === m) return;
    this.mode = m;
    this.o.onChange();
  }

  private armDirectTimer() {
    window.clearTimeout(this.directTimer);
    this.directTimer = window.setTimeout(() => {
      if (!this.closed && this.mode === 'connecting') this.setMode('relay');
    }, DIRECT_WAIT_MS);
  }

  /* ---------- the direct line ---------- */

  private dropPc() {
    try {
      this.rel?.close();
      this.fast?.close();
      this.pc?.close();
    } catch {
      // ignore
    }
    this.pc = null;
    this.rel = null;
    this.fast = null;
    this.pendingIce = [];
  }

  private makePc() {
    this.dropPc();
    if (typeof RTCPeerConnection === 'undefined') return null;
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    this.pc = pc;
    // both sides make the same two channels, so neither waits for the other to announce them
    const rel = pc.createDataChannel('rel', { negotiated: true, id: 0 });
    const fast = pc.createDataChannel('fast', { negotiated: true, id: 1, ordered: false, maxRetransmits: 0 });
    this.rel = rel;
    this.fast = fast;
    const onMsg = (ev: MessageEvent) => {
      if (pc !== this.pc) return;
      let m: DcMsg | null = null;
      try {
        m = JSON.parse(String(ev.data)) as DcMsg;
      } catch {
        return;
      }
      this.heard();
      if (m.t === 'm' && typeof m.n === 'number') this.take(m.n, !!m.fast, m.d);
    };
    rel.onmessage = onMsg;
    fast.onmessage = onMsg;
    rel.onopen = () => {
      if (pc !== this.pc) return;
      window.clearTimeout(this.directTimer);
      this.setMode('direct');
    };
    rel.onclose = () => {
      if (pc !== this.pc || this.closed) return;
      this.setMode(this.partnerHere ? 'relay' : 'waiting');
      // try again in a moment: whoever offers starts over
      if (this.o.seat === 'a' && this.partnerSid) window.setTimeout(() => !this.closed && this.mode === 'relay' && this.offer(), 3000);
    };
    pc.onicecandidate = ({ candidate }) => {
      if (pc !== this.pc || !this.partnerSid) return;
      this.wire({ t: 'rtc', to: this.partnerSid, candidate: candidate ? candidate.toJSON() : null });
    };
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      if (pc.connectionState === 'failed' && this.mode !== 'relay') this.setMode('relay');
    };
    return pc;
  }

  private async offer() {
    if (!this.partnerSid) return;
    const pc = this.makePc();
    if (!pc) return this.setMode('relay');
    try {
      await pc.setLocalDescription(await pc.createOffer());
      if (pc.localDescription && pc === this.pc) this.wire({ t: 'rtc', to: this.partnerSid, description: pc.localDescription.toJSON() });
    } catch {
      this.setMode('relay');
    }
  }

  private async onRtc(e: Extract<PlayWire, { t: 'rtc' }>) {
    try {
      if (e.description) {
        if (e.description.type === 'offer') {
          const pc = this.makePc();
          if (!pc) return this.setMode('relay');
          if (this.mode !== 'direct') this.setMode('connecting');
          this.armDirectTimer();
          await pc.setRemoteDescription(e.description);
          for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
          await pc.setLocalDescription(await pc.createAnswer());
          if (pc.localDescription && pc === this.pc && this.partnerSid) this.wire({ t: 'rtc', to: this.partnerSid, description: pc.localDescription.toJSON() });
        } else if (this.pc && this.pc.signalingState === 'have-local-offer') {
          await this.pc.setRemoteDescription(e.description);
          for (const c of this.pendingIce.splice(0)) await this.pc.addIceCandidate(c).catch(() => undefined);
        }
      } else if (e.candidate) {
        if (!this.pc || !this.pc.remoteDescription) this.pendingIce.push(e.candidate);
        else await this.pc.addIceCandidate(e.candidate).catch(() => undefined);
      }
    } catch {
      if (this.mode === 'connecting') this.setMode('relay');
    }
  }

  private dcSend(dc: RTCDataChannel | null, m: DcMsg) {
    if (!dc || dc.readyState !== 'open') return false;
    try {
      dc.send(JSON.stringify(m));
      return true;
    } catch {
      return false;
    }
  }

  /* ---------- sending ---------- */

  /**
   * Send something to the other person. `fast` is for things that change all
   * the time (a position, a tap count): only the latest matters, so over the
   * channel they're sent at most a few times a second.
   */
  send(d: unknown, fast = false) {
    if (this.closed) return;
    const n = ++this.outN;
    if (this.mode === 'direct' && this.dcSend(fast ? this.fast : this.rel, { t: 'm', n, fast, d })) return;
    if (!fast || this.local) {
      this.wire({ t: 'm', n, fast, d });
      return;
    }
    this.fastQueued = d;
    if (this.fastTimer) return;
    const wait = Math.max(0, RELAY_FAST_MS - (Date.now() - this.lastFastSent));
    this.fastTimer = window.setTimeout(() => {
      this.fastTimer = 0;
      if (this.closed || this.fastQueued === undefined) return;
      const q = this.fastQueued;
      this.fastQueued = undefined;
      this.lastFastSent = Date.now();
      this.wire({ t: 'm', n: ++this.outN, fast: true, d: q });
    }, wait);
  }

  close() {
    if (this.closed) return;
    this.wire({ t: 'bye' });
    this.closed = true;
    this.timers.forEach((t) => window.clearInterval(t));
    window.clearTimeout(this.directTimer);
    window.clearTimeout(this.fastTimer);
    this.dropPc();
    this.off?.();
  }
}
