import { useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useSharedDoc } from '../together/useSharedDoc';
import type { GameKind } from '../games/types';
import type { RoomId } from '../escape/types';
import { FREE_GAMES, FREE_ROOMS, monthOf, nightCheck, normalizePlusDoc, type PlusDoc } from './rules';

const demoPlus = (): PlusDoc => ({ nights: {} });

/**
 * Soultied Plus for this place: whether it has it, what's open, and tonight's Netflix / Prime Video night.
 * Everything's open in the demo room (so it can all be tried), with the Plus tags still showing.
 */
export function usePlus() {
  const { hasPlus, demo, today } = useApp();
  const plusDoc = useSharedDoc('plus', normalizePlusDoc, demoPlus);
  const open = hasPlus || demo;
  const night = useMemo(() => nightCheck(plusDoc.doc, today, open), [plusDoc.doc, today, open]);

  /** starting Netflix or Prime Video: counts tonight as one of the month's free nights (false when they're used up) */
  const takeNight = useCallback(() => {
    if (!night.ok) return false;
    if (!open && !night.already) plusDoc.write({ nights: { [monthOf(today)]: { [today]: true } } });
    return true;
  }, [night, open, plusDoc, today]);

  return {
    hasPlus,
    /** what Plus opens is open */
    open,
    night,
    takeNight,
    canPlay: (k: GameKind) => open || FREE_GAMES.has(k),
    canEscape: (r: RoomId) => open || FREE_ROOMS.has(r),
    isPlusGame: (k: GameKind) => !FREE_GAMES.has(k),
    isPlusRoom: (r: RoomId) => !FREE_ROOMS.has(r),
  };
}
