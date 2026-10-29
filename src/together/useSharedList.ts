import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import * as store from '../cloud/store';
import { deepMerge } from './useSharedDoc';

/**
 * A set of small documents the two of you share, one each (notes, photos…): every
 * `spaces/{id}/meta/{prefix}…` document online; a map in this browser's storage offline; memory in
 * the demo room. Ids start with the prefix and sort by when they were made.
 *
 * `put` writes a whole document; `patch` merges a change into one (to take one down, patch it gone).
 * `enabled: false` doesn't load anything yet (say, until the panel that shows them opens).
 */

export interface SharedList<T> {
  ready: boolean;
  items: T[];
  put: (id: string, value: object) => void;
  patch: (id: string, patch: object) => void;
  mode: 'cloud' | 'local' | 'demo';
}

/** the demo room's documents, kept for as long as the page is open */
const demoStore = new Map<string, Record<string, unknown>>();

export function useSharedList<T extends { id: string }>(
  prefix: string,
  normalize: (id: string, raw: unknown) => T | null,
  demoItems: () => Record<string, unknown>,
  enabled = true
): SharedList<T> {
  const { space, demo, cloudMode, cloudTarget, currentUser } = useApp();
  const sid = space?.id || 'solo';
  const isDemo = demo || sid === 'space-demo';
  const mode: SharedList<T>['mode'] = isDemo ? 'demo' : cloudMode ? 'cloud' : 'local';
  const scope = `${mode}|${sid}|${prefix}`;
  const key = `soultied_list_${prefix}_${sid}`;

  const [raw, setRaw] = useState<{ scope: string; docs: Record<string, unknown> } | null>(null);
  const rawRef = useRef<Record<string, unknown>>({});
  const ready = raw?.scope === scope;

  const loadLocal = useCallback((): Record<string, unknown> => {
    try {
      const v = JSON.parse(localStorage.getItem(key) || '{}');
      return v && typeof v === 'object' ? v : {};
    } catch {
      return {};
    }
  }, [key]);

  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const s = scope;
    const set = (docs: Record<string, unknown>) => {
      rawRef.current = docs;
      setRaw({ scope: s, docs });
    };
    if (mode === 'demo') {
      if (!demoStore.has(s)) demoStore.set(s, demoItems());
      set(demoStore.get(s)!);
      return;
    }
    if (mode === 'cloud') {
      const o = cloudTarget();
      if (!o) return;
      return store.subscribeMetaList(o.db, o.sid, prefix, (docs) => set(Object.fromEntries(docs.map((d) => [d.id, d.data]))));
    }
    set(loadLocal());
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`soultied-list-${prefix}-${sid}`) : null;
    bcRef.current = bc;
    if (bc) bc.onmessage = () => set(loadLocal());
    const onStorage = (e: StorageEvent) => e.key === key && set(loadLocal());
    window.addEventListener('storage', onStorage);
    return () => {
      bc?.close();
      bcRef.current = null;
      window.removeEventListener('storage', onStorage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, enabled, currentUser.id]);

  const commit = useCallback(
    (id: string, next: unknown, write: () => Promise<unknown> | void) => {
      const docs = { ...rawRef.current, [id]: next };
      rawRef.current = docs;
      setRaw({ scope, docs });
      if (mode === 'demo') {
        demoStore.set(scope, docs);
        return;
      }
      if (mode === 'cloud') {
        Promise.resolve(write()).catch((e) => console.warn(`[soultied] ${prefix}`, e));
        return;
      }
      try {
        localStorage.setItem(key, JSON.stringify(docs));
      } catch (e) {
        console.warn('[soultied] this browser is out of room', e);
      }
      bcRef.current?.postMessage(1);
    },
    [scope, mode, key, prefix]
  );

  const put = useCallback(
    (id: string, value: object) =>
      commit(id, value, () => {
        const o = cloudTarget();
        return o ? store.writeMetaDoc(o.db, o.sid, id, value) : undefined;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit]
  );
  const patch = useCallback(
    (id: string, p: object) =>
      commit(id, deepMerge(rawRef.current[id] || {}, p), () => {
        const o = cloudTarget();
        return o ? store.writeMeta(o.db, o.sid, id, p) : undefined;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit]
  );

  const items = useMemo(() => {
    if (!ready) return [];
    return Object.entries(raw!.docs)
      .filter(([id]) => id.startsWith(prefix))
      .map(([id, v]) => normalize(id, v))
      .filter((x): x is T => !!x)
      .sort((a, b) => (a.id < b.id ? -1 : 1));
  }, [ready, raw, prefix, normalize]);

  return { ready, items, put, patch, mode };
}

/* ---------- one big document, read when you need it (a photo's big copy) ---------- */

const bigCache = new Map<string, string>();

export function useBigDoc() {
  const { space, demo, cloudMode, cloudTarget } = useApp();
  const sid = space?.id || 'solo';
  const mode = demo || sid === 'space-demo' ? 'demo' : cloudMode ? 'cloud' : 'local';
  const localKey = (name: string) => `soultied_big_${sid}_${name}`;

  const save = useCallback(
    (name: string, data: string) => {
      bigCache.set(`${sid}/${name}`, data);
      if (mode === 'cloud') {
        const o = cloudTarget();
        return o ? store.writeMetaDoc(o.db, o.sid, name, { data }) : Promise.resolve();
      }
      if (mode === 'local') {
        try {
          localStorage.setItem(localKey(name), data);
        } catch {
          // out of room: the small copy on the wall still works
        }
      }
      return Promise.resolve();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, sid]
  );

  const load = useCallback(
    async (name: string): Promise<string | null> => {
      const k = `${sid}/${name}`;
      if (bigCache.has(k)) return bigCache.get(k)!;
      let data: string | null = null;
      if (mode === 'cloud') {
        const o = cloudTarget();
        const raw = o ? ((await store.fetchMeta(o.db, o.sid, name)) as { data?: unknown } | null) : null;
        data = raw && typeof raw.data === 'string' ? raw.data : null;
      } else if (mode === 'local') {
        try {
          data = localStorage.getItem(localKey(name));
        } catch {
          data = null;
        }
      }
      if (data) bigCache.set(k, data);
      return data;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, sid]
  );

  return { save, load };
}
