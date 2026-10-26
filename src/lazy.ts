import { lazy } from 'react';

/**
 * The parts of Soultied you open from the room (games, letters, the watch party…) load on their own,
 * after the room: the front door only waits for what it shows. Once the room's up, they're fetched
 * quietly in the background, so opening one is still instant.
 */
const load = {
  escape: () => import('./components/escape/EscapeGame'),
  games: () => import('./components/games/GameShelf'),
  watch: () => import('./components/WatchParty'),
  letters: () => import('./components/letters/LettersPanel'),
  us: () => import('./components/UsPage'),
  decor: () => import('./components/DecorDrawer'),
  space: () => import('./components/SpacePanel'),
  studio: () => import('./components/CharacterStudio'),
};
export type Part = keyof typeof load;

export const EscapeGame = lazy(() => load.escape().then((m) => ({ default: m.EscapeGame })));
export const GameShelf = lazy(() => load.games().then((m) => ({ default: m.GameShelf })));
export const WatchParty = lazy(() => load.watch().then((m) => ({ default: m.WatchParty })));
export const LettersPanel = lazy(() => load.letters().then((m) => ({ default: m.LettersPanel })));
export const UsPage = lazy(() => load.us().then((m) => ({ default: m.UsPage })));
export const DecorDrawer = lazy(() => load.decor().then((m) => ({ default: m.DecorDrawer })));
export const SpacePanel = lazy(() => load.space().then((m) => ({ default: m.SpacePanel })));
export const CharacterStudio = lazy(() => load.studio().then((m) => ({ default: m.CharacterStudio })));

/** Fetch these parts now (when the browser's idle), so they open instantly later. */
export function prefetch(parts: Part[] = Object.keys(load) as Part[], delayMs = 1200) {
  const go = () => parts.forEach((p) => void load[p]().catch(() => undefined));
  const w = window as Window & { requestIdleCallback?: (fn: () => void, o?: { timeout: number }) => number };
  const t = window.setTimeout(() => (w.requestIdleCallback ? w.requestIdleCallback(go, { timeout: 4000 }) : go()), delayMs);
  return () => window.clearTimeout(t);
}
