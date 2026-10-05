import { type CollectionReference, Firestore, Timestamp, addDoc, collection, onSnapshot, query, serverTimestamp, where } from 'firebase/firestore';

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
  return channelAt<E>(collection(db, 'spaces', spaceId, 'live', topic, 'events'));
}

/** The same, on any collection (the extension's watch parties keep theirs under parties/{id}/events). */
export function channelAt<E extends { by: string; at: number }>(col: CollectionReference): LiveChannel<E> {
  const listeners = new Set<(e: E) => void>();
  let first = true;
  const openedAt = Date.now();
  const since = Timestamp.fromMillis(openedAt - 60_000);
  const unsub = onSnapshot(
    query(col, where('ts', '>', since)),
    (snap) => {
      // The first delivery is mostly recent history, which we skip: we only want what happens from now on.
      // But on a slow connection it can also hold the first replies to our own "hello" (and the start of a
      // video call), which arrive while we're still waiting for it. Those are newer than the moment we opened.
      const history = first;
      first = false;
      snap.docChanges().forEach((ch) => {
        if (ch.type !== 'added') return;
        const data = ch.doc.data() as E & { ts?: Timestamp | null; expireAt?: unknown };
        const { ts, expireAt: _exp, ...rest } = data;
        void _exp;
        if (history && (!ts || ts.toMillis() < openedAt - 1500)) return;
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
