import { Firestore, Timestamp, addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';

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

/** Messages are useless after a few seconds; this lets a Firestore TTL policy sweep them up. */
const KEEP_MS = 24 * 60 * 60 * 1000;

export function firestoreChannel<E extends { by: string; at: number }>(db: Firestore, spaceId: string, topic: 'watch' | 'escape' | 'stream' | 'doodle'): LiveChannel<E> {
  const col = collection(db, 'spaces', spaceId, 'live', topic, 'events');
  const listeners = new Set<(e: E) => void>();
  let first = true;
  const openedAt = Date.now();
  const since = Timestamp.fromMillis(openedAt - 60_000);
  const unsub = onSnapshot(
    query(col, where('ts', '>', since)),
    (snap) => {
      // the first delivery is recent history: skip it, we only want what happens from now on
      if (first) {
        first = false;
        return;
      }
      snap.docChanges().forEach((ch) => {
        if (ch.type !== 'added') return;
        const data = ch.doc.data() as E & { ts?: Timestamp | null; expireAt?: unknown };
        const { ts, expireAt: _exp, ...rest } = data;
        void _exp;
        // anything from before we opened the channel is history too (e.g. served late from a cache)
        if (ts && ts.toMillis() < openedAt - 5000) return;
        // clocks on two devices disagree; "when it arrived" is a better "when it happened" than their clock
        const e = { ...(rest as unknown as E), at: Date.now() - 150 };
        listeners.forEach((fn) => fn(e));
      });
    },
    () => undefined
  );
  return {
    kind: 'online',
    send(e) {
      addDoc(col, { ...e, ts: serverTimestamp(), expireAt: Timestamp.fromMillis(Date.now() + KEEP_MS) }).catch(() => undefined);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      unsub();
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
