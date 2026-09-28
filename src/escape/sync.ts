import type { RoomId, Side } from './types';

/**
 * Shared progress through an escape room, plus the messages two players send
 * each other. Progress only ever moves forward, so merging two copies is just
 * "take the furthest along" — safe whichever arrives first. The transport is a
 * BroadcastChannel for now (tabs in one browser); the backend will swap in a
 * real-time one with the same shape.
 */

export interface Progress {
  room: RoomId;
  step: number;
  /** hints revealed per puzzle */
  hints: Record<string, number>;
  startedAt: number;
  finishedAt?: number;
}

export function mergeProgress(a: Progress | null | undefined, b: Progress | null | undefined): Progress | null {
  if (!a) return b || null;
  if (!b || a.room !== b.room) return a;
  const hints: Record<string, number> = { ...a.hints };
  for (const [k, v] of Object.entries(b.hints)) hints[k] = Math.max(hints[k] || 0, v);
  const step = Math.max(a.step, b.step);
  const finishedAt = a.finishedAt && b.finishedAt ? Math.min(a.finishedAt, b.finishedAt) : a.finishedAt || b.finishedAt;
  return { room: a.room, step, hints, startedAt: Math.min(a.startedAt, b.startedAt), finishedAt };
}

export type EscapeEvent =
  | { type: 'hello'; by: string; at: number }
  | { type: 'ping'; by: string; at: number }
  | { type: 'bye'; by: string; at: number }
  | { type: 'ready'; by: string; room: RoomId | null; at: number }
  | { type: 'progress'; by: string; progress: Progress; at: number }
  | { type: 'hold'; by: string; side: Side; down: boolean; at: number }
  | { type: 'chat'; by: string; name: string; id: string; text: string; at: number };

export interface Channel<E> {
  send(e: E): void;
  subscribe(fn: (e: E) => void): () => void;
  close(): void;
}

export function localChannel<E>(name: string): Channel<E> {
  const listeners = new Set<(e: E) => void>();
  const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(name) : null;
  if (bc) bc.onmessage = (m) => listeners.forEach((fn) => fn(m.data as E));
  return {
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

/* ---------- saved on this device ---------- */

export interface EscapeSave {
  progress: Partial<Record<RoomId, Progress>>;
  /** fastest escape, in ms */
  best: Partial<Record<RoomId, number>>;
}

const key = (spaceId: string) => `soultied_escape_${spaceId}`;

export function loadSave(spaceId: string): EscapeSave {
  try {
    const raw = localStorage.getItem(key(spaceId));
    if (raw) {
      const s = JSON.parse(raw) as EscapeSave;
      return { progress: s.progress || {}, best: s.best || {} };
    }
  } catch {
    // ignore
  }
  return { progress: {}, best: {} };
}

export function storeSave(spaceId: string, save: EscapeSave) {
  try {
    localStorage.setItem(key(spaceId), JSON.stringify(save));
  } catch {
    // ignore
  }
}

export function formatTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
