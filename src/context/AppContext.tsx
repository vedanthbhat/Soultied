import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  UserProfile,
  CoupleSpace,
  DailySession,
  ActivityItem,
  ProgressionStats,
  AvatarConfig,
} from '../types';
import { STARTER_PRESET_A, STARTER_PRESET_B } from '../data/wardrobeCatalogue';
import { QUESTIONS_CATALOGUE } from '../data/questionsCatalogue';

interface AppContextType {
  currentUser: UserProfile;
  partnerUser: UserProfile | null;
  space: CoupleSpace | null;
  dailySession: DailySession;
  progression: ProgressionStats;
  activities: ActivityItem[];
  activeTab: 'home' | 'questions' | 'us';
  setActiveTab: (tab: 'home' | 'questions' | 'us') => void;
  isWardrobeOpen: boolean;
  setIsWardrobeOpen: (open: boolean) => void;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  updateAvatar: (newAvatar: AvatarConfig) => void;
  submitAnswer: (optionId: string) => void;
  switchActiveUser: (userId: string) => void;
  updateSpaceDetails: (name: string, togetherSince?: string) => void;
  regenerateInvite: () => void;
  joinWithCode: (code: string, newUserName: string) => boolean;
  createSpace: (spaceName: string, myName: string, partnerName: string, togetherSince?: string) => void;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEY = 'thread_and_bean_state_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initial default state mirroring the warm interface reference (Aanya & Rohan)
  const [userA, setUserA] = useState<UserProfile>({
    id: 'user-aanya',
    name: 'Aanya',
    email: 'aanya@example.com',
    avatar: STARTER_PRESET_B, // sage sweater, wavy dark hair
    status: 'online',
    lastActive: new Date().toISOString(),
  });

  const [userB, setUserB] = useState<UserProfile | null>({
    id: 'user-rohan',
    name: 'Rohan',
    email: 'rohan@example.com',
    avatar: {
      ...STARTER_PRESET_A,
      topId: 'fair-isle-sweater',
      bottomId: 'dark-denim',
      glassesId: 'round-cocoa',
    },
    status: 'online',
    lastActive: new Date().toISOString(),
  });

  const [activeUserId, setActiveUserId] = useState<string>('user-aanya');

  const [space, setSpace] = useState<CoupleSpace>({
    id: 'space-our-little-place',
    name: 'Our Little Place',
    inviteCode: 'TB-8F2K-9X4M-7Q1W',
    inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    creatorId: 'user-aanya',
    partnerId: 'user-rohan',
    partnerPlaceholderName: 'Rohan',
    togetherSince: '2025-06-14',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
    createdAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  });

  // Daily Question Session matching the reference mockup:
  // "What would make today feel a little better?"
  // Options: A long call, A funny photo, A game together, Planning our next date
  // Rohan has answered ('opt-3' = A game together), Aanya is choosing
  const [dailySession, setDailySession] = useState<DailySession>(() => {
    const q1 = QUESTIONS_CATALOGUE[0];
    return {
      id: 'session-today',
      dateKey: new Date().toISOString().split('T')[0],
      question: q1,
      submittedUserIds: ['user-rohan'],
      revealed: false,
      answers: {
        'user-rohan': 'opt-3', // A game together
      },
    };
  });

  const [progression, setProgression] = useState<ProgressionStats>({
    currentStreak: 4,
    bestStreak: 7,
    lifetimeConnectedDays: 18,
    weekDots: [true, true, true, true, false, false, false],
  });

  const [activities, setActivities] = useState<ActivityItem[]>([
    {
      id: 'act-1',
      type: 'question_revealed',
      title: 'Question Answered Together',
      description: 'You both shared your ideal evening rewind.',
      timestamp: 'Yesterday',
    },
    {
      id: 'act-2',
      type: 'avatar_updated',
      title: 'Wardrobe Refresh',
      description: 'Rohan put on a cozy Nordic knit sweater and round glasses.',
      timestamp: '3 days ago',
    },
    {
      id: 'act-3',
      type: 'partner_joined',
      title: 'Joined the Space',
      description: 'Rohan joined Our Little Place using the invitation code.',
      timestamp: '14 days ago',
    },
  ]);

  const [activeTab, setActiveTab] = useState<'home' | 'questions' | 'us'>('home');
  const [isWardrobeOpen, setIsWardrobeOpen] = useState(false);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  // Load from local storage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.userA) setUserA(parsed.userA);
        if (parsed.userB !== undefined) setUserB(parsed.userB);
        if (parsed.space) setSpace(parsed.space);
        if (parsed.dailySession) setDailySession(parsed.dailySession);
        if (parsed.progression) setProgression(parsed.progression);
        if (parsed.activities) setActivities(parsed.activities);
      }
    } catch {
      // fallback to initial state
    }
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          userA,
          userB,
          space,
          dailySession,
          progression,
          activities,
        })
      );
    } catch {
      // ignore storage quotas
    }
  }, [userA, userB, space, dailySession, progression, activities]);

  // Presence heartbeat every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().toISOString();
      if (activeUserId === userA.id) {
        setUserA((prev) => ({ ...prev, lastActive: now, status: 'online' }));
      } else if (userB && activeUserId === userB.id) {
        setUserB((prev) => (prev ? { ...prev, lastActive: now, status: 'online' } : null));
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [activeUserId, userA.id, userB]);

  const currentUser = activeUserId === userA.id ? userA : userB || userA;
  const partnerUser = activeUserId === userA.id ? userB : userA;

  const switchActiveUser = (newId: string) => {
    setActiveUserId(newId);
  };

  const updateAvatar = (newAvatar: AvatarConfig) => {
    if (activeUserId === userA.id) {
      setUserA((prev) => ({ ...prev, avatar: newAvatar }));
    } else if (userB) {
      setUserB((prev) => (prev ? { ...prev, avatar: newAvatar } : null));
    }

    setActivities((prev) => [
      {
        id: 'act-' + Date.now(),
        type: 'avatar_updated',
        title: 'Look Updated',
        description: `${currentUser.name} tweaked their pixel avatar styling.`,
        timestamp: 'Just now',
      },
      ...prev,
    ]);
  };

  const submitAnswer = (optionId: string) => {
    const myId = currentUser.id;
    if (dailySession.submittedUserIds.includes(myId)) return; // already locked

    const updatedSubmitted = [...dailySession.submittedUserIds, myId];
    const updatedAnswers = { ...dailySession.answers, [myId]: optionId };

    // Reveal when both members have submitted (or if space has partner and partner submitted)
    const partnerId = partnerUser?.id;
    const isBothDone = partnerId ? updatedSubmitted.includes(partnerId) : true;

    setDailySession({
      ...dailySession,
      submittedUserIds: updatedSubmitted,
      answers: updatedAnswers,
      revealed: isBothDone,
      revealedAt: isBothDone ? new Date().toISOString() : undefined,
    });

    if (isBothDone) {
      // Increment progression & streak
      setProgression((prev) => {
        const nextStreak = prev.currentStreak + 1;
        const newDots = [...prev.weekDots];
        const nextIdx = newDots.findIndex((d) => !d);
        if (nextIdx !== -1) newDots[nextIdx] = true;
        return {
          currentStreak: nextStreak,
          bestStreak: Math.max(prev.bestStreak, nextStreak),
          lifetimeConnectedDays: prev.lifetimeConnectedDays + 1,
          weekDots: newDots,
        };
      });

      setActivities((prev) => [
        {
          id: 'act-' + Date.now(),
          type: 'question_revealed',
          title: 'Daily Question Revealed!',
          description: `Both answers opened for "${dailySession.question.prompt}"`,
          timestamp: 'Just now',
        },
        ...prev,
      ]);
    }
  };

  const updateSpaceDetails = (name: string, togetherSince?: string) => {
    if (!space) return;
    setSpace((prev) => ({
      ...prev,
      name,
      togetherSince: togetherSince || prev.togetherSince,
    }));
  };

  const regenerateInvite = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const randPart = () =>
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const newCode = `TB-${randPart()}-${randPart()}-${randPart()}`;

    setSpace((prev) => ({
      ...prev,
      inviteCode: newCode,
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    }));
  };

  const joinWithCode = (code: string, newUserName: string): boolean => {
    if (!space) return false;
    // Check code matches
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode !== space.inviteCode.toUpperCase()) {
      return false;
    }

    const partner: UserProfile = {
      id: 'user-partner-' + Date.now(),
      name: newUserName || 'Partner',
      avatar: STARTER_PRESET_A,
      status: 'online',
      lastActive: new Date().toISOString(),
    };

    setUserB(partner);
    setSpace((prev) => ({
      ...prev,
      partnerId: partner.id,
      partnerPlaceholderName: partner.name,
    }));

    setActivities((prev) => [
      {
        id: 'act-' + Date.now(),
        type: 'partner_joined',
        title: 'Partner Joined Space',
        description: `${partner.name} joined ${space.name}!`,
        timestamp: 'Just now',
      },
      ...prev,
    ]);

    return true;
  };

  const createSpace = (
    spaceName: string,
    myName: string,
    partnerName: string,
    togetherSince?: string
  ) => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const randPart = () =>
      Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const newCode = `TB-${randPart()}-${randPart()}-${randPart()}`;

    const newCreator: UserProfile = {
      id: 'user-' + Date.now(),
      name: myName || 'Aanya',
      avatar: STARTER_PRESET_B,
      status: 'online',
      lastActive: new Date().toISOString(),
    };

    setUserA(newCreator);
    setUserB(null); // Unpaired initially until partner redeems invite
    setActiveUserId(newCreator.id);

    const newSpace: CoupleSpace = {
      id: 'space-' + Date.now(),
      name: spaceName || 'Our Little Place',
      inviteCode: newCode,
      inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      creatorId: newCreator.id,
      partnerPlaceholderName: partnerName || 'My Person',
      togetherSince,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      createdAt: new Date().toISOString(),
    };

    setSpace(newSpace);

    // Reset daily session for new pair
    setDailySession({
      id: 'session-' + Date.now(),
      dateKey: new Date().toISOString().split('T')[0],
      question: QUESTIONS_CATALOGUE[0],
      submittedUserIds: [],
      revealed: false,
      answers: {},
    });

    setProgression({
      currentStreak: 0,
      bestStreak: 0,
      lifetimeConnectedDays: 0,
      weekDots: [false, false, false, false, false, false, false],
    });

    setActivities([
      {
        id: 'act-' + Date.now(),
        type: 'space_created',
        title: 'Space Created',
        description: `${newCreator.name} created ${newSpace.name}.`,
        timestamp: 'Just now',
      },
    ]);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        partnerUser,
        space,
        dailySession,
        progression,
        activities,
        activeTab,
        setActiveTab,
        isWardrobeOpen,
        setIsWardrobeOpen,
        isOnboardingOpen,
        setIsOnboardingOpen,
        updateAvatar,
        submitAnswer,
        switchActiveUser,
        updateSpaceDetails,
        regenerateInvite,
        joinWithCode,
        createSpace,
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
