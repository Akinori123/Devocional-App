import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, PlayCircle, Bookmark, Flame, AlertCircle, Video, ChevronRight, ChevronLeft, Sun, Moon, Sunrise, Music, History, Flower2, Crown, Lock, X, Sprout, Trees, Sparkles } from 'lucide-react';
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

interface HomeProps {
  onChangeTab?: (tab: TabType, subTab?: 'diary' | 'verses' | 'subscription' | 'settings' | 'admin') => void;
  onNavigateToBible?: (selection: { bookId: string; chapter: number; verse: number }) => void;
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
};

const GreetingIcon = () => {
  const hour = new Date().getHours();
  if (hour < 12) return <Sunrise className="w-5 h-5 text-orange-400" />;
  if (hour < 18) return <Sun className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
  return <Moon className="w-5 h-5 text-blue-900 fill-blue-900" />;
};

export function Home({ onChangeTab, onNavigateToBible }: HomeProps) {
  const toast = useToast();
  const { user, profile } = useAuth();
  const { allDevotionals, readHistory, setActiveDevotional } = useDevotionals();
  const [resending, setResending] = useState(false);
  const [dailyData, setDailyData] = useState<{ videoId: string; verse: { text: string; reference: string }; isExclusive?: boolean; isPremium?: boolean }>(() => getDailyContent());
  const [isDailyLoading, setIsDailyLoading] = useState(true);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  
  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';
  const hasAccess = profile?.isPremium || isAdmin;
  
  // Carousel Drag to Scroll
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!carouselRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - carouselRef.current.offsetLeft);
    setScrollLeft(carouselRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !carouselRef.current) return;
    e.preventDefault();
    const x = e.pageX - carouselRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll speed
    carouselRef.current.scrollLeft = scrollLeft - walk;
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


  // Find next devotional
  const unreadDevotionals = allDevotionals.filter(d => !readHistory.includes(d.id));
  const readDevotionals = allDevotionals.filter(d => readHistory.includes(d.id));
  
  // Create a list for the carousel: next unread + recently read
  const carouselItems = [...unreadDevotionals.slice(0, 3), ...readDevotionals.slice(0, 5)];

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
      
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-yellow-400/95 dark:bg-yellow-500/95 backdrop-blur-md pt-10 pb-4 px-6 flex justify-between items-center transition-colors duration-200 border-b border-yellow-500/20 dark:border-yellow-600/20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-white/40 p-1.5 rounded-2xl backdrop-blur-md shadow-sm overflow-hidden flex items-center justify-center w-14 h-14 shrink-0">
            <img src="/rosa.png" alt="Florescer" className="w-full h-full object-cover" />
          </div>
          <span className="font-serif font-bold text-yellow-950 text-2xl tracking-tight">Florescer</span>
        </div>
        
        <button 
          onClick={() => onChangeTab('profile')} 
          className="w-14 h-14 rounded-full border-2 border-white/60 overflow-hidden shadow-sm flex items-center justify-center bg-yellow-100 hover:scale-105 transition-transform shrink-0"
        >
          {profile?.photoURL || user?.photoURL ? (
            <img src={profile?.photoURL || user?.photoURL || ''} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <span className="text-yellow-900 font-bold text-lg">{userName.charAt(0).toUpperCase()}</span>
          )}
        </button>
      </div>

      {/* Greeting Area */}
      <div className="bg-yellow-400 dark:bg-yellow-500 text-yellow-950 pt-6 pb-8 px-6 rounded-b-[2rem] shadow-sm transition-colors duration-200 relative z-40 -mt-[1px]">
        
        {/* Greeting Text */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-xl font-bold font-serif mb-1">{getGreeting()}, {userName}!</h1>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-yellow-900 dark:text-yellow-950 text-sm opacity-90 font-medium leading-tight">Deus preparou algo especial para você hoje.</p>
              <div className="bg-white/60 dark:bg-white/80 rounded-full p-1.5 backdrop-blur-md shadow-sm inline-flex shrink-0">
                <GreetingIcon />
              </div>
            </div>
          </div>
        </div>
        <div id="tour-streak" className="bg-white/40 dark:bg-white/20 px-4 py-2.5 rounded-xl border border-white/60 dark:border-white/30 backdrop-blur-md shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Flame className="w-6 h-6 text-orange-500 fill-orange-500 shrink-0 filter drop-shadow-sm" />
            <p className="text-sm font-semibold text-yellow-950 dark:text-yellow-950 truncate">
              {getJourneyContent().text}
            </p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/60 dark:border-white/40 bg-white/60 dark:bg-white/40 shadow-xs shrink-0 backdrop-blur-md">
            <span className="text-base leading-none select-none">{getJourneyContent().emoji}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-950 dark:text-yellow-950">
              {getJourneyContent().label}
            </span>
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
              {(dailyData.isExclusive || dailyData.isPremium) && !hasAccess ? (
                <div 
                  className="w-full h-full absolute inset-0 cursor-pointer group/lock"
                  onClick={() => setShowPremiumModal(true)}
                >
                  <img 
                    src={`https://img.youtube.com/vi/${dailyData.videoId}/mqdefault.jpg`} 
                    alt="Miniatura do Vídeo do Dia" 
                    className="w-full h-full object-cover opacity-50 transition-opacity group-hover/lock:opacity-40"
                  />
                  <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center text-white p-4 text-center backdrop-blur-[2px]">
                    <div className="w-12 h-12 bg-yellow-500/90 rounded-full flex items-center justify-center mb-3 shadow-lg group-hover/lock:scale-110 transition-transform">
                      <Lock className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="font-bold text-base mb-1 flex items-center gap-1.5">
                      <Crown className="w-4 h-4 text-amber-300" />
                      <span>Vídeo Exclusivo VIP</span>
                    </h3>
                    <p className="text-xs text-yellow-200 font-medium">Assine o Premium para assistir</p>
                  </div>
                </div>
              ) : (
                <iframe 
                  className="w-full h-full absolute inset-0"
                  src={`https://www.youtube.com/embed/${dailyData.videoId}?rel=0&modestbranding=1`} 
                  title="Palavra em Vídeo do Dia" 
                  frameBorder="0" 
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                  referrerPolicy="strict-origin-when-cross-origin" 
                  allowFullScreen>
                </iframe>
              )}
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

        {/* Current Devotional (Carousel) */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-yellow-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">📖 Devocionais</h2>
            </div>
            <div className="hidden sm:flex items-center gap-1">
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
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mb-3 font-medium sm:hidden">Passe para o lado para ler mensagens anteriores ➡️</p>
          
          <div 
            ref={carouselRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-5 px-5 snap-x cursor-grab active:cursor-grabbing relative z-0 scroll-smooth"
          >
            {carouselItems.map((devotional, index) => (
              <div id={index === 0 ? "tour-devocional" : undefined} key={devotional.id} className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 overflow-hidden flex flex-col shrink-0 w-[280px] snap-center transition-colors duration-200">
                <div className="h-24 bg-yellow-50 dark:bg-yellow-900/10 flex items-center justify-center p-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-yellow-100/50 to-orange-100/50 dark:from-yellow-900/30 dark:to-orange-900/30" />
                  <div className="relative w-12 h-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-md shadow-sm flex items-center justify-center">
                    <BookOpen className="text-yellow-400 w-6 h-6" />
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-yellow-500 mb-1 block uppercase">
                      {index === 0 ? 'DEVOCIONAL DO DIA' : 'RELEITURA'}
                    </span>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 leading-tight line-clamp-1">{devotional.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4">{devotional.description}</p>
                  </div>
                  
                  <button 
                    onClick={() => {
                      setActiveDevotional(devotional);
                      onChangeTab?.('journey');
                    }}
                    className="flex items-center justify-center gap-2 bg-yellow-500 text-white py-2.5 px-4 rounded-xl text-sm font-medium hover:bg-yellow-700 active:scale-95 transition-all w-full"
                  >
                    <PlayCircle className="w-4 h-4" />
                    Ler Mensagem
                  </button>
                </div>
              </div>
            ))}
          </div>
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
    </div>
  );
}
