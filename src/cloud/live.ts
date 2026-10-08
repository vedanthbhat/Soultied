import { type CollectionReference, Firestore, Timestamp, addDoc, collection, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';

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
  let unsub: (() => void) | null = null;
  let closed = false;
  /** said before we were listening: sent once we are, so we can't miss the answers */
  let outbox: E[] | null = [];

  const write = (e: E) => {
    addDoc(col, { ...e, ts: serverTimestamp(), expireAt: Timestamp.fromMillis(Date.now() + KEEP_MS) }).catch(() => undefined);
  };
  const deliver = (data: E & { ts?: Timestamp | null; expireAt?: unknown }) => {
    const { ts: _ts, expireAt: _exp, ...rest } = data;
    void _ts;
    void _exp;
    // clocks on two devices disagree; "when it arrived" is a better "when it happened" than their clock
    const e = { ...(rest as unknown as E), at: Date.now() - 150 };
    listeners.forEach((fn) => fn(e));
  };

  /** Listen for everything after `since` (a time by the server's clock). */
  const listen = (since: Timestamp, skipFirst: ((ts: Timestamp | null | undefined) => boolean) | null) => {
    if (closed) return;
    let first = true;
    unsub = onSnapshot(
      query(col, where('ts', '>', since)),
      (snap) => {
        const history = first;
        first = false;
        snap.docChanges().forEach((ch) => {
          if (ch.type !== 'added') return;
          const data = ch.doc.data() as E & { ts?: Timestamp | null };
          if (history && skipFirst?.(data.ts)) return;
          deliver(data);
        });
      },
      () => undefined,
    );
    const waiting = outbox || [];
    outbox = null;
    waiting.forEach(write);
  };

  /*
   * "From now on", by the server's clock rather than this computer's (a laptop whose time is a minute
   * or two out would otherwise hear nothing, or hear old news): the newest message already there marks
   * now, and we listen for anything after it.
   */
  getDocs(query(col, orderBy('ts', 'desc'), limit(1))).then(
    (snap) => {
      const newest = snap.docs[0]?.data()?.ts as Timestamp | null | undefined;
      listen(newest && typeof newest.toMillis === 'function' ? newest : Timestamp.fromMillis(0), null);
    },
    () => {
      // can't ask (offline?): fall back to this computer's clock, skipping what was already there
      const openedAt = Date.now();
      listen(Timestamp.fromMillis(openedAt - 60_000), (ts) => !ts || ts.toMillis() < openedAt - 1500);
    },
  );

  return {
    kind: 'online',
    send(e) {
      if (outbox) outbox.push(e);
      else write(e);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      closed = true;
      unsub?.();
      unsub = null;
      outbox = null;
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
