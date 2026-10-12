/**
 * Voice isolation for the Plus call: runs on the audio thread of the extension's hidden page, on your
 * microphone, before your voice is sent.
 *
 * 1. RNNoise (a small open-source neural network from Xiph.Org, compiled to WebAssembly by Jitsi) takes
 *    out background noise: fans, AC, traffic, keyboards, kitchen sounds. It works on 10 ms frames of
 *    48 kHz audio, so your voice is 10 ms later than it would be.
 * 2. A gate: RNNoise also says how sure it is that someone's speaking. When nobody is, the mic goes
 *    quiet (smoothly, and not between words), so the room doesn't go out in your pauses either.
 *
 * Switched off, the sound passes straight through. Nothing leaves this computer from here.
 */

// the audio thread's own globals (not in the DOM typings)
declare const sampleRate: number;
declare function registerProcessor(name: string, ctor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: unknown);
}

const FRAME = 480; // RNNoise's frame: 10 ms at 48 kHz
const SCALE = 32768; // RNNoise works on 16-bit sample values
/** sure enough that it's a voice to open the gate, and to keep it open */
const OPEN_AT = 0.6;
const KEEP_AT = 0.25;
/** how long the gate stays open after the last voiced frame (the gaps between words) */
const HOLD_FRAMES = 35; // 350 ms
/** how quiet the gate makes things (not quite silent, so it doesn't sound like the line dropped) */
const FLOOR = 0.02;

interface Rnn {
  memory: WebAssembly.Memory;
  process(state: number, out: number, input: number): number;
  state: number;
  inPtr: number;
  outPtr: number;
}

/** RNNoise, from the .wasm file's bytes (its two helper imports are tiny, so no loader script is needed) */
function loadRnn(bytes: ArrayBuffer): Rnn {
  let memory: WebAssembly.Memory | null = null;
  const imports = {
    a: {
      // grow the heap when RNNoise asks for more
      a: (requested: number) => {
        const m = memory!;
        const now = m.buffer.byteLength;
        const want = requested >>> 0;
        if (want <= now) return 1;
        try {
          m.grow(Math.ceil((want - now) / 65536));
          return 1;
        } catch {
          return 0;
        }
      },
      // memcpy for big blocks
      b: (dest: number, src: number, num: number) => {
        const u8 = new Uint8Array(memory!.buffer);
        u8.copyWithin(dest, src, src + num);
      },
    },
  };
  const inst = new WebAssembly.Instance(new WebAssembly.Module(bytes), imports);
  const ex = inst.exports as Record<string, unknown>;
  memory = ex.c as WebAssembly.Memory;
  (ex.d as () => void)(); // its start-up code
  const create = ex.f as (model: number) => number;
  const malloc = ex.g as (n: number) => number;
  const state = create(0);
  return {
    memory,
    process: ex.j as (s: number, o: number, i: number) => number,
    state,
    inPtr: malloc(FRAME * 4),
    outPtr: malloc(FRAME * 4),
  };
}

class Denoise extends AudioWorkletProcessor {
  private rnn: Rnn | null = null;
  private on = true;
  /** samples waiting to make up a frame, and cleaned samples waiting to go out */
  private pending = new Float32Array(FRAME);
  private pendingLen = 0;
  private ready = new Float32Array(FRAME * 4);
  private readyStart = 0;
  private readyLen = 0;
  private gate = 0;
  private hold = 0;

  constructor(options: { processorOptions?: { wasm?: ArrayBuffer; on?: boolean } }) {
    super(options);
    this.on = options.processorOptions?.on !== false;
    try {
      // RNNoise only works at 48 kHz (the hidden page asks for that rate)
      if (sampleRate === 48000 && options.processorOptions?.wasm) this.rnn = loadRnn(options.processorOptions.wasm);
    } catch {
      this.rnn = null;
    }
    this.port.postMessage({ ready: !!this.rnn });
    this.port.onmessage = (e: MessageEvent<{ on?: boolean }>) => {
      if (typeof e.data?.on === 'boolean') this.on = e.data.on;
    };
  }

  process(inputs: Float32Array[][], outputs: Float32Array[][]) {
    const input = inputs[0]?.[0];
    const output = outputs[0]?.[0];
    if (!output) return true;
    if (!input) {
      output.fill(0);
      return true;
    }
    if (!this.on || !this.rnn) {
      output.set(input);
      return true;
    }
    // in: gather 128-sample blocks into 480-sample frames, clean each frame
    let i = 0;
    while (i < input.length) {
      const n = Math.min(FRAME - this.pendingLen, input.length - i);
      this.pending.set(input.subarray(i, i + n), this.pendingLen);
      this.pendingLen += n;
      i += n;
      if (this.pendingLen === FRAME) {
        this.frame();
        this.pendingLen = 0;
      }
    }
    // out: what's been cleaned, 10 ms behind (silence for the very first moment)
    for (let k = 0; k < output.length; k++) {
      if (this.readyLen > 0) {
        output[k] = this.ready[this.readyStart];
        this.readyStart = (this.readyStart + 1) % this.ready.length;
        this.readyLen--;
      } else output[k] = 0;
    }
    return true;
  }

  private frame() {
    const r = this.rnn!;
    const heap = new Float32Array(r.memory.buffer);
    const inAt = r.inPtr >> 2;
    for (let k = 0; k < FRAME; k++) heap[inAt + k] = this.pending[k] * SCALE;
    const voice = r.process(r.state, r.outPtr, r.inPtr);
    // (the heap may have grown during the call)
    const out = new Float32Array(r.memory.buffer, r.outPtr, FRAME);
    // the gate: open on a voice, stay open through the gaps between words, then ease shut
    if (voice >= OPEN_AT || (this.hold > 0 && voice >= KEEP_AT)) this.hold = HOLD_FRAMES;
    else if (this.hold > 0) this.hold--;
    const target = this.hold > 0 ? 1 : FLOOR;
    // quick to open (about 2 ms), gentle to close (about 60 ms)
    const rate = target > this.gate ? 0.01 : 0.00035;
    for (let k = 0; k < FRAME; k++) {
      this.gate += (target - this.gate) * rate;
      const s = (out[k] / SCALE) * this.gate;
      if (this.readyLen === this.ready.length) {
        // (fell behind: drop the oldest rather than grow)
        this.readyStart = (this.readyStart + 1) % this.ready.length;
        this.readyLen--;
      }
      this.ready[(this.readyStart + this.readyLen) % this.ready.length] = s;
      this.readyLen++;
    }
  }
}

registerProcessor('soultied-denoise', Denoise);
