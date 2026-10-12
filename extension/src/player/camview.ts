import type { CallFlags } from '../../../src/stream/protocol';
import type { CallView } from '../../../src/watch/call';

/**
 * The watch party's call, as this show tab sees it.
 *
 * The call runs in the extension's hidden page (it carries on while you switch shows). This tab gets
 * its state, and the pictures (your camera and theirs) over a local link from the hidden page: a
 * connection from this computer to itself, made again in a moment whenever the page changes.
 */
export class CamView {
  flags: CallFlags | null = null;
  private mine: MediaStream | null = null;
  private theirs: MediaStream | null = null;
  private port: chrome.runtime.Port | null = null;
  private pc: RTCPeerConnection | null = null;
  private want = false;
  private retry = 0;

  constructor(private changed: () => void) {}

  /** the call's state from the hidden page (null: no call) */
  set(f: CallFlags | null) {
    this.flags = f;
    this.changed();
  }

  /** the pictures are worth having here (something's showing, cameras aren't hidden): link up, or let go */
  show(on: boolean) {
    this.want = on && !!this.flags;
    if (this.want && !this.port) this.open();
    else if (!this.want && this.port) this.close();
  }

  /** what the overlay draws: the call's state, with the pictures from the local link */
  get view(): CallView | null {
    const f = this.flags;
    if (!f) return null;
    return {
      local: f.camOn ? this.mine : null,
      remote: this.theirs,
      camOn: f.camOn,
      micReady: f.micReady,
      micOpen: f.micOpen,
      talking: f.talking,
      partnerCam: f.partnerCam,
      partnerMic: f.partnerMic,
      partnerTalking: f.partnerTalking,
      link: f.link,
      stuck: f.stuck,
      busy: f.busy,
      error: f.error,
      denied: null,
    };
  }

  private open() {
    let port: chrome.runtime.Port;
    try {
      port = chrome.runtime.connect({ name: 'cams' });
    } catch {
      return;
    }
    this.port = port;
    const pc = new RTCPeerConnection();
    this.pc = pc;
    pc.ontrack = (e) => {
      // slot 0 is your camera, slot 1 is theirs (see CamLink in the hidden page)
      const s = new MediaStream([e.track]);
      if (e.transceiver?.mid === '0') this.mine = s;
      else this.theirs = s;
      e.track.onunmute = () => this.changed();
      this.changed();
    };
    pc.onicecandidate = (e) => this.post({ cand: e.candidate ? e.candidate.toJSON() : null });
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && this.pc === pc) this.relink();
    };
    port.onMessage.addListener(async (m: { desc?: RTCSessionDescriptionInit; cand?: RTCIceCandidateInit | null }) => {
      if (this.pc !== pc) return;
      try {
        if (m.desc) {
          await pc.setRemoteDescription(m.desc);
          if (m.desc.type === 'offer') {
            await pc.setLocalDescription();
            if (pc.localDescription) this.post({ desc: pc.localDescription.toJSON() });
          }
        } else if (m.cand) await pc.addIceCandidate(m.cand);
      } catch {
        this.relink();
      }
    });
    port.onDisconnect.addListener(() => {
      if (this.port !== port) return;
      // the hidden page went away (or restarted): try again shortly, if the pictures are still wanted
      this.close();
      this.relink();
    });
  }

  private relink() {
    this.close();
    window.clearTimeout(this.retry);
    this.retry = window.setTimeout(() => {
      if (this.want && !this.port) this.open();
    }, 1500);
  }

  private post(m: unknown) {
    try {
      this.port?.postMessage(m);
    } catch {
      // reconnecting
    }
  }

  private close() {
    const port = this.port;
    this.port = null;
    try {
      port?.disconnect();
    } catch {
      // gone already
    }
    this.pc?.close();
    this.pc = null;
    this.mine = null;
    this.theirs = null;
    this.changed();
  }
}
