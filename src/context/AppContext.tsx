import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { UserProfile, CoupleSpace, ActivityItem, AvatarConfig } from '../types';
import { DEFAULT_AVATAR_A, DEFAULT_AVATAR_B, normalizeAvatar } from '../pixel/character';
import {
  CardAnswer,
  LetterDay,
  LetterKind,
  LettersState,
  StreakInfo,
  cardsFor,
  cardsOf,
  demoLetters,
  emptyLetters,
  isAnswered,
  scoreDay,
  streakInfo,
  todayKey,
  addDays,
} from '../letters/engine';
import { CouchState, checkIn, couchLevel, emptyCouch, normalizeCouch } from '../couch';
import { CloudUser, cloud, cloudEnabled, describeAuthError, signInAsTestUser, signInWithGoogle, signOut as cloudSignOut, watchAuth } from '../cloud/firebase';
import * as store from '../cloud/store';
import { LiveChannel, browserChannel, firestoreChannel } from '../cloud/live';
import type { Firestore } from 'firebase/firestore';

/**
 * The app's state. Two homes for it:
 * - online (Firebase): once you sign in with Google, your place lives in
 *   Firestore and both of you see the same thing on your own devices;
 * - this browser: the demo room, and the prototype before sign-in (or when
 *   this build has no Firebase config), kept in localStorage.
 * Either way the rest of the app sees the same shape.
 */

export type Panel = 'question' | 'questions' | 'us' | 'wardrobe' | 'space' | 'watch' | 'escape' | 'games' | null;
export type JoinResult = 'ok' | 'not_found' | 'full' | 'expired';

export type LetterBadge = 'answer' | 'reveal' | null;
/** off: no Firebase in this build · checking: working out who you are · signedOut · needsSetup: signed in, no place yet · ready */
export type CloudStatus = 'off' | 'checking' | 'signedOut' | 'needsSetup' | 'ready';

export interface InvitePreview {
  spaceName: string;
  hostName: string;
  hostAvatar: AvatarConfig;
  partnerPlaceholderName: string;
  taken: boolean;
  expired: boolean;
}

interface PersistedState {
  version: 3;
  setupComplete: boolean;
  activeUserId: string;
  userA: UserProfile;
  userB: UserProfile | null;
  space: CoupleSpace | null;
  letters: LettersState;
  activities: ActivityItem[];
  couch: CouchState;
}

interface AppContextType {
  setupComplete: boolean;
  currentUser: UserProfile;
  partnerUser: UserProfile | null;
  space: CoupleSpace | null;
  activities: ActivityItem[];
  panel: Panel;
  openPanel: (p: Panel) => void;
  inviteLink: string;
  // compatibility helpers used by existing pages
  setIsWardrobeOpen: (open: boolean) => void;
  setIsOnboardingOpen: (open: boolean) => void;
  updateAvatar: (newAvatar: AvatarConfig) => void;
  // letters
  today: string;
  letters: LettersState;
  /** the letter for a date (a fresh, unanswered one if nobody has opened it yet) */
  getLetter: (kind: LetterKind, dateKey?: string) => LetterDay | null;
  answerCard: (kind: LetterKind, dateKey: string, cardId: string, answer: CardAnswer) => void;
  sealLetter: (kind: LetterKind, dateKey: string) => void;
  markLetterSeen: (kind: LetterKind, dateKey: string) => void;
  setAfterDark: (on: boolean) => void;
  afterDarkOpen: boolean;
  mendStreak: () => void;
  streak: StreakInfo;
  /** how close you sit on the couch: 0 (the two ends) to COUCH_STEPS (side by side) */
  couchLevel: number;
  /** days you've both shown up, all time */
  couchDays: number;
  /** the closeness I last watched happen; below couchLevel means there's a scoot to show me */
  couchShown: number;
  markCouchShown: (level: number) => void;
  /** what the letter on the coffee table should say */
  letterBadge: LetterBadge;
  switchActiveUser: (userId: string) => void;
  updateSpaceDetails: (name: string, togetherSince?: string) => void;
  regenerateInvite: () => void;
  createSpace: (input: {
    spaceName: string;
    myName: string;
    partnerName: string;
    togetherSince?: string;
    avatar: AvatarConfig;
  }) => CoupleSpace;
  lookupInvite: (code: string) => Promise<InvitePreview | null>;
  joinWithCode: (code: string, name: string, avatar: AvatarConfig) => Promise<JoinResult>;
  loadDemo: () => void;
  resetAll: () => void;
  // online
  cloudEnabled: boolean;
  cloudStatus: CloudStatus;
  /** this place lives online (signed in, not the demo) */
  cloudMode: boolean;
  /** looking at the demo room */
  demo: boolean;
  signedInEmail: string | null;
  authError: string | null;
  clearAuthError: () => void;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  moveOnline: () => Promise<void>;
  openLive: <E extends { by: string; at: number }>(topic: LiveTopic) => LiveChannel<E>;
  /** Firestore + ids when this place lives online (for features with their own documents) */
  cloudTarget: () => { db: Firestore; sid: string; uid: string } | null;
  addActivity: (a: Omit<ActivityItem, 'id' | 'timestamp'>) => void;
}

export type LiveTopic = 'watch' | 'escape' | 'stream' | 'doodle';

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'soultied_state_v2';
const LEGACY_KEY = 'thread_and_bean_state_v1';
/** the demo room is kept apart, so peeking never replaces a real place */
const DEMO_KEY = 'soultied_demo_v1';
const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * 24 * 60 * 60 * 1000;

function makeCode() {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(12);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  const s = Array.from(bytes, (b) => chars[b % chars.length]).join('');
  return `ST-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

/** The couple's first day, as a fixed calendar date both phones agree on. */
export const startKeyOf = (space: CoupleSpace) => space.createdAt.slice(0, 10);

function emptyState(): PersistedState {
  return {
    version: 3,
    setupComplete: false,
    activeUserId: 'user-me',
    userA: {
      id: 'user-me',
      name: 'You',
      avatar: DEFAULT_AVATAR_A,
      status: 'online',
      lastActive: new Date().toISOString(),
    },
    userB: null,
    space: null,
    letters: emptyLetters(),
    activities: [],
    couch: emptyCouch(),
  };
}

function demoState(): PersistedState {
  const now = new Date().toISOString();
  const createdAt = new Date(Date.now() - 21 * DAY).toISOString();
  return {
    version: 3,
    setupComplete: true,
    activeUserId: 'user-aanya',
    userA: { id: 'user-aanya', name: 'Aanya', avatar: DEFAULT_AVATAR_A, status: 'online', lastActive: now },
    userB: { id: 'user-rohan', name: 'Rohan', avatar: { ...DEFAULT_AVATAR_B, facialHair: 'stubble' }, status: 'online', lastActive: now },
    space: {
      id: 'space-demo',
      name: 'Our Little Place',
      inviteCode: makeCode(),
      inviteExpiresAt: new Date(Date.now() + WEEK).toISOString(),
      creatorId: 'user-aanya',
      partnerId: 'user-rohan',
      partnerPlaceholderName: 'Rohan',
      togetherSince: '2025-06-14',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      createdAt,
    },
    letters: demoLetters('space-demo', createdAt.slice(0, 10), 'user-aanya', 'user-rohan', todayKey()),
    // three days together so far; Rohan hasn't been in today, so switching to him scoots you closer
    couch: {
      seen: { 'user-aanya': addDays(todayKey(), -1), 'user-rohan': addDays(todayKey(), -1) },
      together: [-6, -4, -1].map((n) => addDays(todayKey(), n)),
      shown: { 'user-aanya': 3, 'user-rohan': 3 },
    },
    activities: [
      { id: 'act-1', type: 'question_revealed', title: 'Letter opened together', description: 'In sync on 4 of 5.', timestamp: 'Yesterday' },
      { id: 'act-2', type: 'avatar_updated', title: 'Wardrobe refresh', description: 'Rohan put on a terracotta cardigan and round glasses.', timestamp: '3 days ago' },
      { id: 'act-3', type: 'partner_joined', title: 'Moved in', description: 'Rohan joined Our Little Place with the invite link.', timestamp: '3 weeks ago' },
    ],
  };
}

function normalizeUser(u: unknown, fallbackAvatar: AvatarConfig): UserProfile | null {
  if (!u || typeof u !== 'object') return null;
  const x = u as UserProfile;
  if (!x.id || !x.name) return null;
  return { ...x, avatar: normalizeAvatar(x.avatar, fallbackAvatar) };
}

function load(): PersistedState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<PersistedState> & { dailySession?: unknown; progression?: unknown };
      const base = emptyState();
      // the demo room is only ever a peek, never something to come back to
      if (p.space?.id === 'space-demo') return base;
      const userA = normalizeUser(p.userA, DEFAULT_AVATAR_A) || base.userA;
      // v2 kept a single daily question; letters start fresh.
      delete p.dailySession;
      delete p.progression;
      const letters = p.letters && p.letters.daily ? { ...emptyLetters(), ...p.letters } : emptyLetters();
      return {
        ...base,
        ...(p as Partial<PersistedState>),
        version: 3,
        userA,
        userB: normalizeUser(p.userB, DEFAULT_AVATAR_B),
        letters,
        couch: normalizeCouch(p.couch),
      };
    }
    // Carry over an older prototype save: keep the space + people, reset looks.
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const p = JSON.parse(legacy);
      if (p && p.space && p.userA) {
        const base = emptyState();
        return {
          ...base,
          setupComplete: true,
          activeUserId: p.userA.id,
          userA: normalizeUser(p.userA, DEFAULT_AVATAR_A) || base.userA,
          userB: normalizeUser(p.userB, DEFAULT_AVATAR_B),
          space: p.space,
          activities: p.activities || [],
        };
      }
    }
  } catch {
    // fall through to a fresh start
  }
  return emptyState();
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<PersistedState>(load);
  const [panel, setPanel] = useState<Panel>(null);
  const [today, setToday] = useState(todayKey);
  const [minute, setMinute] = useState(0);

  // Roll over to a new letter at (this person's) midnight.
  useEffect(() => {
    const t = window.setInterval(() => {
      setToday(todayKey());
      setMinute((m) => m + 1);
    }, 30000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      if (state.space?.id === 'space-demo') localStorage.setItem(DEMO_KEY, JSON.stringify({ day: todayKey(), state }));
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full / blocked: the session still works in memory
    }
  }, [state]);

  // Presence heartbeat for whoever is "at the keyboard" (this-browser mode)
  useEffect(() => {
    const timer = setInterval(() => {
      setState((s) => {
        const now = new Date().toISOString();
        if (s.userA.id === s.activeUserId) return { ...s, userA: { ...s.userA, lastActive: now, status: 'online' } };
        if (s.userB && s.userB.id === s.activeUserId) return { ...s, userB: { ...s.userB, lastActive: now, status: 'online' } };
        return s;
      });
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  /* ======================= online (Firebase) ======================= */

  // undefined while we're still finding out
  const [authUser, setAuthUser] = useState<CloudUser | null | undefined>(cloudEnabled ? undefined : null);
  const [cloudSpaceId, setCloudSpaceId] = useState<string | null | undefined>(undefined);
  const [cloudData, setCloudData] = useState<store.CloudData>(store.emptyCloudData);
  const [demo, setDemo] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const uid = authUser?.uid || null;

  useEffect(() => watchAuth((u) => setAuthUser(u)), []);

  // which place (if any) this person belongs to
  useEffect(() => {
    const c = cloud();
    if (!c || authUser === undefined) return;
    if (!uid) {
      setCloudSpaceId(null);
      return;
    }
    let alive = true;
    setCloudSpaceId(undefined);
    store
      .findSpaceFor(c.db, uid)
      // a place made while we were looking wins over "none found"
      .then((id) => alive && setCloudSpaceId((prev) => id ?? (prev === undefined ? null : prev)))
      .catch(() => alive && setCloudSpaceId((prev) => (prev === undefined ? null : prev)));
    return () => {
      alive = false;
    };
  }, [uid, authUser === undefined]);

  // keep a live copy of the place (and pick the line back up if it drops)
  const [syncTry, setSyncTry] = useState(0);
  const syncKey = useRef('');
  useEffect(() => {
    const c = cloud();
    const key = `${uid}|${cloudSpaceId}`;
    if (syncKey.current !== key) {
      syncKey.current = key;
      setCloudData(store.emptyCloudData());
    }
    if (!c || !uid || !cloudSpaceId) return;
    let retry = 0;
    const off = store.subscribeSpace(
      c.db,
      cloudSpaceId,
      addDays(todayKey(), -60),
      (fn) => setCloudData(fn),
      (err) => {
        console.warn('[soultied] sync', err);
        if (!retry) retry = window.setTimeout(() => setSyncTry((n) => n + 1), 4000);
      }
    );
    return () => {
      window.clearTimeout(retry);
      off();
    };
  }, [uid, cloudSpaceId, syncTry]);

  const cloudMode = cloudEnabled && !!uid && !!cloudSpaceId && !demo;
  const cloudReady = cloudMode && cloudData.loaded.space && cloudData.loaded.members && !!cloudData.space;
  const cloudStatus: CloudStatus = !cloudEnabled
    ? 'off'
    : authUser === undefined
      ? 'checking'
      : !authUser
        ? 'signedOut'
        : cloudSpaceId === undefined
          ? 'checking'
          : !cloudSpaceId
            ? 'needsSetup'
            : cloudReady || demo
              ? 'ready'
              : 'checking';

  // the place, as the rest of the app sees it
  const cloudState = useMemo<PersistedState | null>(() => {
    if (!cloudReady || !uid || !cloudData.space) return null;
    const sp = cloudData.space;
    const profile = (id: string, fallbackName: string, fallbackAvatar: AvatarConfig): UserProfile => {
      const m = cloudData.members[id];
      const last = m?.lastActive || '';
      const fresh = !!last && Date.now() - new Date(last).getTime() < 4 * 60000;
      return {
        id,
        name: m?.name || fallbackName,
        avatar: normalizeAvatar(m?.avatar, fallbackAvatar),
        status: id === uid || fresh ? 'online' : 'away',
        lastActive: last,
      };
    };
    const { members: _m, inviteExpiresAtMs: _e, joinCode: _j, ...space } = sp;
    void _m;
    void _e;
    void _j;
    return {
      version: 3,
      setupComplete: true,
      activeUserId: uid,
      userA: profile(sp.creatorId, 'You', DEFAULT_AVATAR_A),
      userB: sp.partnerId ? profile(sp.partnerId, sp.partnerPlaceholderName, DEFAULT_AVATAR_B) : null,
      space: space as CoupleSpace,
      letters: { daily: cloudData.daily, afterDark: cloudData.afterDark, afterDarkOn: cloudData.afterDarkOn, repairs: cloudData.repairs },
      activities: cloudData.activities,
      couch: cloudData.couch,
    };
    // `minute` re-checks who's around
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudReady, uid, cloudData, minute]);

  const eff = cloudState ?? state;

  /** Firestore + ids, when this place lives online. */
  const online = () => {
    const c = cloud();
    return cloudMode && c && uid && cloudSpaceId ? { db: c.db, sid: cloudSpaceId, uid } : null;
  };
  const warn = (what: string) => (err: unknown) => console.warn(`[soultied] ${what}`, err);

  // let your person know you're around
  useEffect(() => {
    if (!cloudReady) return;
    const beat = () => {
      const o = online();
      if (o && !document.hidden) store.writeMember(o.db, o.sid, o.uid, { lastActive: new Date().toISOString() }).catch(warn('presence'));
    };
    beat();
    const t = window.setInterval(beat, 120000);
    document.addEventListener('visibilitychange', beat);
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', beat);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudReady, cloudSpaceId, uid]);

  const signIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(describeAuthError(err));
    }
  };

  const signOut = async () => {
    setPanel(null);
    setDemo(false);
    await cloudSignOut().catch(warn('sign out'));
  };

  /* ======================= who's who ======================= */

  const { userA, userB, activeUserId } = eff;
  const currentUser = activeUserId === userA.id || !userB ? userA : userB;
  const partnerUser = currentUser.id === userA.id ? userB : userA;

  // Showing up: once a day each, and a day you're both here scoots you closer on the couch.
  const partnerId = partnerUser?.id || null;
  const partnerSeenToday = !!partnerId && eff.couch.seen[partnerId] === today;
  useEffect(() => {
    if (!eff.setupComplete) return;
    const o = online();
    if (o) {
      if (!cloudReady) return;
      const c = eff.couch;
      const already = c.together.includes(today);
      if (c.seen[o.uid] === today && (!partnerSeenToday || already)) return;
      store.writeCouchSeen(o.db, o.sid, o.uid, today, partnerSeenToday && !already).catch(warn('couch'));
      return;
    }
    setState((s) => {
      const next = checkIn(s.couch, currentUser.id, partnerId, today);
      return next === s.couch ? s : { ...s, couch: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eff.setupComplete, currentUser.id, partnerId, today, partnerSeenToday, cloudReady]);

  const markCouchShown = (level: number) => {
    const o = online();
    if (o) {
      if ((eff.couch.shown[o.uid] ?? 0) < level) store.writeCouchShown(o.db, o.sid, o.uid, level).catch(warn('couch'));
      return;
    }
    setState((s) => {
      const me = s.activeUserId === s.userA.id || !s.userB ? s.userA.id : s.userB.id;
      if ((s.couch.shown[me] ?? 0) >= level) return s;
      return { ...s, couch: { ...s.couch, shown: { ...s.couch.shown, [me]: level } } };
    });
  };

  const afterDarkOpen = !!partnerUser && !!eff.letters.afterDarkOn[currentUser.id] && !!eff.letters.afterDarkOn[partnerUser.id];

  const todays = eff.letters.daily[today];
  const letterBadge: LetterBadge = !partnerUser
    ? null
    : !todays?.by[currentUser.id]?.sealedAt
      ? 'answer'
      : todays.revealedAt && !todays.by[currentUser.id]?.seenAt
        ? 'reveal'
        : null;

  const inviteLink = useMemo(() => {
    if (!eff.space) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
    return `${origin}?join=${eff.space.inviteCode}`;
  }, [eff.space]);

  const pushActivity = (a: Omit<ActivityItem, 'id' | 'timestamp'>) => (list: ActivityItem[]) => [
    { ...a, id: 'act-' + Date.now() + Math.random().toString(36).slice(2, 6), timestamp: 'Just now' },
    ...list,
  ];

  const updateAvatar = (avatar: AvatarConfig) => {
    const o = online();
    if (o) {
      store.writeMember(o.db, o.sid, o.uid, { avatar }).catch(warn('look'));
      store.writeActivity(o.db, o.sid, { type: 'avatar_updated', title: 'New look', description: `${currentUser.name} changed their look.` }).catch(warn('activity'));
      return;
    }
    setState((s) => {
      const isA = s.activeUserId === s.userA.id || !s.userB;
      const me = isA ? s.userA : s.userB!;
      const next = { ...me, avatar };
      return {
        ...s,
        userA: isA ? next : s.userA,
        userB: isA ? s.userB : next,
        activities: s.setupComplete
          ? pushActivity({ type: 'avatar_updated', title: 'New look', description: `${me.name} changed their look.` })(s.activities)
          : s.activities,
      };
    });
  };

  /* ---------- letters ---------- */

  const meId = (s: PersistedState) => (s.activeUserId === s.userA.id || !s.userB ? s.userA.id : s.userB.id);
  const partnerOf = (s: PersistedState, id: string) => (id === s.userA.id ? s.userB : s.userA);
  const bucket = (kind: LetterKind) => (kind === 'daily' ? 'daily' : 'afterDark') as 'daily' | 'afterDark';

  const makeDay = (s: PersistedState, kind: LetterKind, dateKey: string): LetterDay | null =>
    s.space ? { dateKey, cardIds: cardsFor(kind, s.space.id, dateKey, startKeyOf(s.space)), by: {} } : null;

  const getLetter: AppContextType['getLetter'] = (kind, dateKey = today) => eff.letters[bucket(kind)][dateKey] || makeDay(eff, kind, dateKey);

  /** Update one letter day; creates it (freezing its cards) the first time someone touches it. */
  const withDay = (s: PersistedState, kind: LetterKind, dateKey: string, fn: (d: LetterDay, me: string) => LetterDay | null) => {
    const b = bucket(kind);
    const cur = s.letters[b][dateKey] || makeDay(s, kind, dateKey);
    if (!cur) return s;
    const next = fn(cur, meId(s));
    if (!next || next === cur) return s;
    return { ...s, letters: { ...s.letters, [b]: { ...s.letters[b], [dateKey]: next } } };
  };

  const answerCard: AppContextType['answerCard'] = (kind, dateKey, cardId, answer) => {
    const o = online();
    if (o) {
      const d = getLetter(kind, dateKey);
      if (!d || d.by[o.uid]?.sealedAt || !d.cardIds.includes(cardId)) return;
      store.writeAnswer(o.db, o.sid, o.uid, kind, d, cardId, answer).catch(warn('answer'));
      return;
    }
    setState((s) =>
      withDay(s, kind, dateKey, (d, me) => {
        const mine = d.by[me] || { cards: {} };
        if (mine.sealedAt || !d.cardIds.includes(cardId)) return null;
        return { ...d, by: { ...d.by, [me]: { ...mine, cards: { ...mine.cards, [cardId]: answer } } } };
      })
    );
  };

  const sealLetter: AppContextType['sealLetter'] = (kind, dateKey) => {
    const o = online();
    if (o) {
      const d = getLetter(kind, dateKey);
      const mine = d?.by[o.uid];
      if (!d || !mine || mine.sealedAt) return;
      if (!cardsOf(d.cardIds).every((c) => isAnswered(c, mine.cards[c.id]))) return;
      const now = new Date().toISOString();
      const both = !!partnerId && !!d.by[partnerId]?.sealedAt;
      store.writeMyLetter(o.db, o.sid, o.uid, kind, d, { sealedAt: now, ...(both ? { seenAt: now } : {}) }, both ? now : undefined).catch(warn('seal'));
      if (both && partnerId && kind === 'daily') {
        const opened: LetterDay = { ...d, by: { ...d.by, [o.uid]: { ...mine, sealedAt: now } } };
        const sc = scoreDay(opened, o.uid, partnerId);
        store
          .writeActivity(o.db, o.sid, { type: 'question_revealed', title: 'Letter opened together', description: `In sync on ${sc.same} of ${sc.total}.` })
          .catch(warn('activity'));
      }
      return;
    }
    setState((s) => {
      let opened = null as LetterDay | null;
      const me = meId(s);
      const partner = partnerOf(s, me);
      const next = withDay(s, kind, dateKey, (d) => {
        const mine = d.by[me];
        if (!mine || mine.sealedAt) return null;
        if (!cardsOf(d.cardIds).every((c) => isAnswered(c, mine.cards[c.id]))) return null;
        const now = new Date().toISOString();
        const both = !!partner && !!d.by[partner.id]?.sealedAt;
        const nd: LetterDay = { ...d, by: { ...d.by, [me]: { ...mine, sealedAt: now, seenAt: both ? now : undefined } } };
        if (both) {
          nd.revealedAt = now;
          opened = nd;
        }
        return nd;
      });
      if (opened && partner && kind === 'daily') {
        const sc = scoreDay(opened, me, partner.id);
        next.activities = pushActivity({
          type: 'question_revealed',
          title: 'Letter opened together',
          description: `In sync on ${sc.same} of ${sc.total}.`,
        })(s.activities);
      }
      return next;
    });
  };

  // Online, two people can seal at the same moment and each miss the other's seal:
  // whoever notices a letter both have sealed opens it.
  useEffect(() => {
    const o = online();
    if (!o || !cloudReady || !partnerId) return;
    (['daily', 'afterDark'] as LetterKind[]).forEach((kind) =>
      Object.values(eff.letters[bucket(kind)]).forEach((d) => {
        if (!d.revealedAt && d.by[o.uid]?.sealedAt && d.by[partnerId]?.sealedAt)
          store.writeMyLetter(o.db, o.sid, o.uid, kind, d, {}, new Date().toISOString()).catch(warn('open letter'));
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudReady, eff.letters, partnerId]);

  const markLetterSeen: AppContextType['markLetterSeen'] = (kind, dateKey) => {
    const o = online();
    if (o) {
      const d = getLetter(kind, dateKey);
      const mine = d?.by[o.uid];
      if (!d || !d.revealedAt || !mine || mine.seenAt) return;
      store.writeMyLetter(o.db, o.sid, o.uid, kind, d, { seenAt: new Date().toISOString() }).catch(warn('seen'));
      return;
    }
    setState((s) =>
      withDay(s, kind, dateKey, (d, me) => {
        const mine = d.by[me];
        if (!d.revealedAt || !mine || mine.seenAt) return null;
        return { ...d, by: { ...d.by, [me]: { ...mine, seenAt: new Date().toISOString() } } };
      })
    );
  };

  const setAfterDark = (on: boolean) => {
    const o = online();
    if (o) {
      store.writeAfterDark(o.db, o.sid, o.uid, on).catch(warn('after dark'));
      return;
    }
    setState((s) => ({ ...s, letters: { ...s.letters, afterDarkOn: { ...s.letters.afterDarkOn, [meId(s)]: on } } }));
  };

  const sinceKey = eff.space ? startKeyOf(eff.space) : undefined;
  const streak = useMemo(() => streakInfo(eff.letters, today, sinceKey), [eff.letters, today, sinceKey]);

  const mendStreak = () => {
    const o = online();
    if (o) {
      if (streak.mendable) store.writeRepair(o.db, o.sid, streak.mendable).catch(warn('mend'));
      return;
    }
    setState((s) => {
      const info = streakInfo(s.letters, todayKey(), s.space ? startKeyOf(s.space) : undefined);
      if (!info.mendable) return s;
      return { ...s, letters: { ...s.letters, repairs: [...s.letters.repairs, info.mendable] } };
    });
  };

  /** "View as" is for the one-browser prototype; online, you are always you. */
  const switchActiveUser = (id: string) => {
    if (cloudMode) return;
    setState((s) => ({ ...s, activeUserId: id }));
  };

  const updateSpaceDetails = (name: string, togetherSince?: string) => {
    const o = online();
    if (o) {
      store.writeSpace(o.db, o.sid, { name, ...(togetherSince ? { togetherSince } : {}) }).catch(warn('place'));
      return;
    }
    setState((s) => (s.space ? { ...s, space: { ...s.space, name, togetherSince: togetherSince || s.space.togetherSince } } : s));
  };

  const regenerateInvite = () => {
    const o = online();
    if (o) {
      const sp = cloudData.space;
      const host = cloudData.members[sp?.creatorId || ''] || cloudData.members[o.uid];
      if (sp && host) store.writeNewInvite(o.db, sp, host, makeCode(), new Date(Date.now() + WEEK).toISOString()).catch(warn('invite'));
      return;
    }
    setState((s) =>
      s.space
        ? { ...s, space: { ...s.space, inviteCode: makeCode(), inviteExpiresAt: new Date(Date.now() + WEEK).toISOString() } }
        : s
    );
  };

  /** Start a place online (signed in) or in this browser (not signed in / no Firebase). */
  const createSpace: AppContextType['createSpace'] = ({ spaceName, myName, partnerName, togetherSince, avatar }) => {
    const now = new Date().toISOString();
    const c = cloud();
    const onlineUid = !demo && c ? c.auth.currentUser?.uid : undefined;
    const meIdNew = onlineUid || 'user-' + Date.now();
    const me: UserProfile = { id: meIdNew, name: myName.trim() || 'Me', avatar, status: 'online', lastActive: now };
    const space: CoupleSpace = {
      id: onlineUid ? store.newId('space') : 'space-' + Date.now(),
      name: spaceName.trim() || 'Our Little Place',
      inviteCode: makeCode(),
      inviteExpiresAt: new Date(Date.now() + WEEK).toISOString(),
      creatorId: me.id,
      partnerPlaceholderName: partnerName.trim() || 'my person',
      togetherSince: togetherSince || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      createdAt: now,
    };
    const first: ActivityItem = { id: 'act-' + Date.now(), type: 'space_created', title: 'Moved in', description: `${me.name} set up ${space.name}.`, timestamp: 'Just now' };
    if (c && onlineUid) {
      setAuthError(null);
      // start listening once it's really saved, so the first look at it isn't turned away
      store
        .createSpace(c.db, onlineUid, space, { name: me.name, avatar, lastActive: now }, first)
        .then(() => setCloudSpaceId(space.id))
        .catch((err) => {
          warn('create')(err);
          setAuthError('We couldn’t save your place online. Check your connection and try again.');
        });
      return space;
    }
    setState({
      ...emptyState(),
      setupComplete: true,
      activeUserId: me.id,
      userA: me,
      userB: null,
      space,
      activities: [first],
    });
    return space;
  };

  /** Put a place that only lived in this browser online, so your person can join from anywhere. */
  const moveOnline = async () => {
    const c = cloud();
    if (!c) return;
    if (!c.auth.currentUser) {
      await signIn();
      if (!c.auth.currentUser) return;
    }
    const u = c.auth.currentUser.uid;
    const existing = await store.findSpaceFor(c.db, u).catch(() => null);
    setDemo(false);
    if (existing) {
      setCloudSpaceId(existing);
      return;
    }
    const s = state;
    const me = s.activeUserId === s.userA.id || !s.userB ? s.userA : s.userB;
    createSpace({
      spaceName: s.space?.name || 'Our Little Place',
      myName: me.name,
      partnerName: s.space?.partnerPlaceholderName || 'my person',
      togetherSince: s.space?.togetherSince,
      avatar: me.avatar,
    });
  };

  const lookupInvite: AppContextType['lookupInvite'] = async (code) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return null;
    const c = cloud();
    if (c && c.auth.currentUser && !demo) {
      const inv = await store.lookupInvite(c.db, clean);
      return inv
        ? {
            spaceName: inv.spaceName,
            hostName: inv.hostName,
            hostAvatar: normalizeAvatar(inv.hostAvatar, DEFAULT_AVATAR_A),
            partnerPlaceholderName: inv.partnerPlaceholderName,
            taken: false,
            expired: inv.expiresAt.toMillis() < Date.now(),
          }
        : null;
    }
    if (!state.space || state.space.inviteCode.toUpperCase() !== clean) return null;
    const host = state.userA.id === state.space.creatorId ? state.userA : state.userB || state.userA;
    return {
      spaceName: state.space.name,
      hostName: host.name,
      hostAvatar: host.avatar,
      partnerPlaceholderName: state.space.partnerPlaceholderName,
      taken: !!state.space.partnerId,
      expired: new Date(state.space.inviteExpiresAt).getTime() < Date.now(),
    };
  };

  const joinWithCode: AppContextType['joinWithCode'] = async (code, name, avatar) => {
    const c = cloud();
    const onlineUid = !demo && c ? c.auth.currentUser?.uid : undefined;
    const displayName = name.trim();
    if (c && onlineUid) {
      const joined: ActivityItem = {
        id: 'act-' + Date.now(),
        type: 'partner_joined',
        title: 'Moved in',
        description: `${displayName || 'Your person'} took the seat on the couch.`,
        timestamp: 'Just now',
      };
      const r = await store
        .joinSpace(c.db, onlineUid, code, { name: displayName || 'Me', avatar, lastActive: new Date().toISOString() }, joined)
        .catch(() => ({ result: 'not_found' as const, spaceId: undefined }));
      if (r.result === 'ok' && r.spaceId) setCloudSpaceId(r.spaceId);
      return r.result;
    }
    const clean = code.trim().toUpperCase();
    if (!state.space || state.space.inviteCode.toUpperCase() !== clean) return 'not_found';
    if (state.space.partnerId) return 'full';
    if (new Date(state.space.inviteExpiresAt).getTime() < Date.now()) return 'expired';
    const partner: UserProfile = {
      id: 'user-' + Date.now(),
      name: displayName || state.space.partnerPlaceholderName,
      avatar,
      status: 'online',
      lastActive: new Date().toISOString(),
    };
    setState((s) => ({
      ...s,
      setupComplete: true,
      userB: partner,
      activeUserId: partner.id,
      space: s.space ? { ...s.space, partnerId: partner.id, partnerPlaceholderName: partner.name } : s.space,
      activities: pushActivity({ type: 'partner_joined', title: 'Moved in', description: `${partner.name} took the seat on the couch.` })(s.activities),
    }));
    return 'ok';
  };

  const loadDemo = () => {
    setPanel(null);
    setDemo(true);
    // back for another peek the same day: pick up where you left off
    let saved: PersistedState | null = null;
    try {
      const d = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null') as { day?: string; state?: PersistedState } | null;
      if (d?.day === todayKey() && d.state?.space?.id === 'space-demo') saved = { ...demoState(), ...d.state, couch: normalizeCouch(d.state.couch) };
    } catch {
      // a fresh demo, then
    }
    setState(saved || demoState());
  };

  const resetAll = () => {
    // in the demo, "start over" just steps back out: your own place is untouched
    if (demo) {
      try {
        localStorage.removeItem(DEMO_KEY);
      } catch {
        // ignore
      }
      setPanel(null);
      setDemo(false);
      setState(load());
      return;
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
    setPanel(null);
    setDemo(false);
    setState(emptyState());
  };

  /** The live line to your person: through Firebase when you're online, between tabs otherwise. */
  const openLive = useCallback(
    <E extends { by: string; at: number }>(topic: LiveTopic): LiveChannel<E> => {
      const c = cloud();
      if (cloudMode && c && cloudSpaceId) return firestoreChannel<E>(c.db, cloudSpaceId, topic);
      return browserChannel<E>(`soultied-${topic}-${eff.space?.id || 'solo'}`);
    },
    [cloudMode, cloudSpaceId, eff.space?.id]
  );

  const addActivity: AppContextType['addActivity'] = (a) => {
    const o = online();
    if (o) {
      store.writeActivity(o.db, o.sid, a).catch(warn('activity'));
      return;
    }
    setState((s) => ({ ...s, activities: pushActivity(a)(s.activities) }));
  };

  // tests against the emulator sign in without a Google popup
  useEffect(() => {
    if (!import.meta.env.VITE_FIREBASE_EMULATOR) return;
    (window as unknown as { __soultiedTestSignIn?: typeof signInAsTestUser }).__soultiedTestSignIn = signInAsTestUser;
  }, []);

  return (
    <AppContext.Provider
      value={{
        setupComplete: eff.setupComplete,
        currentUser,
        partnerUser,
        space: eff.space,
        activities: eff.activities,
        panel,
        openPanel: setPanel,
        inviteLink,
        setIsWardrobeOpen: (o) => setPanel(o ? 'wardrobe' : null),
        setIsOnboardingOpen: (o) => setPanel(o ? 'space' : null),
        updateAvatar,
        today,
        letters: eff.letters,
        getLetter,
        answerCard,
        sealLetter,
        markLetterSeen,
        setAfterDark,
        afterDarkOpen,
        mendStreak,
        streak,
        couchLevel: couchLevel(eff.couch),
        couchDays: eff.couch.together.length,
        couchShown: eff.couch.shown[currentUser.id] ?? 0,
        markCouchShown,
        letterBadge,
        switchActiveUser,
        updateSpaceDetails,
        regenerateInvite,
        createSpace,
        lookupInvite,
        joinWithCode,
        loadDemo,
        resetAll,
        cloudEnabled,
        cloudStatus,
        cloudMode,
        demo,
        signedInEmail: authUser?.email || null,
        authError,
        clearAuthError: () => setAuthError(null),
        signIn,
        signOut,
        moveOnline,
        openLive,
        cloudTarget: online,
        addActivity,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
