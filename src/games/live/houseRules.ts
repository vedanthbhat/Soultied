import type { GameKind, Match, Seat } from '../types';
import type { LiveLobby } from './lobby';

/**
 * House rules: every live game starts with one fun twist, drawn from the match's seed so both screens see the
 * same one. Either of you can swap it for the next one on the list, once, before the game starts. The rule's id
 * goes into the game's state (`rule`), and the game's own rules (tug.ts, rps.ts, quickdraw.ts, coasters.ts,
 * kitchen.ts) play by it. The iPhone has the same list (HouseRules.swift).
 */

export interface HouseRule {
  id: string;
  name: string;
  /** what it changes, in a line */
  line: string;
}

export const HOUSE_RULES: Partial<Record<GameKind, HouseRule[]>> = {
  tug: [
    { id: 'final', name: 'Final stretch', line: 'In the last five seconds, every tap pulls twice as hard.' },
    { id: 'short', name: 'Short rope', line: 'A lead of 14 taps pulls the ribbon all the way over.' },
    { id: 'sprint', name: 'Sprint', line: 'Ten seconds, not twenty.' },
  ],
  rps: [
    { id: 'quick', name: 'Quick hands', line: 'Two seconds to pick, not five.' },
    { id: 'banned', name: 'Banned hand', line: 'Each round, one hand isn’t allowed. Check before you pick.' },
    { id: 'quickest', name: 'Fastest wins ties', line: 'Pick the same hand and whoever picked first takes the round.' },
  ],
  quickdraw: [
    { id: 'fake', name: 'Fake-outs', line: 'The lantern sometimes flickers before it lights. A flicker isn’t a light.' },
    { id: 'fuse', name: 'Long fuse', line: 'It can take up to eight seconds to light.' },
    { id: 'five', name: 'First to five', line: 'Five rounds to win, not three.' },
  ],
  coasters: [
    { id: 'big', name: 'Big cap', line: 'A bottle cap half as big again.' },
    { id: 'turbo', name: 'Turbo cap', line: 'The cap flies faster and hardly slows down.' },
    { id: 'sudden', name: 'Quick match', line: 'First to three goals, not seven.' },
  ],
  kitchen: [
    { id: 'rush', name: 'Rush hour', line: 'The orders come in faster.' },
    { id: 'swap', name: 'Switch stations', line: 'Halfway through, the chopper and the cook swap places.' },
    { id: 'hungry', name: 'Hungry customers', line: 'Every ticket runs out sooner.' },
  ],
};

/** how many times the rule can be swapped before a game */
export const REROLLS = 1;

/** the rule for a game with this seed, after this many swaps */
export function houseRule(kind: GameKind, seed: number, rerolls = 0): HouseRule | null {
  const list = HOUSE_RULES[kind];
  if (!list || !list.length) return null;
  const base = Math.floor(Math.abs(seed)) % list.length;
  return list[(base + Math.max(0, Math.floor(rerolls))) % list.length];
}

/** the rule for a live game's match (while it's being set up, and once it's on) */
export const ruleOf = (m: Match<LiveLobby> | null | undefined) => (m ? houseRule(m.kind, m.state.seed, m.state.rerolls || 0) : null);

/** swap the rule for the next one (only while waiting for the two of you, and only once) */
export function liveReroll(m: Match<LiveLobby>, seat: Seat): Match<LiveLobby> | null {
  if (m.status !== 'setup' || m.state.phase !== 'lobby' || (m.state.rerolls || 0) >= REROLLS || !HOUSE_RULES[m.kind]) return null;
  return { ...m, state: { ...m.state, rerolls: (m.state.rerolls || 0) + 1 }, updatedBy: seat, last: 'picked another house rule' };
}

/** a rule from a game's state (which has its `rule` when it's playing by one) */
export const ruleById = (kind: GameKind, id?: string | null) => (id ? HOUSE_RULES[kind]?.find((r) => r.id === id) || null : null);
