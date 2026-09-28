import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
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

/**
 * Local-only prototype state. Everything lives in this browser's
 * localStorage; real two-device pairing needs the backend milestone.
 */

export type Panel = 'question' | 'questions' | 'us' | 'wardrobe' | 'space' | 'watch' | 'escape' | null;
export type JoinResult = 'ok' | 'not_found' | 'full' | 'expired';

export type LetterBadge = 'answer' | 'reveal' | null;

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
  findInvite: (code: string) => { space: CoupleSpace; host: UserProfile } | null;
  joinWithCode: (code: string, name: string, avatar: AvatarConfig) => JoinResult;
  loadDemo: () => void;
  resetAll: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'soultied_state_v2';
const LEGACY_KEY = 'thread_and_bean_state_v1';
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

  // Roll over to a new letter at (this person's) midnight.
  useEffect(() => {
    const t = window.setInterval(() => setToday(todayKey()), 30000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage full / blocked: the session still works in memory
    }
  }, [state]);

  // Presence heartbeat for whoever is "at the keyboard"
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

  const { userA, userB, activeUserId } = state;
  const currentUser = activeUserId === userA.id || !userB ? userA : userB;
  const partnerUser = currentUser.id === userA.id ? userB : userA;

  // Showing up: once a day each, and a day you're both here scoots you closer on the couch.
  const partnerId = partnerUser?.id || null;
  useEffect(() => {
    if (!state.setupComplete) return;
    setState((s) => {
      const next = checkIn(s.couch, currentUser.id, partnerId, today);
      return next === s.couch ? s : { ...s, couch: next };
    });
  }, [state.setupComplete, currentUser.id, partnerId, today]);

  const markCouchShown = (level: number) =>
    setState((s) => {
      const me = s.activeUserId === s.userA.id || !s.userB ? s.userA.id : s.userB.id;
      if ((s.couch.shown[me] ?? 0) >= level) return s;
      return { ...s, couch: { ...s.couch, shown: { ...s.couch.shown, [me]: level } } };
    });

  const afterDarkOpen = !!partnerUser && !!state.letters.afterDarkOn[currentUser.id] && !!state.letters.afterDarkOn[partnerUser.id];

  const todays = state.letters.daily[today];
  const letterBadge: LetterBadge = !partnerUser
    ? null
    : !todays?.by[currentUser.id]?.sealedAt
      ? 'answer'
      : todays.revealedAt && !todays.by[currentUser.id]?.seenAt
        ? 'reveal'
        : null;

  const inviteLink = useMemo(() => {
    if (!state.space) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : '';
    return `${origin}?join=${state.space.inviteCode}`;
  }, [state.space]);

  const pushActivity = (a: Omit<ActivityItem, 'id' | 'timestamp'>) => (list: ActivityItem[]) => [
    { ...a, id: 'act-' + Date.now() + Math.random().toString(36).slice(2, 6), timestamp: 'Just now' },
    ...list,
  ];

  const updateAvatar = (avatar: AvatarConfig) => {
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

  const getLetter: AppContextType['getLetter'] = (kind, dateKey = today) =>
    state.letters[bucket(kind)][dateKey] || makeDay(state, kind, dateKey);

  /** Update one letter day; creates it (freezing its cards) the first time someone touches it. */
  const withDay = (s: PersistedState, kind: LetterKind, dateKey: string, fn: (d: LetterDay, me: string) => LetterDay | null) => {
    const b = bucket(kind);
    const cur = s.letters[b][dateKey] || makeDay(s, kind, dateKey);
    if (!cur) return s;
    const next = fn(cur, meId(s));
    if (!next || next === cur) return s;
    return { ...s, letters: { ...s.letters, [b]: { ...s.letters[b], [dateKey]: next } } };
  };

  const answerCard: AppContextType['answerCard'] = (kind, dateKey, cardId, answer) =>
    setState((s) =>
      withDay(s, kind, dateKey, (d, me) => {
        const mine = d.by[me] || { cards: {} };
        if (mine.sealedAt || !d.cardIds.includes(cardId)) return null;
        return { ...d, by: { ...d.by, [me]: { ...mine, cards: { ...mine.cards, [cardId]: answer } } } };
      })
    );

  const sealLetter: AppContextType['sealLetter'] = (kind, dateKey) =>
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

  const markLetterSeen: AppContextType['markLetterSeen'] = (kind, dateKey) =>
    setState((s) =>
      withDay(s, kind, dateKey, (d, me) => {
        const mine = d.by[me];
        if (!d.revealedAt || !mine || mine.seenAt) return null;
        return { ...d, by: { ...d.by, [me]: { ...mine, seenAt: new Date().toISOString() } } };
      })
    );

  const setAfterDark = (on: boolean) =>
    setState((s) => ({ ...s, letters: { ...s.letters, afterDarkOn: { ...s.letters.afterDarkOn, [meId(s)]: on } } }));

  const sinceKey = state.space ? startKeyOf(state.space) : undefined;
  const streak = useMemo(() => streakInfo(state.letters, today, sinceKey), [state.letters, today, sinceKey]);

  const mendStreak = () =>
    setState((s) => {
      const info = streakInfo(s.letters, todayKey(), s.space ? startKeyOf(s.space) : undefined);
      if (!info.mendable) return s;
      return { ...s, letters: { ...s.letters, repairs: [...s.letters.repairs, info.mendable] } };
    });

  const switchActiveUser = (id: string) => setState((s) => ({ ...s, activeUserId: id }));

  const updateSpaceDetails = (name: string, togetherSince?: string) =>
    setState((s) => (s.space ? { ...s, space: { ...s.space, name, togetherSince: togetherSince || s.space.togetherSince } } : s));

  const regenerateInvite = () =>
    setState((s) =>
      s.space
        ? { ...s, space: { ...s.space, inviteCode: makeCode(), inviteExpiresAt: new Date(Date.now() + WEEK).toISOString() } }
        : s
    );

  const createSpace: AppContextType['createSpace'] = ({ spaceName, myName, partnerName, togetherSince, avatar }) => {
    const now = new Date().toISOString();
    const me: UserProfile = { id: 'user-' + Date.now(), name: myName.trim() || 'Me', avatar, status: 'online', lastActive: now };
    const space: CoupleSpace = {
      id: 'space-' + Date.now(),
      name: spaceName.trim() || 'Our Little Place',
      inviteCode: makeCode(),
      inviteExpiresAt: new Date(Date.now() + WEEK).toISOString(),
      creatorId: me.id,
      partnerPlaceholderName: partnerName.trim() || 'my person',
      togetherSince: togetherSince || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      createdAt: now,
    };
    setState({
      ...emptyState(),
      setupComplete: true,
      activeUserId: me.id,
      userA: me,
      userB: null,
      space,
      activities: [{ id: 'act-' + Date.now(), type: 'space_created', title: 'Moved in', description: `${me.name} set up ${space.name}.`, timestamp: 'Just now' }],
    });
    return space;
  };

  const findInvite: AppContextType['findInvite'] = (code) => {
    const clean = code.trim().toUpperCase();
    if (!state.space || state.space.inviteCode.toUpperCase() !== clean) return null;
    const host = state.userA.id === state.space.creatorId ? state.userA : state.userB || state.userA;
    return { space: state.space, host };
  };

  const joinWithCode: AppContextType['joinWithCode'] = (code, name, avatar) => {
    const found = findInvite(code);
    if (!found) return 'not_found';
    if (state.space?.partnerId) return 'full';
    if (new Date(found.space.inviteExpiresAt).getTime() < Date.now()) return 'expired';
    const partner: UserProfile = {
      id: 'user-' + Date.now(),
      name: name.trim() || found.space.partnerPlaceholderName,
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
    setState(demoState());
  };

  const resetAll = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
    setPanel(null);
    setState(emptyState());
  };

  return (
    <AppContext.Provider
      value={{
        setupComplete: state.setupComplete,
        currentUser,
        partnerUser,
        space: state.space,
        activities: state.activities,
        panel,
        openPanel: setPanel,
        inviteLink,
        setIsWardrobeOpen: (o) => setPanel(o ? 'wardrobe' : null),
        setIsOnboardingOpen: (o) => setPanel(o ? 'space' : null),
        updateAvatar,
        today,
        letters: state.letters,
        getLetter,
        answerCard,
        sealLetter,
        markLetterSeen,
        setAfterDark,
        afterDarkOpen,
        mendStreak,
        streak,
        couchLevel: couchLevel(state.couch),
        couchDays: state.couch.together.length,
        couchShown: state.couch.shown[currentUser.id] ?? 0,
        markCouchShown,
        letterBadge,
        switchActiveUser,
        updateSpaceDetails,
        regenerateInvite,
        createSpace,
        findInvite,
        joinWithCode,
        loadDemo,
        resetAll,
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
