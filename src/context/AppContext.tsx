import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  UserProfile,
  CoupleSpace,
  DailySession,
  ActivityItem,
  ProgressionStats,
  AvatarConfig,
} from '../types';
import { DEFAULT_AVATAR_A, DEFAULT_AVATAR_B, normalizeAvatar } from '../pixel/character';
import { QUESTIONS_CATALOGUE } from '../data/questionsCatalogue';

/**
 * Local-only prototype state. Everything lives in this browser's
 * localStorage; real two-device pairing needs the backend milestone.
 */

export type Panel = 'question' | 'questions' | 'us' | 'wardrobe' | 'space' | null;
export type JoinResult = 'ok' | 'not_found' | 'full' | 'expired';

interface PersistedState {
  version: 2;
  setupComplete: boolean;
  activeUserId: string;
  userA: UserProfile;
  userB: UserProfile | null;
  space: CoupleSpace | null;
  dailySession: DailySession;
  progression: ProgressionStats;
  activities: ActivityItem[];
}

interface AppContextType {
  setupComplete: boolean;
  currentUser: UserProfile;
  partnerUser: UserProfile | null;
  space: CoupleSpace | null;
  dailySession: DailySession;
  progression: ProgressionStats;
  activities: ActivityItem[];
  panel: Panel;
  openPanel: (p: Panel) => void;
  inviteLink: string;
  // compatibility helpers used by existing pages
  setIsWardrobeOpen: (open: boolean) => void;
  setIsOnboardingOpen: (open: boolean) => void;
  updateAvatar: (newAvatar: AvatarConfig) => void;
  submitAnswer: (optionId: string) => void;
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
const WEEK = 7 * 24 * 60 * 60 * 1000;

function makeCode() {
  const chars = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  const bytes = new Uint8Array(12);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  const s = Array.from(bytes, (b) => chars[b % chars.length]).join('');
  return `ST-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

const today = () => new Date().toISOString().split('T')[0];

function freshSession(): DailySession {
  return {
    id: 'session-' + Date.now(),
    dateKey: today(),
    question: QUESTIONS_CATALOGUE[0],
    submittedUserIds: [],
    revealed: false,
    answers: {},
  };
}

function emptyState(): PersistedState {
  return {
    version: 2,
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
    dailySession: freshSession(),
    progression: {
      currentStreak: 0,
      bestStreak: 0,
      lifetimeConnectedDays: 0,
      weekDots: [false, false, false, false, false, false, false],
    },
    activities: [],
  };
}

function demoState(): PersistedState {
  const now = new Date().toISOString();
  return {
    version: 2,
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
      createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    },
    dailySession: {
      id: 'session-today',
      dateKey: today(),
      question: QUESTIONS_CATALOGUE[0],
      submittedUserIds: ['user-rohan'],
      revealed: false,
      answers: { 'user-rohan': 'opt-3' },
    },
    progression: { currentStreak: 4, bestStreak: 7, lifetimeConnectedDays: 18, weekDots: [true, true, true, true, false, false, false] },
    activities: [
      { id: 'act-1', type: 'question_revealed', title: 'Question answered together', description: 'You both shared your ideal evening.', timestamp: 'Yesterday' },
      { id: 'act-2', type: 'avatar_updated', title: 'Wardrobe refresh', description: 'Rohan put on a terracotta cardigan and round glasses.', timestamp: '3 days ago' },
      { id: 'act-3', type: 'partner_joined', title: 'Moved in', description: 'Rohan joined Our Little Place with the invite link.', timestamp: '14 days ago' },
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
      const p = JSON.parse(raw) as PersistedState;
      const base = emptyState();
      const userA = normalizeUser(p.userA, DEFAULT_AVATAR_A) || base.userA;
      return {
        ...base,
        ...p,
        version: 2,
        userA,
        userB: normalizeUser(p.userB, DEFAULT_AVATAR_B),
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
          dailySession: p.dailySession || base.dailySession,
          progression: p.progression || base.progression,
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

  const submitAnswer = (optionId: string) => {
    setState((s) => {
      const me = s.activeUserId === s.userA.id || !s.userB ? s.userA : s.userB;
      const partner = me.id === s.userA.id ? s.userB : s.userA;
      const ds = s.dailySession;
      if (!partner || ds.submittedUserIds.includes(me.id)) return s;
      const submitted = [...ds.submittedUserIds, me.id];
      const both = submitted.includes(partner.id);
      const next: PersistedState = {
        ...s,
        dailySession: {
          ...ds,
          submittedUserIds: submitted,
          answers: { ...ds.answers, [me.id]: optionId },
          revealed: both,
          revealedAt: both ? new Date().toISOString() : undefined,
        },
      };
      if (both) {
        const p = s.progression;
        const dots = [...p.weekDots];
        const idx = dots.findIndex((d) => !d);
        if (idx !== -1) dots[idx] = true;
        next.progression = {
          currentStreak: p.currentStreak + 1,
          bestStreak: Math.max(p.bestStreak, p.currentStreak + 1),
          lifetimeConnectedDays: p.lifetimeConnectedDays + 1,
          weekDots: dots,
        };
        next.activities = pushActivity({
          type: 'question_revealed',
          title: 'Letter opened together',
          description: `Both answers opened for “${ds.question.prompt}”`,
        })(s.activities);
      }
      return next;
    });
  };

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
      dailySession: freshSession(),
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
        dailySession: state.dailySession,
        progression: state.progression,
        activities: state.activities,
        panel,
        openPanel: setPanel,
        inviteLink,
        setIsWardrobeOpen: (o) => setPanel(o ? 'wardrobe' : null),
        setIsOnboardingOpen: (o) => setPanel(o ? 'space' : null),
        updateAvatar,
        submitAnswer,
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
