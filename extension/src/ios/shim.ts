/**
 * The Soultied iPhone app runs the extension's player code (src/player) inside its own browser for Netflix
 * and Prime Video, in a script world of its own (WKContentWorld "soultied"), the way Chrome runs a content
 * script. This stands in for the bits of the extension API that code uses:
 *
 * - chrome.runtime.connect({ name: 'player' }): a line to the app (window.webkit.messageHandlers.soultied),
 *   which plays the part of the extension's background page and your Soultied tab at once. The app answers
 *   through window.__soultiedApp(portId, msg) and window.__soultiedAppGone(portId).
 * - chrome.storage.local: kept in the page's localStorage under "soultied:" (per site, like the extension's
 *   per-browser store), with the rating card marked as already asked (that's for the Chrome Web Store).
 * - chrome.runtime.getURL('fonts/…'): Soultied's pixel font, bundled in (see scripts/native-stream.mjs).
 *
 * Nothing here runs in the extension itself.
 */
import fontUrl from '../../../public/fonts/PixelifySans-Variable.ttf';

type Listener<A extends unknown[]> = (...a: A) => void;
interface Handler {
  postMessage(m: unknown): void;
}
const native = (): Handler | null => {
  const w = window as unknown as { webkit?: { messageHandlers?: Record<string, Handler> } };
  return w.webkit?.messageHandlers?.soultied ?? null;
};
const toApp = (m: unknown) => {
  try {
    native()?.postMessage(JSON.parse(JSON.stringify(m)));
  } catch {
    // the app's gone (the browser is closing)
  }
};

class AppPort {
  readonly name: string;
  readonly id: number;
  private onMsg: Listener<[unknown, AppPort]>[] = [];
  private onGone: Listener<[AppPort]>[] = [];
  private closed = false;

  constructor(name: string, id: number) {
    this.name = name;
    this.id = id;
  }
  postMessage(msg: unknown) {
    if (this.closed) throw new Error('disconnected');
    toApp({ op: 'msg', port: this.id, name: this.name, msg });
  }
  disconnect() {
    if (this.closed) return;
    this.closed = true;
    toApp({ op: 'bye', port: this.id, name: this.name });
  }
  onMessage = { addListener: (fn: Listener<[unknown, AppPort]>) => void this.onMsg.push(fn) };
  onDisconnect = { addListener: (fn: Listener<[AppPort]>) => void this.onGone.push(fn) };

  hear(msg: unknown) {
    if (this.closed) return;
    for (const fn of this.onMsg) fn(msg, this);
  }
  gone() {
    if (this.closed) return;
    this.closed = true;
    for (const fn of this.onGone) fn(this);
  }
}

const ports = new Map<number, AppPort>();
let nextPort = 0;

const KEY = 'soultied:';
const read = (k: string): unknown => {
  try {
    const v = localStorage.getItem(KEY + k);
    return v == null ? undefined : JSON.parse(v);
  } catch {
    return undefined;
  }
};
// the rating card at the end of a watch party asks for a review on the Chrome Web Store: not here
const fixed: Record<string, unknown> = { reviewAsked: 1, goodParty: 1 };
const local = {
  get(keys: string | string[]) {
    const out: Record<string, unknown> = {};
    for (const k of typeof keys === 'string' ? [keys] : keys) {
      const v = k in fixed ? fixed[k] : read(k);
      if (v !== undefined) out[k] = v;
    }
    return Promise.resolve(out);
  },
  set(items: Record<string, unknown>) {
    for (const [k, v] of Object.entries(items)) {
      if (k in fixed) continue;
      try {
        localStorage.setItem(KEY + k, JSON.stringify(v));
      } catch {
        // storage full or off: it's a nicety
      }
    }
    return Promise.resolve();
  },
  remove(keys: string | string[]) {
    for (const k of typeof keys === 'string' ? [keys] : keys) {
      try {
        localStorage.removeItem(KEY + k);
      } catch {
        // fine
      }
    }
    return Promise.resolve();
  },
};

const FONT = 'soultied-app:fonts/PixelifySans-Variable.ttf';
/** the font's bytes, straight from the bundle (no fetch: the site's own rules could refuse a data: address) */
const fontBytes = () => {
  const b64 = fontUrl.slice(fontUrl.indexOf(',') + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const realFetch = window.fetch.bind(window);
// (this world's own fetch: the page's is untouched)
(globalThis as unknown as { fetch: typeof fetch }).fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input) === FONT ? Promise.resolve(new Response(fontBytes(), { headers: { 'content-type': 'font/ttf' } })) : realFetch(input, init);

const app = {
  runtime: {
    id: 'soultied-ios',
    connect(info: { name: string }) {
      const p = new AppPort(info.name, ++nextPort);
      ports.set(p.id, p);
      toApp({ op: 'connect', port: p.id, name: info.name, url: location.href });
      return p;
    },
    sendMessage(msg: unknown) {
      toApp({ op: 'note', msg });
      return Promise.resolve(undefined);
    },
    onMessage: { addListener: () => undefined },
    getURL: (path: string) => (path === 'fonts/PixelifySans-Variable.ttf' ? FONT : `soultied-app:${path}`),
    getManifest: () => ({ version: 'ios' }),
  },
  storage: {
    local,
    onChanged: { addListener: () => undefined },
    session: local,
  },
  dom: undefined,
};

const w = window as unknown as {
  chrome?: unknown;
  __soultiedApp?: (port: number, msg: unknown) => void;
  __soultiedAppGone?: (port: number) => void;
};
w.chrome = app;
// (the player's overlay leaves out what's only for a laptop: hold T to talk, the Soultied tab's cameras)
(globalThis as unknown as { __soultiedInApp: boolean }).__soultiedInApp = true;
(globalThis as unknown as { chrome: unknown }).chrome = app;
w.__soultiedApp = (port, msg) => ports.get(port)?.hear(msg);
w.__soultiedAppGone = (port) => {
  ports.get(port)?.gone();
  ports.delete(port);
};
