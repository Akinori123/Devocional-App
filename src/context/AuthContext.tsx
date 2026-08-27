import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut,
} from 'firebase/auth';
import { doc, onSnapshot, updateDoc, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';

export interface BibleLastRead {
  bookId: string;
  bookName: string;
  chapter: number;
  readAt?: string;
}

export interface UserProfile {
  email?: string | null;
  uid?: string;
  name: string;
  faithJourney: string;
  needArea: string;
  streakCount?: number;
  lastReadDate?: string;
  themeLastRead?: Record<string, string>;
  readHistory?: string[];
  bibleProgress?: Record<string, number[]>;
  lastReadReference?: BibleLastRead;
  subscriptionStatus?: 'free' | 'premium' | 'canceled';
  cancelAtPeriodEnd?: boolean;
  mpSubscriptionId?: string;
  isPremium?: boolean;
  subscriptionDate?: string | null;
  photoURL?: string;
  hasSeenTour?: boolean;
  aiGenerationsCount?: number;
  lastGenerationDate?: string;
  hasUsedFreeImage?: boolean;
  dailyImageCount?: number;
  lastImageDate?: string;
  isAdmin?: boolean;
  isBanned?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateProfileState: (profile: UserProfile) => void;
  markBibleChapterCompleted: (bookId: string, bookName: string, chapter: number, isCompleted?: boolean) => Promise<boolean>;
  updateBibleLastRead: (bookId: string, bookName: string, chapter: number) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileRef = useRef<UserProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        unsubProfile = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            if (data.isBanned) {
              signOut(auth);
              alert("Sua conta foi suspensa pelo Administrador.");
              setProfile(null);
              setUser(null);
              return;
            }
            if (data.lastReadDate) {
              const now = new Date();
              const lastRead = parseISO(data.lastReadDate + 'T00:00:00');
              const daysDiff = differenceInCalendarDays(now, lastRead);
              if (daysDiff > 1) {
                data.streakCount = 0;
              }
            }
            setProfile(data);
          }
        }, (error) => {
          console.error("Error fetching user profile:", error);
        });
      } else {
        setProfile(null);
        if (unsubProfile) {
          unsubProfile();
          unsubProfile = null;
        }
      }
      
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubProfile) {
        unsubProfile();
      }
    };
  }, []);

  // Monitora se o usuário ficou 5 minutos com o app aberto para contabilizar o dia
  useEffect(() => {
    if (!user || !profile) return;
    
    const now = new Date();
    const today = format(now, 'yyyy-MM-dd');
    const lastReadDate = profile.lastReadDate;
    
    if (lastReadDate !== today) {
      const timer = setTimeout(async () => {
        try {
          const userRef = doc(db, 'users', user.uid);
          let newStreakCount = profile.streakCount || 0;
          
          if (!lastReadDate) {
            newStreakCount = 1;
          } else {
            const lastRead = parseISO(lastReadDate + 'T00:00:00');
            const daysDiff = differenceInCalendarDays(now, lastRead);
            if (daysDiff === 1) {
              newStreakCount += 1;
            } else if (daysDiff > 1) {
              newStreakCount = 1;
            }
          }
          
          await updateDoc(userRef, {
            lastReadDate: today,
            streakCount: newStreakCount
          });
          
          console.log("Streak updated after 5 minutes of usage!");
        } catch (error) {
          console.error("Error updating streak automatically:", error);
        }
      }, 5 * 60 * 1000); // 5 minutes (300,000 ms)
      
      return () => clearTimeout(timer);
    }
  }, [user?.uid, profile?.lastReadDate, profile?.streakCount]);

  const logout = useCallback(async () => {
    try {
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        const storedToken = localStorage.getItem('activeFcmToken');
        if (storedToken) {
          const uRef = doc(db, 'users', uid);
          await updateDoc(uRef, {
            fcmTokens: arrayRemove(storedToken)
          }).catch(() => {});
        }
      }
    } catch (e) {
      console.warn("Could not unbind push token on logout:", e);
    } finally {
      localStorage.removeItem('activeFcmUserId');
      await signOut(auth);
    }
  }, []);

  const updateProfileState = useCallback((newProfile: UserProfile) => {
    setProfile(newProfile);
  }, []);

  const updateBibleLastRead = useCallback(async (bookId: string, bookName: string, chapter: number) => {
    if (!user) return;
    try {
      const lastReadRef: BibleLastRead = {
        bookId,
        bookName,
        chapter,
        readAt: new Date().toISOString()
      };

      // Optimistic update
      setProfile(prev => prev ? { ...prev, lastReadReference: lastReadRef } : prev);

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        lastReadReference: lastReadRef
      });
    } catch (error) {
      console.error("Error updating bible last read:", error);
    }
  }, [user?.uid]);

  const markBibleChapterCompleted = useCallback(async (
    bookId: string, 
    bookName: string, 
    chapter: number, 
    isCompleted?: boolean
  ): Promise<boolean> => {
    if (!user) return false;
    try {
      const currentProgress = { ...(profileRef.current?.bibleProgress || {}) };
      const currentBookChapters = new Set<number>(currentProgress[bookId] || []);
      
      const willBeCompleted = isCompleted !== undefined ? isCompleted : !currentBookChapters.has(chapter);

      if (willBeCompleted) {
        currentBookChapters.add(chapter);
      } else {
        currentBookChapters.delete(chapter);
      }

      currentProgress[bookId] = Array.from(currentBookChapters).sort((a, b) => a - b);

      const lastReadRef: BibleLastRead = {
        bookId,
        bookName,
        chapter,
        readAt: new Date().toISOString()
      };

      // Optimistic update
      setProfile(prev => prev ? { 
        ...prev, 
        bibleProgress: currentProgress,
        lastReadReference: lastReadRef
      } : prev);

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        bibleProgress: currentProgress,
        lastReadReference: lastReadRef
      });

      return willBeCompleted;
    } catch (error) {
      console.error("Error marking bible chapter completed:", error);
      throw error;
    }
  }, [user?.uid]);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading, 
      logout, 
      updateProfileState,
      markBibleChapterCompleted,
      updateBibleLastRead
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
