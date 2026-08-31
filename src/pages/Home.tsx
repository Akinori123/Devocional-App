import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BookOpen, PlayCircle, Bookmark, Flame, AlertCircle, Video, ChevronRight, ChevronLeft, Sun, Moon, Sunrise, Music, History, Flower2, Crown, Lock, X, Sprout, Trees, Sparkles, CheckCircle2, RotateCcw, Target, Coins } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDevotionals } from '../context/DevotionalContext';
import { sendEmailVerification } from 'firebase/auth';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TabType } from '../types';
import { getDailyContent } from '../data/dailyContent';
import { parseVerseReference } from '../utils/bibleParser';
import { differenceInCalendarDays } from 'date-fns';
import { useToast } from '../context/ToastContext';
import { getJourneyStatus } from '../utils/journey';
import { getThemeStyle } from '../utils/themeStyle';

import { DevotionalItem } from '../data/devotionals';
import { YouTubeFacade } from '../components/video/YouTubeFacade';
import { MissionsModal } from '../components/gamification/MissionsModal';
import { CoinIcon } from '../components/common/CoinIcon';

interface CarouselDevotionalItem extends DevotionalItem {
  dayNumber: number;
  isCompleted: boolean;
  isAllCompleted?: boolean;
}

interface HomeProps {
  onChangeTab?: (tab: TabType, subTab?: 'diary' | 'verses' | 'subscription' | 'settings' | 'admin') => void;
  onNavigateToBible?: (selection: { bookId: string; chapter: number; verse: number }) => void;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const GreetingIcon = () => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return <Sunrise className="w-5 h-5 text-orange-400" />;
  if (hour >= 12 && hour < 18) return <Sun className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
  return <Moon className="w-5 h-5 text-indigo-900 dark:text-white fill-indigo-900 dark:fill-white transition-colors" />;
};

export function Home({ onChangeTab, onNavigateToBible }: HomeProps) {
  const toast = useToast();
  const { user, profile } = useAuth();
  const { adminDevotionals, allDevotionals, readHistory, setActiveDevotional } = useDevotionals();
  const [resending, setResending] = useState(false);
  const [dailyData, setDailyData] = useState<{ videoId: string; verse: { text: string; reference: string }; isExclusive?: boolean; isPremium?: boolean }>(() => getDailyContent());
  const [isDailyLoading, setIsDailyLoading] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showMissionsModal, setShowMissionsModal] = useState(false);
  
  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';
  const hasAccess = profile?.isPremium || isAdmin;
  
  // Carousel Drag to Scroll
  const carouselRef = useRef<HTMLDivElement>(null);
  const isPointerDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!carouselRef.current) return;
    if (e.pointerType !== 'mouse') return; // Do not intercept touch interactions on mobile/touch screens
    isPointerDownRef.current = true;
    isDraggingRef.current = false;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = carouselRef.current.scrollLeft;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || !carouselRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    if (Math.abs(deltaX) > 3) {
      isDraggingRef.current = true;
      carouselRef.current.scrollLeft = startScrollLeftRef.current - deltaX;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPointerDownRef.current) {
      isPointerDownRef.current = false;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    }
  };
  
  const scrollCarousel = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const userName = profile?.name ? profile.name.split(' ')[0] : 'Irmã(o)';
  
  const getJourneyContent = () => {
    const days = profile?.streakCount || 0;
    return getJourneyStatus(days);
  };

  useEffect(() => {
    const fetchAdminContent = async () => {
      try {
        // Reset local daily content first to ensure the day changes correctly
        const localDaily = getDailyContent();
        
        // Fetch verse from settings/daily_content
        const docRef = doc(db, 'settings', 'daily_content');
        const docSnap = await getDoc(docRef);
        
        let fetchedData: any = {};
        let isAdminContentValidForToday = false;
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.updatedAt) {
            let updatedDate;
            if (typeof data.updatedAt?.toDate === 'function') {
              updatedDate = data.updatedAt.toDate();
            } else {
              updatedDate = new Date(data.updatedAt);
            }
            
            const today = new Date();
            if (
              updatedDate.getFullYear() === today.getFullYear() &&
              updatedDate.getMonth() === today.getMonth() &&
              updatedDate.getDate() === today.getDate()
            ) {
              isAdminContentValidForToday = true;
            }
          }
          fetchedData = data;
        }

        setDailyData({
          videoId: isAdminContentValidForToday && fetchedData.videoId ? fetchedData.videoId : localDaily.videoId,
          isExclusive: isAdminContentValidForToday ? (fetchedData.isExclusive || fetchedData.isPremium || false) : false,
          isPremium: isAdminContentValidForToday ? (fetchedData.isExclusive || fetchedData.isPremium || false) : false,
          verse: {
            text: isAdminContentValidForToday && fetchedData.verseText ? fetchedData.verseText : localDaily.verse.text,
            reference: isAdminContentValidForToday && fetchedData.verseRef ? fetchedData.verseRef : localDaily.verse.reference
          }
        });
      } catch (err) {
        console.error("Error fetching admin content", err);
      } finally {
        setIsDailyLoading(false);
      }
    };

    fetchAdminContent();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAdminContent();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);


  // Helper to sort devotionals within a theme sequentially
  const sortThemeDevotionals = (theme: string) => {
    return adminDevotionals
      .filter(d => d.theme === theme)
      .sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
          if (timeA !== timeB) return timeA - timeB;
        }
        const numA = parseInt(a.id.replace(/\D/g, ''));
        const numB = parseInt(b.id.replace(/\D/g, ''));
        if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
          return numA - numB;
        }
        return a.id.localeCompare(b.id);
      });
  };

  // Determine active theme based on user profile and read history
  const activeTheme = useMemo(() => {
    if (profile?.activeTheme && adminDevotionals.some(d => d.theme === profile.activeTheme)) {
      return profile.activeTheme;
    }
    if (profile?.themeLastRead && Object.keys(profile.themeLastRead).length > 0) {
      const sortedThemes = Object.entries(profile.themeLastRead)
        .sort((a, b) => b[1].localeCompare(a[1]))
        .map(entry => entry[0]);
      if (sortedThemes.length > 0 && adminDevotionals.some(d => d.theme === sortedThemes[0])) {
        return sortedThemes[0];
      }
    }
    if (readHistory && readHistory.length > 0) {
      for (let i = readHistory.length - 1; i >= 0; i--) {
        const dev = adminDevotionals.find(d => d.id === readHistory[i]);
        if (dev?.theme) return dev.theme;
      }
    }
    return null;
  }, [profile?.activeTheme, profile?.themeLastRead, readHistory, adminDevotionals]);

  // Compute individual progress and carousel items
  const { hasActiveJourney, carouselItems, activeThemeName } = useMemo(() => {
    const hasStartedAny = readHistory.length > 0 || Boolean(profile?.activeTheme);

    if (!activeTheme || !hasStartedAny) {
      return {
        hasActiveJourney: false,
        carouselItems: [] as CarouselDevotionalItem[],
        activeThemeName: ''
      };
    }

    const themeDevs = sortThemeDevotionals(activeTheme);
    if (themeDevs.length === 0) {
      return {
        hasActiveJourney: false,
        carouselItems: [] as CarouselDevotionalItem[],
        activeThemeName: ''
      };
    }

    // Number each devotional sequentially in this journey
    const themeDevsWithDay = themeDevs.map((d, index) => ({
      ...d,
      dayNumber: index + 1,
      isCompleted: readHistory.includes(d.id)
    }));

    const unread = themeDevsWithDay.filter(d => !d.isCompleted);
    const completed = themeDevsWithDay.filter(d => d.isCompleted);

    let currentItem: (typeof themeDevsWithDay[0] & { isAllCompleted?: boolean }) | null = null;
    if (unread.length > 0) {
      // The current day the user is on (first unread in sequence)
      currentItem = { ...unread[0], isAllCompleted: false };
    } else if (completed.length > 0) {
      // All days in this theme are completed
      currentItem = { ...completed[completed.length - 1], isAllCompleted: true };
    }

    // Past completed days in this journey (in reverse order: e.g. Day 2, Day 1)
    const pastInTheme: CarouselDevotionalItem[] = completed
      .filter(d => d.id !== currentItem?.id)
      .map(d => ({ ...d, isAllCompleted: false }))
      .reverse();

    // Additional completed devotionals from other themes
    const otherCompleted: CarouselDevotionalItem[] = allDevotionals
      .filter(d => d.theme !== activeTheme && readHistory.includes(d.id))
      .map(d => {
        const siblings = sortThemeDevotionals(d.theme);
        const idx = siblings.findIndex(s => s.id === d.id);
        return {
          ...d,
          dayNumber: idx !== -1 ? idx + 1 : 1,
          isCompleted: true,
          isAllCompleted: false
        };
      })
      .reverse();

    const items: CarouselDevotionalItem[] = currentItem ? [currentItem, ...pastInTheme, ...otherCompleted] : [];

    return {
      hasActiveJourney: items.length > 0,
      carouselItems: items,
      activeThemeName: activeTheme
    };
  }, [activeTheme, allDevotionals, readHistory, profile?.activeTheme]);

  const handleResendEmail = async () => {
    if (!user) return;
    try {
      setResending(true);
      await sendEmailVerification(user);
      toast.success("Sua conta está quase pronta! Verifique seu e-mail (e a caixa de spam) para confirmar seu acesso.");
    } catch (error: any) {
      toast.success("Parece que você está sem internet. Tente novamente em instantes. 📡");
    } finally {
      setResending(false);
    }
  };

  const hasVideo = Boolean(
    dailyData.videoId && 
    typeof dailyData.videoId === 'string' && 
    dailyData.videoId.trim() !== '' &&
    dailyData.videoId !== 'undefined' &&
    dailyData.videoId !== 'null'
  );

  return (
    <div className="flex-1 overflow-y-auto pb-24 bg-gray-50 dark:bg-slate-900 min-h-screen transition-colors duration-200">
      
      {/* Header Container */}
      <div className="bg-yellow-400 dark:bg-slate-900 text-yellow-950 dark:text-white rounded-b-3xl shadow-sm transition-colors duration-200 border-b border-yellow-500/20 dark:border-slate-800 overflow-hidden">
        {/* Top Bar with Logo & Avatar */}
        <div className="bg-yellow-400 dark:bg-slate-800 px-6 pt-5 pb-2.5 flex justify-between items-center transition-colors duration-200 border-b border-yellow-950/20 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/40 dark:bg-slate-700/80 p-1 rounded-2xl backdrop-blur-md shadow-sm overflow-hidden flex items-center justify-center w-11 h-11 shrink-0 border border-white/40 dark:border-slate-600">
              <img src="/images/rosa.png" alt="Florescer" className="w-full h-full object-cover" />
            </div>
            <span className="font-serif font-bold text-yellow-950 dark:text-yellow-400 text-xl tracking-tight">Florescer</span>
          </div>
          
          <div className="flex items-center gap-2.5">
            {/* Saldo de Moedas no Cabeçalho */}
            <button
              onClick={() => setShowMissionsModal(true)}
              className="bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-xs hover:scale-105 transition-all cursor-pointer shrink-0"
              title="Ver Missões Diárias e Saldo de Moedas"
            >
              <CoinIcon className="w-4 h-4" />
              <span>{profile?.coins || 0}</span>
            </button>

            <button 
              onClick={() => onChangeTab?.('profile')} 
              className="w-11 h-11 rounded-full border-2 border-white/60 dark:border-slate-600 overflow-hidden shadow-sm flex items-center justify-center bg-yellow-100 dark:bg-slate-700 hover:scale-105 transition-transform shrink-0"
            >
              {profile?.photoURL || user?.photoURL ? (
                <img src={profile?.photoURL || user?.photoURL || ''} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-yellow-900 dark:text-yellow-400 font-bold text-base">{userName.charAt(0).toUpperCase()}</span>
              )}
            </button>
          </div>
        </div>

        {/* Greeting & Streak Area */}
        <div className="px-6 pt-3 pb-6">
          {/* Greeting Text */}
          <div className="flex justify-between items-start mb-3 gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold font-serif mb-1 text-yellow-950 dark:text-white leading-snug break-words">
                {getGreeting()}, {userName}!
              </h1>
              <div className="flex items-center gap-2">
                <p className="text-yellow-900 dark:text-gray-300 text-xs sm:text-sm font-medium leading-normal break-words">
                  Deus preparou algo especial para você hoje.
                </p>
                <div className="bg-white/60 dark:bg-slate-800 rounded-full p-1.5 backdrop-blur-md shadow-sm inline-flex shrink-0 text-yellow-950 dark:text-yellow-400">
                  <GreetingIcon />
                </div>
              </div>
            </div>
          </div>

          <div id="tour-streak" className="bg-white/40 dark:bg-slate-800/80 px-2.5 sm:px-4 py-2 rounded-xl border border-white/60 dark:border-slate-700 backdrop-blur-md shadow-sm flex items-center justify-between gap-1 sm:gap-2.5 w-full">
            {/* Ofensiva */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 fill-orange-500 shrink-0 filter drop-shadow-sm" />
              <p className="text-xs sm:text-sm font-bold text-yellow-950 dark:text-gray-100 whitespace-nowrap">
                {getJourneyContent().text}
              </p>
            </div>

            {/* Trigger Central: 🎯 Missões */}
            <button
              onClick={() => setShowMissionsModal(true)}
              className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg bg-yellow-500/25 hover:bg-yellow-500/35 dark:bg-slate-700/80 dark:hover:bg-slate-700 text-yellow-950 dark:text-yellow-300 border border-yellow-600/25 dark:border-slate-600 font-bold text-[11px] sm:text-xs shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
              title="Abrir Missões Diárias"
            >
              <Target className="w-3.5 h-3.5 text-amber-700 dark:text-yellow-400 shrink-0" />
              <span className="whitespace-nowrap">Missões</span>
            </button>

            {/* Status */}
            <div className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border border-white/60 dark:border-slate-600 bg-white/60 dark:bg-slate-700/80 shadow-xs shrink-0 backdrop-blur-md">
              <span className="text-xs sm:text-sm leading-none select-none shrink-0">{getJourneyContent().emoji}</span>
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-yellow-950 dark:text-yellow-300 whitespace-nowrap">
                {getJourneyContent().label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {user && !user.emailVerified && (
        <div className="mx-5 mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 rounded-xl p-3 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-yellow-900 dark:text-yellow-200 font-semibold text-sm">Sua conta está quase pronta!</h4>
            <p className="text-yellow-700 dark:text-yellow-400/80 text-xs mt-0.5">Verifique seu e-mail (e a caixa de spam) para confirmar seu acesso.</p>
            <button
              onClick={handleResendEmail}
              disabled={resending}
              className="mt-2 text-xs font-semibold text-yellow-800 dark:text-yellow-300 underline hover:text-yellow-900 dark:hover:text-yellow-200 disabled:opacity-50"
            >
              {resending ? 'Enviando...' : 'Reenviar E-mail'}
            </button>
          </div>
        </div>
      )}

      <div className="px-5 mt-6 space-y-8">
        {/* Versicle of the Day */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bookmark className="w-4 h-4 text-yellow-500" />
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">A Palavra de Hoje</h2>
          </div>
          {isDailyLoading ? (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden animate-pulse">
              <div className="h-20 bg-gray-200 dark:bg-slate-700 rounded mb-4 w-full"></div>
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3 ml-auto"></div>
            </div>
          ) : (
            <div 
              className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 relative overflow-hidden cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.98] transition-all duration-200 group z-10"
              onClick={() => {
                let handled = false;
                if (onNavigateToBible) {
                  const parsed = parseVerseReference(dailyData.verse.reference);
                  if (parsed) {
                    onNavigateToBible(parsed);
                    handled = true;
                  }
                }
                if (!handled && onChangeTab) {
                  onChangeTab('bible');
                }
              }}
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500 group-hover:bg-yellow-400 transition-colors" />
              <p className="text-gray-800 dark:text-gray-200 text-lg font-serif italic mb-4 leading-relaxed">
                "{dailyData.verse.text}"
              </p>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400 text-right">— {dailyData.verse.reference}</p>
            </div>
          )}
        </section>
        
        {/* Spotify Playlist Banner */}
        <section>
          <a 
            href="https://open.spotify.com/playlist/0vlHIeY0rUrDXocJd6XAOF?si=mjUDaUQbRNqnuw8AV1u91g&utm_source=copy-link&pi=s49PqDToSGqKi&sci=spotify%3Acard-config%3A2NpoZDWRf2MkKMpqmZx9nd" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-between bg-gradient-to-r from-[#1DB954] to-[#128a3c] p-4 rounded-2xl shadow-sm hover:shadow-md transition-shadow duration-200 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-black/20 rounded-full flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </div>
              <div>
                <h3 className="text-white font-bold text-sm sm:text-base leading-tight mb-0.5">Mergulhe na presença</h3>
                <p className="text-green-50 text-xs sm:text-sm">Ouça nossa Playlist Oficial de Adoração</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-white/70 group-hover:text-white transition-colors" />
          </a>
        </section>

        {/* Video of the day */}
        <section id="tour-video-section">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Video className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">🎥 Pare 5 minutinhos</h2>
            </div>
            <button 
              id="tour-video-history"
              onClick={() => onChangeTab && onChangeTab('videoHistory')}
              className="flex items-center gap-1.5 text-sm text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400 font-medium transition-colors"
            >
              <History className="w-4 h-4" />
              <span>Ver todos</span>
            </button>
          </div>
          {hasVideo ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden aspect-video relative z-0 transition-colors duration-200">
              <YouTubeFacade
                videoId={dailyData.videoId}
                title="Palavra em Vídeo do Dia"
                isLocked={(dailyData.isExclusive || dailyData.isPremium) && !hasAccess}
                isPremium={dailyData.isExclusive || dailyData.isPremium}
                onLockClick={() => setShowPremiumModal(true)}
              />
            </div>
          ) : (
            <div className="bg-gray-100 dark:bg-slate-800/50 rounded-2xl border border-gray-200 dark:border-slate-700 p-6 text-center transition-colors duration-200">
              <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum vídeo programado para hoje.</p>
              <button 
                onClick={() => onChangeTab && onChangeTab('videoHistory')}
                className="mt-3 text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400 font-medium text-sm transition-colors"
              >
                Assistir vídeos anteriores
              </button>
            </div>
          )}
        </section>

        {/* Current Devotional (Carousel & Individual Progress) */}
        <section id="tour-devocional-section">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                📖 Devocionais {activeThemeName ? `• ${activeThemeName}` : ''}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => onChangeTab?.('journey')}
                className="text-xs font-semibold text-yellow-600 hover:text-yellow-700 dark:text-yellow-500 dark:hover:text-yellow-400 transition-colors"
              >
                {hasActiveJourney ? 'Trocar tema' : 'Ver temas'}
              </button>
              {hasActiveJourney && carouselItems.length > 1 && (
                <div className="hidden sm:flex items-center gap-1 ml-1">
                  <button 
                    onClick={() => scrollCarousel('left')}
                    className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400 transition-colors"
                    title="Rolar para esquerda"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => scrollCarousel('right')}
                    className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-slate-800 text-gray-500 dark:text-gray-400 transition-colors"
                    title="Rolar para direita"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {!hasActiveJourney ? (
            /* Empty State for new users */
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-slate-700 text-center transition-colors">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/40 rounded-2xl flex items-center justify-center mx-auto mb-3 text-yellow-600 dark:text-yellow-400 shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-serif font-bold text-gray-900 dark:text-white text-base sm:text-lg mb-1.5">
                Inicie Sua Jornada Diária
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-5 leading-relaxed">
                Você ainda não iniciou sua jornada diária. Escolha um tema e comece seu momento com Deus hoje!
              </p>
              <button
                onClick={() => onChangeTab?.('journey')}
                className="inline-flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white text-sm font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm active:scale-95 cursor-pointer"
              >
                <BookOpen className="w-4 h-4" />
                <span>Escolher Tema & Começar</span>
              </button>
            </div>
          ) : (
            <>
              {carouselItems.length > 1 && (
                <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3 font-medium sm:hidden">
                  Passe para o lado para ver os dias já concluídos ➡️
                </p>
              )}
              
              <div 
                ref={carouselRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className="flex gap-4 overflow-x-auto scrollbar-hide no-scrollbar pb-4 -mx-5 px-5 snap-x cursor-grab active:cursor-grabbing relative z-0 scroll-smooth select-none"
              >
                {carouselItems.map((devotional, index) => {
                  const isCurrent = index === 0;
                  const isCompleted = devotional.isCompleted;
                  const themeStyle = getThemeStyle(devotional.theme);
                  
                  return (
                    <div 
                      id={isCurrent ? "tour-devocional" : undefined} 
                      key={`${devotional.id}-${index}`} 
                      className={`bg-white dark:bg-slate-800 rounded-2xl shadow-sm border ${
                        isCurrent 
                          ? 'border-yellow-300/90 dark:border-yellow-500/50 ring-2 ring-yellow-400/20' 
                          : 'border-gray-100 dark:border-slate-700 opacity-90 hover:opacity-100'
                      } overflow-hidden flex flex-col shrink-0 w-[285px] sm:w-[310px] snap-center transition-all duration-200`}
                    >
                      {/* Deterministic Gradient Banner with Letter Avatar */}
                      <div className={`h-24 ${themeStyle.gradient} flex items-center justify-center p-4 relative overflow-hidden`}>
                        {/* Background pattern circles */}
                        <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full bg-white/10 blur-xs pointer-events-none" />
                        <div className="absolute -left-4 -top-4 w-16 h-16 rounded-full bg-black/10 blur-xs pointer-events-none" />
                        
                        {/* Avatar / Icon Centerpiece */}
                        <div className={`relative w-14 h-14 rounded-2xl ${
                          isCompleted && !isCurrent
                            ? 'bg-white/85 dark:bg-slate-900/85 text-emerald-600 dark:text-emerald-400'
                            : 'bg-white/20 text-white backdrop-blur-md border border-white/30'
                        } shadow-sm flex items-center justify-center`}>
                          {isCompleted && !isCurrent ? (
                            <CheckCircle2 className="w-8 h-8" />
                          ) : (
                            <span className="font-serif font-black text-2xl tracking-tight drop-shadow-md select-none">
                              {themeStyle.initial}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="p-4 flex-1 flex flex-col justify-between">
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-1.5">
                            <span className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md uppercase shrink-0 ${
                              isCurrent && !devotional.isAllCompleted
                                ? 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300'
                                : devotional.isAllCompleted
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                            }`}>
                              {isCurrent && !devotional.isAllCompleted
                                ? `DIA ${devotional.dayNumber} • ATUAL`
                                : devotional.isAllCompleted && isCurrent
                                ? `DIA ${devotional.dayNumber} • CONCLUÍDO`
                                : `DIA ${devotional.dayNumber} • LIDO`}
                            </span>
                            
                            <span className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 truncate max-w-[140px]" title={devotional.theme}>
                              {devotional.theme}
                            </span>
                          </div>
                          
                          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 leading-snug line-clamp-2 break-words">
                            {devotional.title}
                          </h3>
                          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-3 break-words leading-relaxed mb-3">
                            {devotional.description}
                          </p>
                        </div>
                        
                        <button 
                          onClick={() => {
                            setActiveDevotional(devotional);
                            onChangeTab?.('journey');
                          }}
                          className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium transition-all w-full active:scale-95 ${
                            isCurrent
                              ? 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-xs'
                              : 'bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-gray-200'
                          }`}
                        >
                          {isCurrent ? (
                            <>
                              <PlayCircle className="w-4 h-4" />
                              <span>{devotional.isAllCompleted ? 'Revisar Mensagem' : 'Ler Mensagem'}</span>
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reler Mensagem</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>

      </div>

      {/* Premium Lock Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                <Crown className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Conteúdo Exclusivo VIP</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                Os vídeos da área Exclusivos VIP são reservados para assinantes do Florescer Premium.
              </p>
              
              <div className="w-full bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700 mb-6">
                <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">R$ 29,90 <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ mês</span></div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Cancele quando quiser, direto pelo aplicativo.</p>
              </div>

              <button
                onClick={() => {
                  setShowPremiumModal(false);
                  if (onChangeTab) onChangeTab('profile', 'subscription');
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
              >
                Conhecer o Florescer Premium
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Daily Missions Modal */}
      <MissionsModal
        isOpen={showMissionsModal}
        onClose={() => setShowMissionsModal(false)}
        onNavigateToDevotional={() => onChangeTab?.('journey')}
      />
    </div>
  );
}
