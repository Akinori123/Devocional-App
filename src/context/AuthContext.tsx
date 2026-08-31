import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signOut,
} from 'firebase/auth';
import { doc, onSnapshot, updateDoc, arrayRemove, arrayUnion, increment, collection, getDocs, query, orderBy, limit, runTransaction, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { differenceInCalendarDays, parseISO, format } from 'date-fns';

export interface BibleLastRead {
  bookId: string;
  bookName: string;
  chapter: number;
  readAt?: string;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'credit' | 'debit';
  reason: string;
  missionType?: string;
  moduleId?: string;
  balanceAfter: number;
  date: string;
  createdAt: string;
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
  activeTheme?: string;
  bibleProgress?: Record<string, number[]>;
  lastReadReference?: BibleLastRead;
  subscriptionStatus?: 'free' | 'premium' | 'canceled' | 'expired' | 'active' | 'authorized';
  subscriptionType?: 'pix_prepaid' | 'credit_card_recurring' | 'admin_grant';
  subscriptionExpiresAt?: string;
  cancelAtPeriodEnd?: boolean;
  mpSubscriptionId?: string;
  lastProcessedPaymentId?: string;
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
  coins?: number;
  lastCoinDate?: string;
  claimedDailyMissions?: string[];
  unlockedSecretModules?: string[];
  unlocked_modules?: string[];
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  updateProfileState: (profile: UserProfile) => void;
  markBibleChapterCompleted: (bookId: string, bookName: string, chapter: number, isCompleted?: boolean) => Promise<boolean>;
  updateBibleLastRead: (bookId: string, bookName: string, chapter: number) => Promise<void>;
  awardDailyCoin: (missionType?: string, reason?: string) => Promise<{ awarded: boolean; newBalance: number; reason?: string }>;
  spendCoins: (amount: number, moduleId: string, reason?: string) => Promise<boolean>;
  getCoinHistory: () => Promise<CoinTransaction[]>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const profileRef = useRef<UserProfile | null>(null);
  const inFlightAwardsRef = useRef<Set<string>>(new Set());
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

            // Expiration check for PIX (30 days pass) and recurring subscriptions
            if (data.subscriptionExpiresAt && !data.isAdmin) {
              const expiresAtTime = new Date(data.subscriptionExpiresAt).getTime();
              const nowTime = Date.now();
              if (nowTime > expiresAtTime) {
                // Subscription has reached its end
                data.isPremium = false;
                if (data.subscriptionStatus !== 'expired') {
                  data.subscriptionStatus = 'expired';
                  // Sync with Firestore doc in background
                  updateDoc(docRef, {
                    isPremium: false,
                    subscriptionStatus: 'expired',
                    subscriptionUpdatedAt: new Date().toISOString()
                  }).catch(err => console.warn("Could not sync expired state to firestore:", err));
                }
              } else {
                // O usuário possui dias válidos contratados! Garante isPremium = true
                if (data.isPremium !== true) {
                  data.isPremium = true;
                  if (data.subscriptionStatus !== 'active' && data.subscriptionStatus !== 'authorized' && !data.cancelAtPeriodEnd) {
                    data.subscriptionStatus = 'active';
                  }
                  updateDoc(docRef, {
                    isPremium: true,
                    subscriptionStatus: data.cancelAtPeriodEnd ? 'cancelled' : 'active',
                    subscriptionUpdatedAt: new Date().toISOString()
                  }).catch(err => console.warn("Could not sync active state to firestore:", err));
                }
              }
            }

            // Normaliza lista de módulos desbloqueados
            const unlockedList = Array.from(new Set([
              ...(Array.isArray(data.unlocked_modules) ? data.unlocked_modules : []),
              ...(Array.isArray(data.unlockedSecretModules) ? data.unlockedSecretModules : []),
              ...(Array.isArray((data as any).unlockedModules) ? (data as any).unlockedModules : [])
            ]));
            data.unlocked_modules = unlockedList;
            data.unlockedSecretModules = unlockedList;

            // Garante 999.999 moedas para a conta admin principal e administradores
            const isMainAdmin = data.isAdmin === true || 
              firebaseUser.email === 'dofekrafael@gmail.com' || 
              firebaseUser.email === 'sjhonatan916@gmail.com' || 
              firebaseUser.email === 'floresceremadoracao@gmail.com';

            if (isMainAdmin && (typeof data.coins !== 'number' || data.coins < 999999)) {
              data.coins = 999999;
              updateDoc(docRef, {
                coins: 999999,
                updatedAt: new Date().toISOString()
              }).catch(err => console.warn("Could not sync admin coins to firestore:", err));
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

  const awardDailyCoin = useCallback(async (missionType?: string, reason?: string): Promise<{ awarded: boolean; newBalance: number; reason?: string }> => {
    if (!user) return { awarded: false, newBalance: 0 };
    
    const today = format(new Date(), 'yyyy-MM-dd');
    const currentProfile = profileRef.current;
    const currentCoins = currentProfile?.coins || 0;
    const missionKey = missionType || 'devotional_reading';
    const claimKey = `${missionKey}_${today}`;

    // 1. Trava instantânea em memória contra duplo clique / concorrência no cliente
    if (inFlightAwardsRef.current.has(claimKey)) {
      return { awarded: false, newBalance: currentCoins, reason: 'already_awarded_today' };
    }

    // 2. Trava em LocalStorage e no perfil local
    let isClaimedInStorage = false;
    try {
      isClaimedInStorage = localStorage.getItem(`claimed_mission_${missionKey}_${user.uid}_${today}`) === 'true';
    } catch (e) {}

    const isClaimedInProfile = currentProfile?.claimedDailyMissions?.includes(claimKey);
    if (isClaimedInProfile || isClaimedInStorage) {
      return { awarded: false, newBalance: currentCoins, reason: 'already_awarded_today' };
    }

    // Registra na trava em memória e localStorage imediatamente
    inFlightAwardsRef.current.add(claimKey);
    try {
      localStorage.setItem(`claimed_mission_${missionKey}_${user.uid}_${today}`, 'true');
    } catch (e) {}

    const readableReason = reason || (
      missionType === 'session_15min' ? 'Missão 15 min concluída' :
      missionType === 'devotional_reading' ? 'Leitura devocional concluída' :
      'Missão Diária Concluída'
    );

    try {
      const userRef = doc(db, 'users', user.uid);
      const historyRef = doc(collection(db, 'users', user.uid, 'coin_history'));

      const result = await runTransaction(db, async (transaction) => {
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) {
          throw new Error("User document does not exist");
        }

        const userData = userSnap.data() as UserProfile;
        const claimedList = userData.claimedDailyMissions || [];

        // Verificação transacional atômica no Firestore: se já tem o claimKey gravado, aborta
        if (claimedList.includes(claimKey)) {
          return { awarded: false, newBalance: userData.coins || 0, reason: 'already_awarded_today' };
        }

        const finalCoins = (userData.coins || 0) + 1;
        const newClaimedList = [...claimedList, claimKey];

        transaction.update(userRef, {
          coins: finalCoins,
          lastCoinDate: today,
          claimedDailyMissions: newClaimedList
        });

        transaction.set(historyRef, {
          id: historyRef.id,
          userId: user.uid,
          amount: 1,
          type: 'credit',
          missionType: missionKey,
          reason: readableReason,
          date: today,
          balanceAfter: finalCoins,
          createdAt: serverTimestamp()
        });

        return { awarded: true, newBalance: finalCoins, reason: readableReason };
      });

      if (result.awarded) {
        setProfile(prev => prev ? {
          ...prev,
          coins: result.newBalance,
          lastCoinDate: today,
          claimedDailyMissions: [...(prev.claimedDailyMissions || []), claimKey]
        } : prev);
        console.log(`[Gamification] Awarded 1 coin atomically for '${missionKey}'. New balance: ${result.newBalance}`);
      } else {
        console.warn(`[Gamification] Mission '${missionKey}' was already awarded today.`);
      }

      return result;
    } catch (error) {
      console.error("Error executing atomic coin award transaction:", error);
      inFlightAwardsRef.current.delete(claimKey);
      try {
        localStorage.removeItem(`claimed_mission_${missionKey}_${user.uid}_${today}`);
      } catch (e) {}
      return { awarded: false, newBalance: profileRef.current?.coins || 0 };
    }
  }, [user?.uid]);

  const spendCoins = useCallback(async (amount: number, moduleId: string, reason?: string): Promise<boolean> => {
    if (!user) return false;
    try {
      const currentProfile = profileRef.current;
      const currentCoins = currentProfile?.coins || 0;
      
      if (currentCoins < amount) {
        return false;
      }

      const numAmount = Math.abs(amount) || 30;
      const today = format(new Date(), 'yyyy-MM-dd');
      const readableReason = reason || `Módulo Secreto Desbloqueado (${moduleId})`;

      // 1. Tenta executar via Backend seguro (Atomic decrement + ledger)
      try {
        const res = await fetch('/api/coins/spend', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: user.uid,
            amount: numAmount,
            moduleId,
            reason: readableReason
          })
        });

        if (res.ok) {
          const data = await res.json();
          setProfile(prev => prev ? {
            ...prev,
            coins: data.coins,
            unlockedSecretModules: data.unlockedSecretModules
          } : prev);
          return true;
        }
      } catch (apiErr) {
        console.warn("[Gamification] Backend spend API unavailable, applying client atomic fallback:", apiErr);
      }

      // 2. Fallback Seguro no Cliente
      const newBalance = currentCoins - numAmount;
      const currentUnlocked = profileRef.current?.unlocked_modules || profileRef.current?.unlockedSecretModules || [];
      const newUnlocked = Array.from(new Set([...currentUnlocked, moduleId]));

      setProfile(prev => prev ? {
        ...prev,
        coins: newBalance,
        unlocked_modules: newUnlocked,
        unlockedSecretModules: newUnlocked
      } : prev);

      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        coins: increment(-numAmount),
        unlocked_modules: arrayUnion(moduleId),
        unlockedSecretModules: arrayUnion(moduleId)
      });

      // Grava no Extrato do cliente
      try {
        const historyRef = doc(collection(db, 'users', user.uid, 'coin_history'));
        const { serverTimestamp: clientServerTimestamp, setDoc: clientSetDoc } = await import('firebase/firestore');
        await clientSetDoc(historyRef, {
          id: historyRef.id,
          userId: user.uid,
          amount: -numAmount,
          type: 'debit',
          moduleId,
          reason: readableReason,
          date: today,
          balanceAfter: newBalance,
          createdAt: clientServerTimestamp()
        });
      } catch (ledgerErr) {
        console.warn("[Gamification] Ledger spend fallback error:", ledgerErr);
      }

      console.log(`[Gamification] Spent ${amount} coins to unlock module '${moduleId}'. New balance: ${newBalance}`);
      return true;
    } catch (error) {
      console.error("Error spending coins:", error);
      return false;
    }
  }, [user?.uid]);

  const getCoinHistory = useCallback(async (): Promise<CoinTransaction[]> => {
    if (!user) return [];
    try {
      // 1. Try Backend API
      try {
        const res = await fetch(`/api/coins/history/${user.uid}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.history)) {
            return data.history;
          }
        }
      } catch (apiErr) {
        console.warn("[Gamification] Backend history API error, fallback to Firestore client query:", apiErr);
      }

      // 2. Fallback: query client Firestore
      const q = query(
        collection(db, 'users', user.uid, 'coin_history'),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId || user.uid,
          amount: data.amount,
          type: data.type,
          reason: data.reason,
          missionType: data.missionType,
          moduleId: data.moduleId,
          balanceAfter: data.balanceAfter,
          date: data.date,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : (data.createdAt || new Date().toISOString())
        };
      }) as CoinTransaction[];
    } catch (err) {
      console.error("Error fetching coin history:", err);
      return [];
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
      updateBibleLastRead,
      awardDailyCoin,
      spendCoins,
      getCoinHistory
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
