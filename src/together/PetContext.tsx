import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useSharedDoc } from './useSharedDoc';
import { carePatch, demoPet, missingDays, normalizePet, petLevel, bondOf, petView, type PetAct, type PetDoc, type PetPatch, type PetView } from './pet';

/**
 * The pet you both raise (pet.ts), shared in the place's meta/pet document. Just the looking after: which pet
 * is on the cushion, and what it's called, are the decor's (decor/DecorContext.tsx).
 */

export interface PetApi {
  ready: boolean;
  doc: PetDoc;
  view: PetView;
  /** look after it: the level before and after (null when you already have today) */
  care: (act: PetAct) => { before: number; after: number } | null;
}

const PetCtx = createContext<PetApi | null>(null);

export const PetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, partnerUser, today } = useApp();
  const me = currentUser.id;
  const them = partnerUser?.id || null;
  const shared = useSharedDoc<PetDoc>('pet', normalizePet, demoPet);
  const { ready, doc, write } = shared;
  const docRef = useRef(doc);
  docRef.current = doc;

  const view = useMemo(() => petView(doc, today, me, them), [doc, today, me, them]);

  // a day you both looked after it at the same moment (neither saw the other's yet): count it now
  useEffect(() => {
    if (!ready) return;
    const p = missingDays(doc, me, them);
    if (p) write(p as never);
  }, [ready, doc, me, them, write]);

  const care = useCallback(
    (act: PetAct) => {
      const d = docRef.current;
      const p: PetPatch | null = carePatch(d, today, me, them, act, Date.now());
      if (!p) return null;
      const before = petLevel(bondOf(d)).level;
      write(p as never);
      const after = petLevel(bondOf(d) + (p.days ? Object.keys(p.days).length : 0)).level;
      return { before, after };
    },
    [today, me, them, write]
  );

  const value = useMemo<PetApi>(() => ({ ready, doc, view, care }), [ready, doc, view, care]);
  return <PetCtx.Provider value={value}>{children}</PetCtx.Provider>;
};

export function usePet(): PetApi {
  const v = useContext(PetCtx);
  if (!v) throw new Error('usePet outside PetProvider');
  return v;
}
