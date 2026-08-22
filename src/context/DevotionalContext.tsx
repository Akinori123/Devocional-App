import { createContext, useContext, useState, ReactNode, useEffect, useCallback, useMemo } from 'react';
import { DevotionalItem, mockDevotionals } from '../data/devotionals';
import { useAuth } from './AuthContext';
import { collection, onSnapshot, doc, setDoc, updateDoc, getDoc, query, orderBy, serverTimestamp, deleteDoc, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';

interface DevotionalContextData {
  readHistory: string[];
  themeLastRead: Record<string, string>;
  markAsRead: (id: string, theme?: string) => Promise<void>;
  customDevotionals: DevotionalItem[];
  addCustomDevotional: (item: DevotionalItem) => Promise<void>;
  allDevotionals: DevotionalItem[];
  activeDevotional: DevotionalItem | null;
  setActiveDevotional: (item: DevotionalItem | null) => void;
  deleteCustomDevotional: (id: string) => Promise<void>;
  globalDevotionals: DevotionalItem[];
  deleteGlobalDevotional: (id: string) => Promise<void>;
  updateGlobalDevotional: (id: string, item: Partial<DevotionalItem>) => Promise<void>;
  loadMoreGlobalDevotionals: () => void;
  hasMoreGlobal: boolean;
}

const DevotionalContext = createContext<DevotionalContextData>({} as DevotionalContextData);

export function DevotionalProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const [readHistory, setReadHistory] = useState<string[]>([]);
  const [themeLastRead, setThemeLastRead] = useState<Record<string, string>>({});
  const [customDevotionals, setCustomDevotionals] = useState<DevotionalItem[]>([]);
  const [globalDevotionals, setGlobalDevotionals] = useState<DevotionalItem[]>([]);
  const [activeDevotional, setActiveDevotional] = useState<DevotionalItem | null>(null);
  const [globalLimit, setGlobalLimit] = useState(20);
  const [hasMoreGlobal, setHasMoreGlobal] = useState(true);

  const themeLastReadSerialized = profile?.themeLastRead ? JSON.stringify(profile.themeLastRead) : '';
  const readHistorySerialized = profile?.readHistory ? JSON.stringify(profile.readHistory) : '';

  useEffect(() => {
    if (profile?.themeLastRead) {
      setThemeLastRead(profile.themeLastRead);
    }
    if (profile?.readHistory) {
      setReadHistory(profile.readHistory);
    } else if (user) {
      // Fallback for existing users
      const storedHistory = localStorage.getItem(`readHistory_${user.uid}`);
      if (storedHistory) {
        setReadHistory(JSON.parse(storedHistory));
      }
    }
  }, [themeLastReadSerialized, readHistorySerialized, user?.uid]);

  useEffect(() => {
    if (!user) {
      setCustomDevotionals([]);
      setReadHistory([]);
      return;
    }

    // Listener for custom devotionals (user's own)
    const devRef = collection(db, 'users', user.uid, 'devotionals');
    const q = query(devRef, orderBy('createdAt', 'desc'));
    
    const unsubDev = onSnapshot(q, (snapshot) => {
      const devs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as DevotionalItem[];
      setCustomDevotionals(devs);
    }, (error) => {
      console.error("Error fetching custom devotionals:", error);
    });

    // Listener for global devotionals (from admin)
    const globalDevRef = collection(db, 'devotionals');
    const globalQ = query(globalDevRef, orderBy('createdAt', 'desc'), limit(globalLimit));
    
    const unsubGlobalDev = onSnapshot(globalQ, (snapshot) => {
      const devs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as DevotionalItem[];
      setGlobalDevotionals(devs);
      
      // If we got exactly the limit we requested, there MIGHT be more.
      // If we got fewer, there are definitely no more.
      if (snapshot.docs.length < globalLimit) {
        setHasMoreGlobal(false);
      } else {
        setHasMoreGlobal(true);
      }
    }, (error) => {
      console.error("Error fetching global devotionals:", error);
    });

    // Read history is now synced from Firestore in the effect above.
    // Keeping this comment block for reference.
    
    return () => {
      unsubDev();
      unsubGlobalDev();
    };
  }, [user, globalLimit]);

  const loadMoreGlobalDevotionals = useCallback(() => {
    setGlobalLimit(prev => prev + 20);
  }, []);

  const markAsRead = useCallback(async (id: string, theme?: string) => {
    let finalHistory: string[] = [];
    setReadHistory(prev => {
      let newHistory;
      if (prev.includes(id)) {
        newHistory = [...prev.filter(i => i !== id), id];
      } else {
        newHistory = [...prev, id];
      }
      finalHistory = newHistory;
      if (user) {
        localStorage.setItem(`readHistory_${user.uid}`, JSON.stringify(newHistory));
      }
      return newHistory;
    });

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          const data = userSnap.data();
          const now = new Date();
          const today = format(now, 'yyyy-MM-dd');

          const updates: any = {};
          
          if (finalHistory.length > 0) {
            updates.readHistory = finalHistory;
          }
          
          if (theme) {
            const currentThemeDates = data.themeLastRead || {};
            updates.themeLastRead = {
              ...currentThemeDates,
              [theme]: today
            };
            // Also update local state so UI reacts immediately
            setThemeLastRead(updates.themeLastRead);
          }

          // Streak Time-Lock Logic: Only increment streak if today is a NEW day
          const lastReadDate = data.lastReadDate;
          const currentStreak = data.streakCount || 0;

          if (lastReadDate !== today) {
            let newStreakCount = currentStreak;
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
            updates.lastReadDate = today;
            updates.streakCount = newStreakCount;
          }

          if (Object.keys(updates).length > 0) {
            await updateDoc(userRef, updates);
          }
        }
      } catch (error) {
        console.error("Error updating theme read status:", error);
      }
    }
  }, [user]);

  const addCustomDevotional = useCallback(async (item: DevotionalItem) => {
    if (!user) return;
    try {
      const devRef = doc(collection(db, 'users', user.uid, 'devotionals'));
      await setDoc(devRef, {
        ...item,
        id: devRef.id,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error saving devotional:", error);
      throw error;
    }
  }, [user]);

  const deleteCustomDevotional = useCallback(async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'devotionals', id));
    } catch (error) {
      console.error("Error deleting devotional:", error);
      throw error;
    }
  }, [user]);

  const deleteGlobalDevotional = useCallback(async (id: string) => {
    try {
      const isMock = mockDevotionals.some(m => m.id === id);
      if (isMock) {
        await setDoc(doc(db, 'devotionals', id), { deleted: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      } else {
        await deleteDoc(doc(db, 'devotionals', id));
      }
    } catch (error) {
      console.error("Error deleting global devotional:", error);
      throw error;
    }
  }, []);

  const updateGlobalDevotional = useCallback(async (id: string, item: Partial<DevotionalItem>) => {
    try {
      const docRef = doc(db, 'devotionals', id);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        await setDoc(docRef, { ...item, id, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      } else {
        const data = docSnap.data();
        await updateDoc(docRef, { 
          ...item, 
          updatedAt: serverTimestamp(),
          ...(data.createdAt ? {} : { createdAt: serverTimestamp() })
        });
      }
    } catch (error) {
      console.error("Error updating global devotional:", error);
      throw error;
    }
  }, []);

  const allDevotionals = useMemo(() => [
    ...globalDevotionals.filter((g: any) => !g.deleted), 
    ...mockDevotionals.filter(m => !globalDevotionals.some(g => g.id === m.id)), 
    ...customDevotionals
  ], [globalDevotionals, customDevotionals]);

  const value = useMemo(() => ({
    readHistory,
    themeLastRead,
    markAsRead,
    customDevotionals,
    addCustomDevotional,
    deleteCustomDevotional,
    allDevotionals,
    activeDevotional,
    setActiveDevotional,
    globalDevotionals,
    deleteGlobalDevotional,
    updateGlobalDevotional,
    loadMoreGlobalDevotionals,
    hasMoreGlobal
  }), [
    readHistory,
    themeLastRead,
    markAsRead,
    customDevotionals,
    addCustomDevotional,
    deleteCustomDevotional,
    allDevotionals,
    activeDevotional,
    setActiveDevotional,
    globalDevotionals,
    deleteGlobalDevotional,
    updateGlobalDevotional,
    loadMoreGlobalDevotionals,
    hasMoreGlobal
  ]);

  return (
    <DevotionalContext.Provider value={value}>
      {children}
    </DevotionalContext.Provider>
  );
}

export const useDevotionals = () => useContext(DevotionalContext);
