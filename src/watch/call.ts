import type { WatchEvent } from './sync';
import { hasRelay, iceNow, loadIce } from './ice';

/**
 * A two-person video call for the watch room, over WebRTC.
 *
 * - Cameras are on/off per person. Turning yours off stops the camera light.
 * - Microphones are push-to-talk: your voice is only sent while you hold Talk.
 * - Signalling (offers, answers, network candidates) travels over the same
 *   transport as the play/pause sync, so it works wherever that works: between
 *   two tabs today, and between two devices once the backend replaces it.
 *
 * Uses the "perfect negotiation" pattern, so either side can add a camera at
 * any moment without the two offers colliding. When a direct line between the
 * two of you is blocked, it goes through a relay (see ice.ts) if the site has one.
 */

export type CallLink = 'idle' | 'connecting' | 'connected' | 'lost';

export interface CallView {
  /** my camera preview (null while my camera is off) */
  local: MediaStream | null;
  /** what arrives from the other person */
  remote: MediaStream | null;
  camOn: boolean;
  /** true once the mic has been allowed (we keep it, muted, between presses) */
  micReady: boolean;
  talking: boolean;
  partnerCam: boolean;
  partnerTalking: boolean;
  link: CallLink;
  /** we've tried for a while and can't reach the other person (their picture and voice won't come through) */
  stuck: boolean;
  busy: 'cam' | 'mic' | null;
  error: string | null;
}

/** how long a connection may take before we say it isn't getting through */
const STUCK_MS = 20_000;

/** what to tell you when the two of you can't reach each other */
export const stuckMessage = (partnerName: string) =>
  hasRelay()
    ? `Can't reach ${partnerName}'s camera and mic right now. Check your connection, or try again in a minute.`
    : `Can't reach ${partnerName}'s camera and mic. One of your networks (often mobile data, or college or office Wi-Fi) blocks direct calls. Try another network, like home Wi-Fi.`;

function describeMediaError(err: unknown, what: 'camera' | 'microphone') {
  const name = (err as { name?: string })?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return `Your ${what} is blocked. Allow it from the icon in the address bar, then try again.`;
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return `No ${what} found on this device.`;
  if (name === 'NotReadableError') return `Your ${what} is busy in another app. Close it there and try again.`;
  return `Couldn't start your ${what}.`;
}

export class WatchCall {
  view: CallView = {
    local: null,
    remote: null,
    camOn: false,
    micReady: false,
    talking: false,
    partnerCam: false,
    partnerTalking: false,
    link: 'idle',
    stuck: false,
    busy: null,
    error: null,
  };

  private listeners = new Set<() => void>();
  private pc: RTCPeerConnection | null = null;
  private partner: string | null = null;
  private makingOffer = false;
  private ignoreOffer = false;
  private pendingIce: RTCIceCandidateInit[] = [];
  private cam: MediaStreamTrack | null = null;
  private mic: MediaStreamTrack | null = null;
  private camSender: RTCRtpSender | null = null;
  private micSender: RTCRtpSender | null = null;
  private outStream = new MediaStream();
  private holding = false;
  private closed = false;
  private ice: RTCIceServer[] = iceNow();
  private restarts = 0;
  private stuckTimer = 0;
  private dropTimer = 0;

  constructor(
    private me: string,
    private send: (e: WatchEvent) => void,
  ) {}

  /** The relay arrived (or its logins were renewed): use it for this connection too, if it hasn't connected yet. */
  private useIce(servers: RTCIceServer[]) {
    this.ice = servers;
    const pc = this.pc;
    if (!pc || this.closed || pc.connectionState === 'connected') return;
    try {
      pc.setConfiguration({ ...pc.getConfiguration(), iceServers: servers });
      if (pc.iceGatheringState !== 'new') pc.restartIce?.();
    } catch {
      // an older browser: the next connection picks it up
    }
  }

  private clearTimers() {
    window.clearTimeout(this.stuckTimer);
    window.clearTimeout(this.dropTimer);
    this.stuckTimer = 0;
    this.dropTimer = 0;
  }

  /** If this connection isn't through in a while, say so and try again. */
  private arm(pc: RTCPeerConnection) {
    window.clearTimeout(this.stuckTimer);
    this.stuckTimer = window.setTimeout(() => {
      if (pc !== this.pc || this.closed || pc.connectionState === 'connected') return;
      // nothing to send and nothing offered to us: there's no call to make yet
      if (!this.cam && !this.mic && !pc.remoteDescription) return;
      this.set({ stuck: true });
      this.retry(pc);
    }, STUCK_MS);
  }

  /** Try the network path again, with fresh relay logins. Gives up (and says so) after a few goes. */
  private retry(pc: RTCPeerConnection) {
    if (pc !== this.pc || this.closed) return;
    if (this.restarts >= 3) {
      window.clearTimeout(this.stuckTimer);
      this.set({ link: 'lost', stuck: true });
      return;
    }
    this.restarts++;
    if (pc.signalingState !== 'stable') {
      // our offer was never answered (it went missing on the way): start over with a fresh one
      this.rebuild();
      return;
    }
    void loadIce().then((servers) => {
      if (pc !== this.pc || this.closed) return;
      this.ice = servers;
      try {
        pc.setConfiguration({ ...pc.getConfiguration(), iceServers: servers });
      } catch {
        // keep what it has
      }
      pc.restartIce?.();
      this.arm(pc);
    });
  }

  /* ---------- state for the UI ---------- */

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private set(patch: Partial<CallView>) {
    this.view = { ...this.view, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  /** tell the other side what my camera and mic are doing */
  announce() {
    this.send({ type: 'media', cam: this.view.camOn, talking: this.view.talking, by: this.me, at: Date.now() });
  }

  /* ---------- the connection ---------- */

  /** Who backs down if we both make an offer at the same moment. */
  private get polite() {
    return !!this.partner && this.me > this.partner;
  }

  setPartner(id: string | null) {
    if (id === this.partner) return;
    this.partner = id;
    // someone to call: fetch the relay's logins now, so they're ready before either of you turns a camera on
    if (id) void loadIce().then((servers) => this.useIce(servers));
    this.reset();
  }

  /** The other person (re)joined or left: start a fresh connection. */
  reset() {
    this.teardown(true);
    this.restarts = 0;
    if (this.partner && !this.closed && (this.cam || this.mic)) this.ensurePc();
  }

  /** A broken connection: start a new one, still remembering what the other person has on. */
  private rebuild() {
    this.teardown(false);
    if (this.partner && !this.closed && (this.cam || this.mic)) this.ensurePc();
  }

  /** Close the connection. `fresh`: the other person came or went, so forget what they had on too. */
  private teardown(fresh: boolean) {
    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.ontrack = null;
      this.pc.onnegotiationneeded = null;
      this.pc.onconnectionstatechange = null;
      this.pc.close();
    }
    this.pc = null;
    this.camSender = null;
    this.micSender = null;
    this.pendingIce = [];
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.clearTimers();
    this.set(fresh ? { remote: null, link: 'idle', stuck: false, partnerCam: false, partnerTalking: false } : { remote: null, link: 'idle' });
  }

  private ensurePc() {
    if (this.pc || !this.partner || this.closed || typeof RTCPeerConnection === 'undefined') return this.pc;
    const pc = new RTCPeerConnection({ iceServers: this.ice });
    this.pc = pc;
    this.set({ link: 'connecting' });
    this.clearTimers();
    this.arm(pc);
    pc.onicecandidate = ({ candidate }) => this.signal({ candidate: candidate ? candidate.toJSON() : null });
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        if (pc.localDescription) this.signal({ description: pc.localDescription.toJSON() });
      } catch {
        // a newer negotiation will follow
      } finally {
        this.makingOffer = false;
      }
    };
    pc.ontrack = (e) => {
      // a fresh stream object each time, so the picture element notices the new track
      const tracks = (this.view.remote?.getTracks() || []).filter((t) => t !== e.track && t.readyState === 'live');
      this.set({ remote: new MediaStream([...tracks, e.track]) });
    };
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      const s = pc.connectionState;
      if (s === 'connected') {
        this.restarts = 0;
        this.clearTimers();
        this.set({ link: 'connected', stuck: false });
        return;
      }
      this.set({ link: s === 'failed' || s === 'disconnected' ? 'lost' : 'connecting' });
      if (s === 'failed') this.retry(pc);
      else if (s === 'disconnected') {
        // often a blip (switching networks): give it a few seconds to come back by itself
        window.clearTimeout(this.dropTimer);
        this.dropTimer = window.setTimeout(() => {
          if (pc === this.pc && pc.connectionState === 'disconnected') this.retry(pc);
        }, 5000);
      }
    };
    if (this.cam) this.camSender = pc.addTrack(this.cam, this.outStream);
    if (this.mic) this.micSender = pc.addTrack(this.mic, this.outStream);
    return pc;
  }

  private signal(payload: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null }) {
    if (!this.partner) return;
    this.send({ type: 'rtc', to: this.partner, by: this.me, at: Date.now(), ...payload });
  }

  /** Something from the other person: signalling or their camera / mic state. */
  async handle(e: WatchEvent) {
    if (this.closed || e.by === this.me) return;
    if (e.type === 'media') {
      this.set({ partnerCam: e.cam, partnerTalking: e.talking });
      return;
    }
    if (e.type !== 'rtc' || e.to !== this.me) return;
    if (!this.partner) this.partner = e.by;
    const pc = this.ensurePc();
    if (!pc) return;
    try {
      if (e.description) {
        const offerCollision = e.description.type === 'offer' && (this.makingOffer || pc.signalingState !== 'stable');
        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) return;
        await pc.setRemoteDescription(e.description);
        for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => undefined);
        if (e.description.type === 'offer') {
          await pc.setLocalDescription();
          if (pc.localDescription) this.signal({ description: pc.localDescription.toJSON() });
        }
      } else if (e.candidate !== undefined) {
        if (!e.candidate) return;
        if (!pc.remoteDescription) this.pendingIce.push(e.candidate);
        else
          await pc.addIceCandidate(e.candidate).catch((err) => {
            if (!this.ignoreOffer) throw err;
          });
      }
    } catch {
      // a broken negotiation: start over cleanly (their camera is still on, so keep showing it when it comes back)
      this.rebuild();
    }
  }

  /* ---------- my camera ---------- */

  async setCamera(on: boolean) {
    if (on === this.view.camOn || this.view.busy) return;
    if (!on) {
      this.cam?.stop();
      if (this.cam) this.outStream.removeTrack(this.cam);
      this.cam = null;
      await this.camSender?.replaceTrack(null).catch(() => undefined);
      this.set({ camOn: false, local: null });
      this.announce();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.set({ error: 'This browser can’t use a camera here.' });
      return;
    }
    this.set({ busy: 'cam', error: null });
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' },
        audio: false,
      });
      if (this.closed) {
        s.getTracks().forEach((t) => t.stop());
        return;
      }
      const track = s.getVideoTracks()[0];
      track.contentHint = 'motion';
      this.cam = track;
      this.outStream.addTrack(track);
      if (this.camSender) await this.camSender.replaceTrack(track);
      else if (this.pc) this.camSender = this.pc.addTrack(track, this.outStream);
      else this.ensurePc();
      this.set({ camOn: true, local: new MediaStream([track]), busy: null });
      this.announce();
    } catch (err) {
      this.set({ busy: null, error: describeMediaError(err, 'camera') });
    }
  }

  /* ---------- push to talk ---------- */

  async talk(down: boolean) {
    this.holding = down;
    if (down && !this.mic) {
      if (this.view.busy) return;
      if (!navigator.mediaDevices?.getUserMedia) {
        this.set({ error: 'This browser can’t use a microphone here.' });
        return;
      }
      this.set({ busy: 'mic', error: null });
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        if (this.closed) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        const track = s.getAudioTracks()[0];
        track.enabled = false;
        this.mic = track;
        this.outStream.addTrack(track);
        if (this.micSender) await this.micSender.replaceTrack(track);
        else if (this.pc) this.micSender = this.pc.addTrack(track, this.outStream);
        else this.ensurePc();
        this.set({ micReady: true, busy: null });
      } catch (err) {
        this.set({ busy: null, error: describeMediaError(err, 'microphone') });
        return;
      }
    }
    if (!this.mic) return;
    // if the permission prompt took a while, only talk if they're still holding
    const on = this.holding;
    this.mic.enabled = on;
    if (on !== this.view.talking) {
      this.set({ talking: on });
      this.announce();
    }
  }

  /** Ask for the microphone now (kept muted), so push-to-talk works later from another tab. */
  async prepareMic() {
    if (this.mic) return;
    const asking = this.talk(true);
    this.holding = false;
    await asking;
  }

  clearError() {
    this.set({ error: null });
  }

  destroy() {
    this.closed = true;
    this.clearTimers();
    this.cam?.stop();
    this.mic?.stop();
    this.cam = null;
    this.mic = null;
    if (this.view.camOn || this.view.talking) this.send({ type: 'media', cam: false, talking: false, by: this.me, at: Date.now() });
    this.pc?.close();
    this.pc = null;
    this.listeners.clear();
  }
}
