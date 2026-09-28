import type { AvatarConfig } from '../types';
import type { ReactionKind } from '../pixel/watchRoom';

/**
 * Watching Netflix or Prime Video together.
 *
 * Three pieces talk to each other:
 * - the Soultied browser extension, which sits on the Netflix / Prime page and
 *   drives the player (play, pause, seek) and draws the chat and couch on top;
 * - your Soultied tab (the "hub"), which is already signed in, so it carries
 *   everything to and from your person over the online live channel, and runs
 *   the cameras and push-to-talk;
 * - your person's Soultied tab and extension, doing the same on their side.
 *
 * This file is shared by the web app and the extension.
 */

export type Platform = 'netflix' | 'prime';

export interface TitleInfo {
  platform: Platform;
  /** one episode or one film */
  key: string;
  /** the series (or the film itself), for the no-watching-ahead guard */
  showKey: string;
  show: string;
  /** e.g. "S2:E4 · The Pollywog", empty for films */
  episode: string;
  /** where to send your person to watch the same thing */
  url: string;
}

export interface Where {
  title: TitleInfo | null;
  /** seconds */
  pos: number;
  playing: boolean;
}

/** Between the two of you, over the live channel. */
export type StreamEvent =
  | ({ type: 'hello' | 'ping'; by: string; at: number; buffering?: boolean } & Where)
  | { type: 'bye'; by: string; at: number }
  | { type: 'play'; pos: number; key: string | null; by: string; at: number }
  | { type: 'pause'; pos: number; key: string | null; by: string; at: number }
  | { type: 'seek'; pos: number; playing: boolean; key: string | null; by: string; at: number }
  | ({ type: 'state'; by: string; at: number; reply?: boolean } & Where)
  | { type: 'buffering'; on: boolean; pos: number; by: string; at: number }
  | { type: 'title'; title: TitleInfo; from: string | null; by: string; at: number }
  | { type: 'chat'; id: string; text: string; by: string; at: number }
  | { type: 'react'; kind: ReactionKind; by: string; at: number }
  /** "only I can pause and skip" */
  | { type: 'lock'; on: boolean; by: string; at: number }
  /** countdown start: ready to go */
  | { type: 'ready'; on: boolean; by: string; at: number }
  | { type: 'countdown'; pos: number; inMs: number; key: string | null; by: string; at: number }
  // cameras and voice (handled by the Soultied tabs, same shapes as the YouTube room)
  | { type: 'rtc'; to: string; by: string; at: number; description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit | null }
  | { type: 'media'; cam: boolean; talking: boolean; by: string; at: number };

export interface Person {
  id: string;
  name: string;
  avatar: AvatarConfig;
}

export interface TogetherLog {
  /** episodes and films you've watched together, by key */
  seen: Record<string, { show: string; episode: string; at: number }>;
  /** per show: where the two of you left off */
  shows: Record<string, { show: string; episode: string; key: string; url: string; pos: number; at: number }>;
}

export const emptyLog = (): TogetherLog => ({ seen: {}, shows: {} });

export interface Session {
  me: Person;
  partner: Person | null;
  /** who sits on the left of the couch (whoever made the place), so both of you see the same couch */
  leftId: string;
  place: string;
  /** how close you sit on the couch, 0 (the two ends) to 1 (side by side) */
  closeness: number;
  log: TogetherLog;
  /** the Soultied page to come back to */
  hubUrl: string;
}

/** Soultied tab -> extension */
export type HubMsg =
  | { kind: 'session'; session: Session | null }
  | { kind: 'event'; e: StreamEvent }
  /** who's talking (to turn the show down), and whether the cameras window is open */
  | { kind: 'voice'; mine: boolean; partner: boolean; cams: boolean };

/** extension -> Soultied tab */
export type ExtMsg =
  | { kind: 'hello' }
  | { kind: 'send'; e: StreamEvent }
  | { kind: 'watched'; title: TitleInfo; pos: number }
  | { kind: 'ptt'; down: boolean }
  | { kind: 'bye' };

/** window.postMessage tags between the Soultied page and the extension's bridge */
export const HUB_SOURCE = 'soultied-hub';
export const EXT_SOURCE = 'soultied-ext';

export type PageBody = { kind: 'probe' } | { kind: 'hub' } | { kind: 'msg'; msg: HubMsg };
export type BridgeBody = { kind: 'present'; version: string } | { kind: 'msg'; msg: ExtMsg };
export type PageToBridge = { source: typeof HUB_SOURCE } & PageBody;
export type BridgeToPage = { source: typeof EXT_SOURCE } & BridgeBody;

/** 1:02:05 / 42:10 */
export function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

export const titleLabel = (t: TitleInfo | null) => (!t ? 'something' : t.episode ? `${t.show} ${t.episode.split(' · ')[0]}` : t.show);
