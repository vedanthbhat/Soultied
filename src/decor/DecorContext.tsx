import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import * as store from '../cloud/store';
import {
  type Decor,
  type DecorDoc,
  type DecorItem,
  type SlotId,
  REWARDS,
  balance,
  boughtKey,
  decorOf,
  earnKey,
  emptyDecorDoc,
  itemById,
  normalizeDecorDoc,
  owns as ownsIn,
  welcomeGift,
} from './catalogue';

/** "+20 stitches: you showed up, and you're both here today." */
export interface EarnNote {
  key: string;
  amount: number;
  text: string;
}

interface DecorValue {
  /** the room's decor document has loaded */
  ready: boolean;
  stitches: number;
  /** what's out in the room, for both of you */
  placed: Decor;
  /** what this screen shows: the room, with whatever you're trying on */
  shown: Decor;
  trying: DecorItem | null;
  tryOn: (item: DecorItem | null) => void;
  owns: (item: DecorItem) => boolean;
  /** buy it (if you can) and put it out; false when you're short */
  buy: (item: DecorItem) => boolean;
  /** put out something you already own */
  place: (item: DecorItem) => void;
  /** the catalogue drawer */
  open: boolean;
  slot: SlotId;
  openCatalogue: (slot?: SlotId) => void;
  closeCatalogue: () => void;
  setSlot: (s: SlotId) => void;
  note: EarnNote | null;
  dismissNote: () => void;
}

const Ctx = createContext<DecorValue | null>(null);

const localKey = (sid: string) => `soultied_decor_${sid}`;

function loadLocal(sid: string): DecorDoc {
  try {
    return normalizeDecorDoc(JSON.parse(localStorage.getItem(localKey(sid)) || 'null'));
  } catch {
    return emptyDecorDoc();
  }
}

const merge = (d: DecorDoc, p: Partial<DecorDoc>): DecorDoc => ({
  earned: { ...d.earned, ...p.earned },
  bought: { ...d.bought, ...p.bought },
  placed: { ...d.placed, ...p.placed },
});

/** The demo room comes with some stitches to spend, so you can try the catalogue straight away. */
const demoDoc = (): DecorDoc => ({ earned: { welcome: 240 }, bought: {}, placed: {} });

const REASON: Record<string, string> = {
  visit: 'you showed up',
  together: 'you’re both here today',
  letter: 'today’s letter is open',
};

function joinReasons(r: string[]) {
  if (r.length <= 1) return r[0] || '';
  return `${r.slice(0, -1).join(', ')}, and ${r[r.length - 1]}`;
}

function announce(slot: SlotId, who: string, item: DecorItem): { title: string; description: string } {
  switch (slot) {
    case 'wall':
      return { title: 'New wallpaper', description: `${who} put up new wallpaper: ${item.name}.` };
    case 'couch':
      return { title: 'A new couch', description: `${who} got a new couch: ${item.name}.` };
    case 'rug':
      return { title: 'A new rug', description: `${who} put down a new rug: ${item.name}.` };
    case 'pet':
      return { title: 'Someone new by the fire', description: `${who} brought home a ${item.name.toLowerCase()}.` };
    case 'view':
      return { title: 'A new view', description: `${who} changed the view from the window: ${item.name}.` };
    case 'painting':
      return { title: 'A new painting', description: `${who} hung a new painting over the fire: ${item.name}.` };
    default:
      return { title: 'A new plant', description: `${who} brought home a new plant: ${item.name}.` };
  }
}

/**
 * Decorating the living room: the stitches you've earned by showing up, what
 * you've bought with them, and what's out. One document per place, shared by
 * the two of you (or kept in this browser before you're online).
 */
export const DecorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, partnerUser, space, setupComplete, today, letters, couchDays, togetherToday, cloudMode, cloudTarget, demo, addActivity, panel, openPanel } =
    useApp();
  const sid = space?.id || 'solo';
  const me = currentUser.id;
  const isDemo = demo || sid === 'space-demo';
  const mode = isDemo ? 'demo' : cloudMode ? 'cloud' : 'local';

  // the document, tagged with which place (and where) it came from, so nothing acts on another place's stitches
  const scope = `${mode}|${sid}`;
  const [loaded, setLoaded] = useState<{ scope: string; doc: DecorDoc } | null>(() =>
    mode === 'cloud' ? null : { scope, doc: mode === 'demo' ? demoDoc() : loadLocal(sid) }
  );
  const ready = loaded?.scope === scope;
  const doc = useMemo(() => (ready ? loaded!.doc : emptyDecorDoc()), [ready, loaded]);
  const docRef = useRef(doc);
  docRef.current = doc;

  /* ---------- the shared document ---------- */
  useEffect(() => {
    if (mode !== 'cloud') return;
    const o = cloudTarget();
    if (!o) return;
    const s = scope;
    return store.subscribeDecor(o.db, o.sid, (d) => {
      docRef.current = d;
      setLoaded({ scope: s, doc: d });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, me]);

  const bcRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (mode === 'cloud') return;
    const s = scope;
    const set = (d: DecorDoc) => {
      docRef.current = d;
      setLoaded({ scope: s, doc: d });
    };
    if (mode === 'demo') {
      setLoaded((l) => (l?.scope === s ? l : { scope: s, doc: demoDoc() }));
      return;
    }
    set(loadLocal(sid));
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`soultied-decor-${sid}`) : null;
    bcRef.current = bc;
    if (bc) bc.onmessage = (e: MessageEvent) => set(e.data && typeof e.data === 'object' ? normalizeDecorDoc(e.data) : loadLocal(sid));
    const onStorage = (e: StorageEvent) => {
      if (e.key === localKey(sid)) set(loadLocal(sid));
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
    (patch: Partial<DecorDoc>) => {
      const next = merge(docRef.current, patch);
      docRef.current = next;
      setLoaded({ scope, doc: next });
      if (mode === 'demo') return;
      const o = mode === 'cloud' ? cloudTarget() : null;
      if (o) store.writeDecor(o.db, o.sid, patch).catch((e) => console.warn('[soultied] decor', e));
      else if (mode === 'local') {
        try {
          localStorage.setItem(localKey(sid), JSON.stringify(next));
        } catch {
          // ignore
        }
        bcRef.current?.postMessage(next);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scope]
  );

  /* ---------- earning stitches ---------- */
  const [note, setNote] = useState<EarnNote | null>(null);
  const sent = useRef(new Set<string>());
  const letterOpen = !!letters.daily[today]?.revealedAt;
  useEffect(() => {
    if (!ready || !setupComplete || !space) return;
    const d = docRef.current;
    const has = (k: string) => k in d.earned || sent.current.has(`${scope}|${k}`);
    const credits: Array<{ key: string; amount: number; why: string }> = [];
    if (!has(earnKey.welcome)) credits.push({ key: earnKey.welcome, amount: welcomeGift(couchDays), why: 'welcome' });
    // the daily ones start once your person has moved in
    if (partnerUser) {
      const visit = earnKey.visit(today, me);
      if (!has(visit)) credits.push({ key: visit, amount: REWARDS.visit, why: 'visit' });
      if (togetherToday && !has(earnKey.together(today))) credits.push({ key: earnKey.together(today), amount: REWARDS.together, why: 'together' });
      if (letterOpen && !has(earnKey.letter(today))) credits.push({ key: earnKey.letter(today), amount: REWARDS.letter, why: 'letter' });
    }
    if (!credits.length) return;
    credits.forEach((c) => sent.current.add(`${scope}|${c.key}`));
    write({ earned: Object.fromEntries(credits.map((c) => [c.key, c.amount])) });
    const amount = credits.reduce((n, c) => n + c.amount, 0);
    const welcome = credits.some((c) => c.why === 'welcome');
    // the first time, say what they're for (your person moving in to a jar that's already got some in it)
    const first = !welcome && !introSeen ? ` That makes ${balance(d) + amount} in the jar to decorate the room with.` : '';
    const text = welcome
      ? `A housewarming gift: ${amount} stitches to decorate the room with.`
      : `+${amount} stitches: ${joinReasons(credits.map((c) => REASON[c.why]))}.${first}`;
    setNote({ key: credits.map((c) => c.key).join(','), amount, text });
    markIntroSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, scope, doc.earned, setupComplete, space?.id, partnerUser?.id, me, today, togetherToday, letterOpen, couchDays]);

  // someone who hasn't looked at the catalogue yet (your person moving in to a room with stitches already in the jar)
  const introKey = `soultied_decor_intro_${sid}_${me}`;
  const [introTick, setIntroTick] = useState(0);
  const introSeen = useMemo(() => {
    if (mode === 'demo') return true;
    try {
      return localStorage.getItem(introKey) === '1';
    } catch {
      return true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introKey, mode, introTick]);
  const markIntroSeen = useCallback(() => {
    try {
      localStorage.setItem(introKey, '1');
    } catch {
      // ignore
    }
    setIntroTick((n) => n + 1);
  }, [introKey]);
  const stitches = balance(doc);
  useEffect(() => {
    if (introSeen || !ready || !setupComplete || !space || note || stitches <= 0) return;
    setNote((n) => n ?? { key: 'intro', amount: 0, text: `There are ${stitches} stitches in the jar to decorate the room with.` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [introSeen, ready, scope, setupComplete, stitches]);

  /* ---------- the catalogue ---------- */
  const open = panel === 'decor';
  const [slot, setSlot] = useState<SlotId>('couch');
  const [trying, setTrying] = useState<DecorItem | null>(null);
  useEffect(() => {
    if (!open) setTrying(null);
  }, [open]);

  const placed = useMemo(() => decorOf(doc.placed), [doc.placed]);
  const shown = useMemo(() => (trying && open ? { ...placed, [trying.slot]: trying.id } : placed), [placed, trying, open]);

  const owns = useCallback((item: DecorItem) => ownsIn(doc, item), [doc]);

  const place = useCallback(
    (item: DecorItem) => {
      if (!ownsIn(docRef.current, item)) return;
      write({ placed: { [item.slot]: item.id } });
      setTrying(null);
    },
    [write]
  );

  const buy = useCallback(
    (item: DecorItem) => {
      const d = docRef.current;
      if (!itemById(item.slot, item.id)) return false;
      if (ownsIn(d, item)) {
        place(item);
        return true;
      }
      if (balance(d) < item.price) return false;
      write({ bought: { [boughtKey(item)]: { by: me, at: Date.now(), price: item.price } }, placed: { [item.slot]: item.id } });
      addActivity({ type: 'room_decorated', ...announce(item.slot, currentUser.name, item) });
      setTrying(null);
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [write, place, me, currentUser.name]
  );

  const openCatalogue = useCallback(
    (s?: SlotId) => {
      if (s) setSlot(s);
      setNote(null);
      markIntroSeen();
      openPanel('decor');
    },
    [openPanel, markIntroSeen]
  );
  const closeCatalogue = useCallback(() => {
    setTrying(null);
    if (panel === 'decor') openPanel(null);
  }, [panel, openPanel]);

  const value = useMemo<DecorValue>(
    () => ({
      ready,
      stitches,
      placed,
      shown,
      trying: open ? trying : null,
      tryOn: setTrying,
      owns,
      buy,
      place,
      open,
      slot,
      openCatalogue,
      closeCatalogue,
      setSlot,
      note,
      dismissNote: () => {
        setNote(null);
        markIntroSeen();
      },
    }),
    [ready, stitches, placed, shown, open, trying, owns, buy, place, slot, openCatalogue, closeCatalogue, note, markIntroSeen]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useDecor() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDecor outside DecorProvider');
  return v;
}
