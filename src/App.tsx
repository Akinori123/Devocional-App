/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { BottomNav } from './components/BottomNav';
import { TourGuide } from './components/TourGuide';
import { SubscriptionLandingModal } from './components/subscription/SubscriptionLandingModal';
import { Home } from './pages/Home';
import { Bible } from './pages/Bible';
import { Journey } from './pages/Journey';
import { Profile } from './pages/Profile';
import { Onboarding } from './pages/Onboarding';
import { VideoHistory } from './pages/VideoHistory';
import { UsersAdminPanel } from './pages/UsersAdminPanel';
import { TabType } from './types';
import { DevotionalProvider, useDevotionals } from './context/DevotionalContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { useActiveSessionTracker } from './hooks/useActiveSessionTracker';
import { registerDeviceFcmToken } from './services/fcmRegistration';
import { Loader2, Trash2 } from 'lucide-react';

function AppContent() {
  useActiveSessionTracker();
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [profileSubTab, setProfileSubTab] = useState<'diary' | 'verses' | 'videos' | 'subscription' | 'settings'>('diary');
  const [bibleSelection, setBibleSelection] = useState<{ bookId: string; chapter: number; verse: number } | null>(null);

  const { user, profile, loading, logout } = useAuth();
  const { allDevotionals, setActiveDevotional } = useDevotionals();
  const handledDeepLinkRef = useRef(false);

  // Auto-sync Push FCM Token on app boot if permission is granted
  useEffect(() => {
    if (!user?.uid) return;
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      registerDeviceFcmToken(user.uid).catch((err) => {
        console.debug('FCM auto-sync in background:', err);
      });
    }
  }, [user?.uid]);

  const handleTabChange = useCallback((tab: TabType, subTab?: 'diary' | 'verses' | 'videos' | 'subscription' | 'settings' | 'admin') => {
    if (tab === 'profile') {
      if (subTab && subTab !== 'admin') {
        setProfileSubTab(subTab);
      } else {
        setProfileSubTab('diary');
      }
    }
    setCurrentTab(tab);
  }, []);

  const handleNavigateToBible = useCallback((selection: { bookId: string; chapter: number; verse: number }) => {
    setBibleSelection(selection);
    setCurrentTab('bible');
  }, []);

  const handleClearBibleSelection = useCallback(() => {
    setBibleSelection(null);
  }, []);

  // Deep Linking Handler (Épico 4)
  useEffect(() => {
    if (handledDeepLinkRef.current) return;
    
    try {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab') as TabType | null;
      const subTabParam = params.get('subTab') as any;
      const devotionalIdParam = params.get('devotionalId');
      const themeParam = params.get('theme');
      const bookParam = params.get('book');
      const chapterParam = params.get('chapter');
      const verseParam = params.get('verse');

      if (tabParam && ['home', 'bible', 'journey', 'profile', 'videoHistory', 'usersAdmin'].includes(tabParam)) {
        handleTabChange(tabParam, subTabParam);
        handledDeepLinkRef.current = true;
      }

      if (bookParam && chapterParam) {
        setBibleSelection({
          bookId: bookParam.toUpperCase(),
          chapter: parseInt(chapterParam) || 1,
          verse: parseInt(verseParam || '1') || 1
        });
        setCurrentTab('bible');
        handledDeepLinkRef.current = true;
      }

      if (devotionalIdParam && allDevotionals.length > 0) {
        const found = allDevotionals.find(d => d.id === devotionalIdParam);
        if (found) {
          setActiveDevotional(found);
          setCurrentTab('journey');
          handledDeepLinkRef.current = true;
        }
      } else if (themeParam && allDevotionals.length > 0) {
        const found = allDevotionals.find(d => d.theme.toLowerCase() === themeParam.toLowerCase());
        if (found) {
          setActiveDevotional(found);
          setCurrentTab('journey');
          handledDeepLinkRef.current = true;
        }
      }
    } catch (e) {
      console.error('Error handling deep link params:', e);
    }
  }, [allDevotionals, handleTabChange, setActiveDevotional]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Onboarding />
        <SubscriptionLandingModal />
      </>
    );
  }

  if (profile?.isDeleted) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900 p-6 text-center z-50">
        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
          <Trash2 className="w-10 h-10 text-red-600 dark:text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Conta na Lixeira</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8 leading-relaxed">
          Sua conta está na lixeira e será excluída em 30 dias. Contate o suporte se foi um engano.
        </p>
        <button 
          onClick={logout}
          className="bg-gray-200 hover:bg-gray-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-bold py-3 px-8 rounded-xl transition-colors"
        >
          Sair da conta
        </button>
      </div>
    );
  }

  const renderContent = () => {
    switch (currentTab) {
      case 'home':
        return <Home onChangeTab={handleTabChange} onNavigateToBible={handleNavigateToBible} />;
      case 'bible':
        return <Bible initialSelection={bibleSelection} clearInitialSelection={handleClearBibleSelection} onChangeTab={handleTabChange} />;
      case 'journey':
        return <Journey onChangeTab={handleTabChange} onNavigateToBible={handleNavigateToBible} />;
      case 'profile':
        return <Profile initialTab={profileSubTab} onChangeTab={handleTabChange} onNavigateToBible={handleNavigateToBible} />;
      case 'videoHistory':
        return <VideoHistory onBack={() => handleTabChange('home')} onGoToPremium={() => handleTabChange('profile', 'subscription')} />;
      case 'usersAdmin':
        return <UsersAdminPanel onChangeTab={handleTabChange} />;
      default:
        return <Home onChangeTab={handleTabChange} onNavigateToBible={handleNavigateToBible} />;
    }
  };

  return (
    <div className={`flex flex-col min-h-screen bg-white dark:bg-slate-900 mx-auto relative shadow-2xl transition-all duration-200 ${
      currentTab === 'usersAdmin' ? 'w-full max-w-md lg:max-w-4xl xl:max-w-5xl' : 'w-full max-w-md'
    }`}>
      {renderContent()}
      <BottomNav currentTab={currentTab} onChangeTab={handleTabChange} />
      <TourGuide onChangeTab={handleTabChange} />
      <SubscriptionLandingModal />
    </div>
  );
}

import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AuthProvider>
          <DevotionalProvider>
            <AppContent />
          </DevotionalProvider>
        </AuthProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
