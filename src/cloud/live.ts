import type { CloudDb } from './firebase';

/**
 * A live channel between the two of you (play/pause, chat, video-call
 * signalling, escape rooms) carried by Firestore: every message is a tiny
 * document the other person's listener picks up a moment later.
 *
 * Same shape as the in-browser channels, so the watch room and escape rooms
 * don't care which one they're using.
 */

export interface LiveChannel<E> {
  kind: 'local' | 'online';
  send(e: E): void;
  subscribe(fn: (e: E) => void): () => void;
  close(): void;
}

/**
 * A place's channel for one topic. Firestore loads the first time one's opened (see firebase.ts), so for
 * that first moment what you send waits here and goes as soon as it can.
 */
export function firestoreChannel<E extends { by: string; at: number }>(db: CloudDb, spaceId: string, topic: 'watch' | 'karaoke' | 'escape' | 'stream' | 'doodle' | 'play'): LiveChannel<E> {
  const listeners = new Set<(e: E) => void>();
  let real: LiveChannel<E> | null = null;
  let closed = false;
  const waiting: E[] = [];
  Promise.all([import('./liveFs'), db.get()]).then(
    ([m, d]) => {
      if (closed) return;
      real = m.firestoreChannel<E>(d, spaceId, topic);
      real.subscribe((e) => listeners.forEach((fn) => fn(e)));
      waiting.splice(0).forEach((e) => real!.send(e));
    },
    (e) => console.warn('[soultied] live', e)
  );
  return {
    kind: 'online',
    send(e) {
      if (real) real.send(e);
      else if (!closed) waiting.push(e);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      closed = true;
      real?.close();
      real = null;
      waiting.length = 0;
      listeners.clear();
    },
  };
}

/** Between tabs of this browser (the offline prototype and the demo room). */
export function browserChannel<E>(name: string): LiveChannel<E> {
  const listeners = new Set<(e: E) => void>();
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(name) : null;
  if (bc) bc.onmessage = (m) => listeners.forEach((fn) => fn(m.data as E));
  return {
    kind: 'local',
    send: (e) => bc?.postMessage(e),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      bc?.close();
      listeners.clear();
    },
  };
}
