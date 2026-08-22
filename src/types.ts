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
  subscriptionStatus: 'free' | 'premium' | 'canceled';
  cancelAtPeriodEnd?: boolean;
  mpSubscriptionId?: string;
  createdAt: number;
  isAdmin?: boolean;
  isBanned?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  bibleProgress?: Record<string, number[]>;
  lastReadReference?: BibleLastRead;
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
