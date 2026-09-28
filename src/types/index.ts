export interface AvatarConfig {
  rendererVersion: 2;
  height: 'short' | 'medium' | 'tall';
  skin: string;
  hairStyle: string;
  hairColor: string;
  facialHair: string;
  top: string;
  topColor: string;
  bottom: string;
  bottomColor: string;
  shoes: string;
  shoesColor: string;
  glasses: string;
  hat: string;
  extra: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  avatar: AvatarConfig;
  status: 'online' | 'away' | 'offline';
  lastActive: string;
}

export interface CoupleSpace {
  id: string;
  name: string;
  inviteCode: string;
  inviteExpiresAt: string;
  creatorId: string;
  partnerId?: string;
  partnerPlaceholderName: string;
  togetherSince?: string; // YYYY-MM-DD
  timezone: string;
  createdAt: string;
}

export interface ActivityItem {
  id: string;
  type: 'question_revealed' | 'partner_joined' | 'space_created' | 'avatar_updated' | 'watched_together';
  title: string;
  description: string;
  timestamp: string;
}
