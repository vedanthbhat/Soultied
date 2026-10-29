import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import * as store from '../cloud/store';

/**
 * One small document the two of you share (questions you ask each other, moods, notes on the
 * fridge…), kept in the same three places as the rest of the place:
 *   online   spaces/{id}/meta/{name}, live for both of you
 *   local    this browser (localStorage), and other tabs of it
 *   demo     memory only, starting from the demo room's copy
 * Writes are patches merged in, nested maps too (the way Firestore merges), so the two of you
 * writing at once never undo each other. To take something out, set it to null.
 */

export type Patch<T> = T extends readonly unknown[] ? T : T extends object ? { [K in keyof T]?: Patch<T[K]> | null } : T;

const isMap = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export function deepMerge<T>(base: T, patch: unknown): T {
  if (!isMap(patch)) return patch as T;
  const out: Record<string, unknown> = isMap(base) ? { ...base } : {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = isMap(v) ? deepMerge(out[k], v) : v;
  }
  return out as T;
}

export interface SharedDoc<T> {
  ready: boolean;
  doc: T;
  write: (patch: Patch<T>) => void;
  /** online, demo, or just this browser */
  mode: 'cloud' | 'local' | 'demo';
}

export function useSharedDoc<T>(name: string, normalize: (raw: unknown) => T, demoDoc: () => T): SharedDoc<T> {
  const { space, demo, cloudMode, cloudTarget, currentUser } = useApp();
  const sid = space?.id || 'solo';
  const isDemo = demo || sid === 'space-demo';
  const mode: SharedDoc<T>['mode'] = isDemo ? 'demo' : cloudMode ? 'cloud' : 'local';
  const scope = `${mode}|${sid}|${name}`;
  const key = `soultied_${name}_${sid}`;

  const loadLocal = useCallback((): T => {
    try {
      return normalize(JSON.parse(localStorage.getItem(key) || 'null'));
    } catch {
      return normalize(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const [loaded, setLoaded] = useState<{ scope: string; doc: T } | null>(() =>
    mode === 'cloud' ? null : { scope, doc: mode === 'demo' ? demoDoc() : loadLocal() }
  );
  const ready = loaded?.scope === scope;
  const doc = useMemo(() => (ready ? loaded!.doc : normalize(null)), [ready, loaded, normalize]);
  const docRef = useRef(doc);
  docRef.current = doc;

  // online: the shared document
  useEffect(() => {
    if (mode !== 'cloud') return;
    const o = cloudTarget();
    if (!o) return;
    const s = scope;
    return store.subscribeMeta(o.db, o.sid, name, (raw) => {
      const d = normalize(raw);
      docRef.current = d;
      setLoaded({ scope: s, doc: d });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, currentUser.id]);

  // this browser (and its other tabs), or the demo room
  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (mode === 'cloud') return;
    const s = scope;
    const set = (d: T) => {
      docRef.current = d;
      setLoaded({ scope: s, doc: d });
    };
    if (mode === 'demo') {
      setLoaded((l) => (l?.scope === s ? l : { scope: s, doc: demoDoc() }));
      return;
    }
    set(loadLocal());
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`soultied-${name}-${sid}`) : null;
    bcRef.current = bc;
    if (bc) bc.onmessage = () => set(loadLocal());
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) set(loadLocal());
    };
    window.addEventListener('storage', onStorage);
    return () => {
      bc?.close();
      bcRef.current = null;
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const write = useCallback(
    (patch: Patch<T>) => {
      const next = normalize(deepMerge(docRef.current, patch));
      docRef.current = next;
      setLoaded({ scope, doc: next });
      if (mode === 'demo') return;
      if (mode === 'cloud') {
        const o = cloudTarget();
        if (o) store.writeMeta(o.db, o.sid, name, patch as object).catch((e) => console.warn(`[soultied] ${name}`, e));
        return;
      }
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        // storage full or blocked: it still works for now
      }
      bcRef.current?.postMessage(1);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope]
  );

  return { ready, doc, write, mode };
}

/** a short random id, sortable by when it was made */
export const newKey = (prefix: string) => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
