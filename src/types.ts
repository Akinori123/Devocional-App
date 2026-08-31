export type TabType = 'home' | 'bible' | 'journey' | 'profile' | 'videoHistory' | 'usersAdmin';

export interface BibleLastRead {
  bookId: string;
  bookName: string;
  chapter: number;
  readAt?: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  subscriptionStatus: 'free' | 'premium' | 'canceled' | 'expired' | 'active' | 'authorized';
  subscriptionType?: 'pix_prepaid' | 'credit_card_recurring' | 'admin_grant';
  subscriptionExpiresAt?: string;
  cancelAtPeriodEnd?: boolean;
  mpSubscriptionId?: string;
  lastProcessedPaymentId?: string;
  createdAt: number;
  isAdmin?: boolean;
  isBanned?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  bibleProgress?: Record<string, number[]>;
  lastReadReference?: BibleLastRead;
  coins?: number;
  lastCoinDate?: string;
  claimedDailyMissions?: string[];
  unlockedSecretModules?: string[];
  unlocked_modules?: string[];
}

export interface VideoItem {
  id: string;
  videoId: string;
  verseText: string;
  verseRef: string;
  isExclusive?: boolean;
  isPremium?: boolean;
  createdAt: string;
}

export interface Devotional {
  devotionalId: string;
  title: string;
  description: string;
  totalDays: number;
  coverImageUrl: string;
  isPremium: boolean;
  visibility?: 'free' | 'vip' | 'secret';
  coinCost?: number;
}

export interface UserProgress {
  progressId: string;
  userId: string;
  devotionalId: string;
  currentDay: number;
  completedDays: number[];
  lastReadAt: number;
}

export interface Note {
  noteId: string;
  userId: string;
  verseReference: string;
  content: string;
  createdAt: number;
}

export type HighlightColor = 'yellow' | 'orange' | 'red' | 'pink' | 'purple' | 'blue' | 'teal' | 'green';

export interface BibleHighlight {
  id: string;
  book: string;
  bookName?: string;
  chapter: number;
  verse: number;
  color: HighlightColor;
  text?: string;
  updatedAt?: any;
  createdAt?: any;
}

