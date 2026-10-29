import type { Firestore, Timestamp } from 'firebase/firestore';
import type { ActivityItem, AvatarConfig, CoupleSpace } from '../types';
import type { LetterDay } from '../letters/engine';
import type { CouchState } from '../couch';
import type { CloudDb } from './firebase';

/**
 * A couple's place online (Firestore). Everything here waits for Firestore to load: it's only fetched
 * once someone's signed in (or, coming back, as the page opens), so a first visit to soultied.app never
 * downloads it. The real work is in storeFs.ts; these do the same things, just a moment later the first
 * time. Writes return promises as before, and listeners return a function that stops them (even if
 * Firestore hadn't finished loading yet).
 */

export interface MemberDoc {
  name: string;
  avatar: AvatarConfig;
  lastActive: string;
}

export interface SpaceDoc extends CoupleSpace {
  members: string[];
  /** Soultied Plus for the place (cameras and voice): whose code, the code's fingerprint, and when it ends */
  plus?: { by: string; code: string; until: Timestamp } | null;
  /** the invite expiry again, as a number the security rules can compare */
  inviteExpiresAtMs: number;
  joinCode?: string;
}

export interface InviteDoc {
  spaceId: string;
  creatorId: string;
  spaceName: string;
  hostName: string;
  hostAvatar: AvatarConfig;
  partnerPlaceholderName: string;
  expiresAt: Timestamp;
}

export interface CloudData {
  space: SpaceDoc | null;
  members: Record<string, MemberDoc>;
  daily: Record<string, LetterDay>;
  afterDark: Record<string, LetterDay>;
  journey: Record<string, LetterDay>;
  afterDarkOn: Record<string, boolean>;
  afterDarkHeat: Record<string, number>;
  repairs: string[];
  journeyStart: string | null;
  couch: CouchState;
  activities: ActivityItem[];
  /** which listeners have delivered at least once */
  loaded: { space: boolean; members: boolean; letters: boolean };
}

export const emptyCloudData = (): CloudData => ({
  space: null,
  members: {},
  daily: {},
  afterDark: {},
  journey: {},
  afterDarkOn: {},
  afterDarkHeat: {},
  repairs: [],
  journeyStart: null,
  couch: { seen: {}, together: [], shown: {} },
  activities: [],
  loaded: { space: false, members: false, letters: false },
});

export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export type CloudJoinResult = 'ok' | 'not_found' | 'full' | 'expired';

/* ---------- waiting for Firestore ---------- */

type Impl = typeof import('./storeFs');
type Rest<F> = F extends (db: Firestore, ...rest: infer R) => unknown ? R : never;
type Out<F> = F extends (...a: never[]) => infer T ? Awaited<T> : never;

let impl: Promise<Impl> | null = null;
const loadImpl = () =>
  (impl ||= import('./storeFs').catch((e) => {
    impl = null;
    throw e;
  }));

/** Do something once Firestore (and the place's database) is ready. */
function later<K extends keyof Impl>(k: K) {
  return async (db: CloudDb, ...args: Rest<Impl[K]>): Promise<Out<Impl[K]>> => {
    const [m, d] = await Promise.all([loadImpl(), db.get()]);
    return (m[k] as unknown as (d: Firestore, ...a: unknown[]) => Out<Impl[K]>)(d, ...args);
  };
}

/** Start listening once Firestore's ready; the returned function stops it whenever it's called. */
function listen<K extends keyof Impl>(k: K, onFail?: (args: unknown[], e: unknown) => void) {
  return (db: CloudDb, ...args: Rest<Impl[K]>): (() => void) => {
    let off: (() => void) | null = null;
    let stopped = false;
    Promise.all([loadImpl(), db.get()]).then(
      ([m, d]) => {
        if (!stopped) off = (m[k] as unknown as (d: Firestore, ...a: unknown[]) => () => void)(d, ...args);
      },
      (e) => (onFail ? onFail(args, e) : console.warn('[soultied] cloud', e))
    );
    return () => {
      stopped = true;
      off?.();
      off = null;
    };
  };
}

/* ---------- finding and making a place ---------- */

export const findSpaceFor = later('findSpaceFor');
export const createSpace = later('createSpace');
export const lookupInvite = later('lookupInvite');
export const joinSpace = later('joinSpace');

/* ---------- listening ---------- */

/** (if Firestore can't load at all, that's the place's listener failing, so the app can say so) */
export const subscribeSpace = listen('subscribeSpace', (args, e) => (args[3] as (e: unknown) => void)(e));
export const subscribeStreamLog = listen('subscribeStreamLog');
export const subscribeGame = listen('subscribeGame');
export const subscribeDoodleCanvas = listen('subscribeDoodleCanvas');
export const subscribeTurntable = listen('subscribeTurntable');
export const subscribeDecor = listen('subscribeDecor');
export const subscribeMeta = listen('subscribeMeta');
export const subscribeMetaList = listen('subscribeMetaList');

/* ---------- writing ---------- */

export const writeMember = later('writeMember');
export const writeSpace = later('writeSpace');
export const writeNewInvite = later('writeNewInvite');
export const writeAnswer = later('writeAnswer');
export const writeMyLetter = later('writeMyLetter');
export const writeJourneyStart = later('writeJourneyStart');
export const writeAfterDark = later('writeAfterDark');
export const writeRepair = later('writeRepair');
export const writeCouchSeen = later('writeCouchSeen');
export const writeCouchShown = later('writeCouchShown');
export const writeWatched = later('writeWatched');
export const writeActivity = later('writeActivity');
export const writeGame = later('writeGame');
export const writeDoodleCanvas = later('writeDoodleCanvas');
export const writeTurntable = later('writeTurntable');
export const writeDecor = later('writeDecor');
export const writeAfterDarkHeat = later('writeAfterDarkHeat');
export const fetchLettersBefore = later('fetchLettersBefore');
export const writeMeta = later('writeMeta');
export const writeMetaDoc = later('writeMetaDoc');
export const fetchMeta = later('fetchMeta');
