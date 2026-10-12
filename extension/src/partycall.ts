import type { CallCmd, CallFlags, StreamEvent } from '../../src/stream/protocol';
import { WatchCall } from '../../src/watch/call';
import type { WatchEvent } from '../../src/watch/sync';

/**
 * The cameras-and-voice call of a Plus watch party, run by the extension's hidden page.
 *
 * It used to run inside the Netflix / Prime tab, so switching shows (a new page) dropped it: pictures
 * and voice went, and the browser could ask for the camera and mic all over again. Here it carries on
 * while you move between shows, and the camera and mic are allowed once, for Soultied itself (a small
 * Soultied window asks the first time).
 *
 * - Your person's voice plays from here, through a gentle compressor (so a shout or a whisper both come
 *   out at a comfortable level) and your "their voice" volume.
 * - Your voice goes out through your "my mic" volume.
 * - The show tab gets the pictures (yours and theirs) over a local link: see CamLink below and
 *   player/camview.ts.
 */

export interface PartyCallHost {
  send(e: StreamEvent): void;
  /** the call's state, for the show tabs (null: no call) */
  flags(f: CallFlags | null): void;
  /** the camera and mic need allowing: open the small Soultied window that asks */
  ask(): void;
}

const VOLUMES_KEY = 'callVolumes';

export class PartyCall {
  private call: WatchCall | null = null;
  private key = '';
  private links = new Set<CamLink>();
  private micVolume = 1;
  private speakerVolume = 1;
  /** waiting on the "allow camera and mic" window: what to do once it's allowed */
  private pending: CallCmd[] = [];
  private asking = false;
  /** their voice */
  private audio: HTMLAudioElement | null = null;
  private playingTrack: MediaStreamTrack | null = null;
  private graph: { ctx: AudioContext; src: MediaStreamAudioSourceNode | null; gain: GainNode; comp: DynamicsCompressorNode } | null = null;
  private lastFlags = '';
  /** something to tell you that the call itself doesn't know about */
  private problem: string | null = null;

  constructor(private host: PartyCallHost) {
    // your volumes from last time (a hidden page can't use chrome.storage; its own storage is fine)
    try {
      const v = JSON.parse(localStorage.getItem(VOLUMES_KEY) || 'null') as { mic?: number; speaker?: number } | null;
      if (typeof v?.mic === 'number') this.micVolume = clampVolume(v.mic);
      if (typeof v?.speaker === 'number') this.speakerVolume = clampVolume(v.speaker);
    } catch {
      // first time, or storage unavailable: as they come
    }
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name !== 'cams') return;
      const link = new CamLink(port, () => this.links.delete(link));
      this.links.add(link);
      link.show(this.call?.camTrack || null, this.partnerVideo());
    });
  }

  get active() {
    return !!this.call;
  }

  /** Start, keep or end the call, to match the party (two of you, and Plus). */
  sync(me: string | null, partyId: string | null, partner: string | null, plus: boolean) {
    const key = me && partyId && partner && plus ? `${me}|${partyId}|${partner}` : '';
    if (key === this.key) return;
    this.end();
    if (!key) return;
    this.key = key;
    const c = new WatchCall(me!, (e: WatchEvent) => this.host.send(e as StreamEvent), { processMic: true });
    this.call = c;
    c.setMicVolume(this.micVolume);
    c.setPartner(partner);
    c.subscribe(() => {
      if (this.call !== c) return;
      this.changed(c);
    });
    this.changed(c);
    // say what's on here, so the other side knows whether to expect a picture
    c.announce();
  }

  /** From your person: call signalling, or what their camera and mic are doing. */
  handle(e: StreamEvent) {
    if (!this.call) return;
    if (e.type === 'rtc' || e.type === 'media') void this.call.handle(e as WatchEvent);
    // they (re)joined: make sure they know what's on here
    else if (e.type === 'hello') this.call.announce();
  }

  /** `retry`: straight after the "allow" window said yes (so don't send you back to it) */
  async command(cmd: CallCmd, retry = false) {
    const c = this.call;
    if (cmd.op === 'micVolume' || cmd.op === 'speakerVolume') {
      if (cmd.op === 'micVolume') {
        this.micVolume = clampVolume(cmd.v);
        c?.setMicVolume(this.micVolume);
      } else {
        this.speakerVolume = clampVolume(cmd.v);
        this.applySpeaker();
      }
      try {
        localStorage.setItem(VOLUMES_KEY, JSON.stringify({ mic: this.micVolume, speaker: this.speakerVolume }));
      } catch {
        // kept for this session only
      }
      this.push(true);
      return;
    }
    if (!c) return;
    const turningOn = cmd.op === 'camera' ? cmd.on : cmd.op === 'mic' ? cmd.open : cmd.down;
    // Not allowed for Soultied yet: this hidden page can't ask (and trying here only counts as a "no" in
    // Chrome's eyes), so the small Soultied window asks, and then it happens.
    if (turningOn && !retry) {
      const state = await permission(cmd.op === 'camera' ? 'camera' : 'microphone');
      if (state === 'prompt' || state === 'denied') return this.askFirst(cmd);
    }
    if (cmd.op === 'camera') await c.setCamera(cmd.on);
    else if (cmd.op === 'mic') await c.setMic(cmd.open);
    else if (cmd.op === 'talk') await c.talk(cmd.down);
    // the browser said no anyway
    if (turningOn && c.view.denied && this.call === c) {
      if (!retry) return this.askFirst(cmd);
      c.clearError();
      this.problem = `Chrome didn’t let Soultied use your ${cmd.op === 'camera' ? 'camera' : 'mic'}. Try again in a moment.`;
      this.push();
      this.problem = null;
    }
  }

  private askFirst(cmd: CallCmd) {
    // (holding T: once it's allowed, just hold T again; we don't leave your mic on)
    if (cmd.op !== 'talk') this.pending = [...this.pending.filter((p) => p.op !== cmd.op), cmd];
    this.asking = true;
    this.call?.clearError();
    this.host.ask();
    this.push(true);
  }

  /** The "allow camera and mic" window got a yes: do what you asked for. */
  async allowed() {
    const todo = this.pending;
    this.pending = [];
    this.asking = false;
    this.push(true);
    for (const cmd of todo) await this.command(cmd, true);
  }

  /** Nothing's showing in any tab for a while: turn your camera off and mute (nobody can see you're on). */
  quiet() {
    const c = this.call;
    if (!c) return;
    if (c.view.camOn) void c.setCamera(false);
    if (c.view.micOpen) void c.setMic(false);
  }

  /** Say how things are to the show tabs (again: a tab just arrived). */
  push(force = false) {
    const c = this.call;
    if (!c) {
      if (force || this.lastFlags !== 'null') this.host.flags(null);
      this.lastFlags = 'null';
      return;
    }
    const v = c.view;
    const f: CallFlags = {
      camOn: v.camOn,
      micReady: v.micReady,
      micOpen: v.micOpen,
      talking: v.talking,
      partnerCam: v.partnerCam,
      partnerMic: v.partnerMic,
      partnerTalking: v.partnerTalking,
      link: v.link,
      stuck: v.stuck,
      busy: v.busy,
      error: this.problem || v.error,
      asking: this.asking,
      micVolume: this.micVolume,
      speakerVolume: this.speakerVolume,
    };
    const json = JSON.stringify(f);
    if (!force && json === this.lastFlags) return;
    this.lastFlags = json;
    this.host.flags(f);
  }

  end() {
    this.call?.destroy();
    this.call = null;
    this.key = '';
    this.pending = [];
    this.asking = false;
    this.playRemote(null);
    this.links.forEach((l) => l.show(null, null));
    this.push();
  }

  /* ---------- inside ---------- */

  private changed(c: WatchCall) {
    this.playRemote(c.view.remote);
    const cam = c.camTrack;
    const theirs = this.partnerVideo();
    this.links.forEach((l) => l.show(cam, theirs));
    this.push();
  }

  private partnerVideo() {
    return this.call?.view.remote?.getVideoTracks().find((t) => t.readyState === 'live') || null;
  }

  /** Play your person's voice: evened out by a compressor, at your "their voice" volume. */
  private playRemote(stream: MediaStream | null) {
    const track = stream?.getAudioTracks().find((t) => t.readyState === 'live') || null;
    if (track === this.playingTrack) return;
    this.playingTrack = track;
    if (this.graph?.src) {
      this.graph.src.disconnect();
      this.graph.src = null;
    }
    if (!track) {
      if (this.audio) this.audio.srcObject = null;
      return;
    }
    const s = new MediaStream([track]);
    // Chrome only feeds a call's sound into the audio graph while an element is playing it too
    if (!this.audio) {
      this.audio = document.createElement('audio');
      this.audio.autoplay = true;
      document.body.append(this.audio);
    }
    this.audio.srcObject = s;
    let viaGraph = false;
    try {
      if (!this.graph) {
        const ctx = new AudioContext();
        const comp = ctx.createDynamicsCompressor();
        // voices: tame the loud bits, so a shout and a whisper end up closer together
        comp.threshold.value = -26;
        comp.knee.value = 12;
        comp.ratio.value = 5;
        comp.attack.value = 0.004;
        comp.release.value = 0.25;
        const gain = ctx.createGain();
        comp.connect(gain).connect(ctx.destination);
        this.graph = { ctx, src: null, gain, comp };
      }
      const g = this.graph;
      void g.ctx.resume().catch(() => undefined);
      if (g.ctx.state !== 'closed') {
        g.src = g.ctx.createMediaStreamSource(s);
        g.src.connect(g.comp);
        viaGraph = true;
      }
    } catch {
      viaGraph = false;
    }
    // through the graph, the element stays silent (or you'd hear them twice)
    this.audio.muted = viaGraph;
    this.applySpeaker();
    void this.audio.play().catch(() => undefined);
    // if the graph never gets going, play it plainly rather than not at all
    if (viaGraph)
      window.setTimeout(() => {
        if (this.graph?.ctx.state !== 'running' && this.audio && this.playingTrack === track) {
          this.audio.muted = false;
          this.applySpeaker();
        }
      }, 1500);
  }

  private applySpeaker() {
    const g = this.graph;
    // a little lift to make up for the compressor taking the peaks down
    if (g) g.gain.gain.setTargetAtTime(this.speakerVolume * 1.4, g.ctx.currentTime, 0.05);
    if (this.audio) this.audio.volume = Math.min(1, this.speakerVolume);
  }
}

const clampVolume = (v: number) => (Number.isFinite(v) ? Math.max(0, Math.min(2, v)) : 1);

async function permission(name: 'camera' | 'microphone'): Promise<PermissionState | 'unknown'> {
  try {
    return (await navigator.permissions.query({ name: name as PermissionName })).state;
  } catch {
    return 'unknown';
  }
}

/**
 * The pictures for one show tab: a local connection (this computer to itself) carrying your camera and
 * theirs. When you switch shows the tab reconnects in a moment; the call itself never stopped.
 * Two video slots, always in this order: 0 = yours, 1 = theirs.
 */
class CamLink {
  private pc: RTCPeerConnection | null = new RTCPeerConnection();
  private mine: RTCRtpTransceiver;
  private theirs: RTCRtpTransceiver;

  constructor(
    private port: chrome.runtime.Port,
    private gone: () => void,
  ) {
    const pc = this.pc!;
    this.mine = pc.addTransceiver('video', { direction: 'sendonly' });
    this.theirs = pc.addTransceiver('video', { direction: 'sendonly' });
    pc.onicecandidate = (e) => this.post({ cand: e.candidate ? e.candidate.toJSON() : null });
    port.onMessage.addListener((m: { desc?: RTCSessionDescriptionInit; cand?: RTCIceCandidateInit | null }) => {
      if (!this.pc) return;
      if (m.desc) void this.pc.setRemoteDescription(m.desc).catch(() => this.close());
      else if (m.cand) void this.pc.addIceCandidate(m.cand).catch(() => undefined);
    });
    port.onDisconnect.addListener(() => this.close());
    void pc
      .setLocalDescription()
      .then(() => pc.localDescription && this.post({ desc: pc.localDescription.toJSON() }))
      .catch(() => this.close());
  }

  show(mine: MediaStreamTrack | null, theirs: MediaStreamTrack | null) {
    if (!this.pc) return;
    if (this.mine.sender.track !== mine) void this.mine.sender.replaceTrack(mine).catch(() => undefined);
    if (this.theirs.sender.track !== theirs) void this.theirs.sender.replaceTrack(theirs).catch(() => undefined);
  }

  private post(m: unknown) {
    try {
      this.port.postMessage(m);
    } catch {
      this.close();
    }
  }

  private close() {
    if (!this.pc) return;
    this.pc.close();
    this.pc = null;
    this.gone();
  }
}
