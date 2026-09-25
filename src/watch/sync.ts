import type { ReactionKind } from '../pixel/watchRoom';

/**
 * Messages the two couch-mates exchange while watching. The transport is
 * pluggable: today it's a BroadcastChannel (works between tabs of one
 * browser, which is how the prototype stores everything). When the backend
 * lands, an online transport with the same shape replaces it and the watch
 * room doesn't change.
 */

export type WatchEvent =
  | { type: 'load'; videoId: string; pos: number; by: string; at: number }
  | { type: 'play'; pos: number; by: string; at: number }
  | { type: 'pause'; pos: number; by: string; at: number }
  | { type: 'seek'; pos: number; playing: boolean; by: string; at: number }
  | { type: 'state'; videoId: string | null; pos: number; playing: boolean; by: string; at: number; reply?: boolean }
  | { type: 'hello'; by: string; at: number }
  | { type: 'ping'; by: string; at: number }
  | { type: 'bye'; by: string; at: number }
  | { type: 'react'; kind: ReactionKind; by: string; at: number }
  | { type: 'chat'; id: string; text: string; by: string; name: string; at: number };

export interface WatchTransport {
  kind: 'local' | 'online';
  send(e: WatchEvent): void;
  subscribe(fn: (e: WatchEvent) => void): () => void;
  close(): void;
}

export function localTransport(roomId: string): WatchTransport {
  const name = `soultied-watch-${roomId}`;
  const listeners = new Set<(e: WatchEvent) => void>();
  let bc: BroadcastChannel | null = null;
  let onStorage: ((ev: StorageEvent) => void) | null = null;

  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(name);
    bc.onmessage = (m) => listeners.forEach((fn) => fn(m.data as WatchEvent));
  } else {
    // very old browsers: fall back to storage events
    onStorage = (ev) => {
      if (ev.key !== name || !ev.newValue) return;
      try {
        const e = JSON.parse(ev.newValue) as WatchEvent;
        listeners.forEach((fn) => fn(e));
      } catch {
        // ignore
      }
    };
    window.addEventListener('storage', onStorage);
  }

  return {
    kind: 'local',
    send(e) {
      if (bc) bc.postMessage(e);
      else {
        try {
          localStorage.setItem(name, JSON.stringify({ ...e, _n: Math.random() }));
        } catch {
          // ignore
        }
      }
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      bc?.close();
      if (onStorage) window.removeEventListener('storage', onStorage);
      listeners.clear();
    },
  };
}

/** Where the other person's player *should* be right now. */
export function projectedPosition(pos: number, at: number, playing: boolean, now = Date.now()) {
  return playing ? pos + Math.max(0, now - at) / 1000 : pos;
}
