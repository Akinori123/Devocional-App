/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { BottomNav } from './components/BottomNav';
import { TourGuide } from './components/TourGuide';
import { Home } from './pages/Home';
import { Bible } from './pages/Bible';
import { Journey } from './pages/Journey';
import { Profile } from './pages/Profile';
import { Onboarding } from './pages/Onboarding';
import { VideoHistory } from './pages/VideoHistory';
import { UsersAdminPanel } from './pages/UsersAdminPanel';
import { TabType } from './types';
import { DevotionalProvider } from './context/DevotionalContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { Loader2, Trash2 } from 'lucide-react';

function AppContent() {
  const [currentTab, setCurrentTab] = useState<TabType>('home');
  const [profileSubTab, setProfileSubTab] = useState<'diary' | 'verses' | 'subscription' | 'settings'>('diary');
  const [bibleSelection, setBibleSelection] = useState<{ bookId: string; chapter: number; verse: number } | null>(null);

  const { user, profile, loading, logout } = useAuth();

  const handleTabChange = useCallback((tab: TabType, subTab?: 'diary' | 'verses' | 'subscription' | 'settings') => {
    if (tab === 'profile') {
      setProfileSubTab(subTab || 'diary');
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

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mb-4" />
        <p className="text-gray-500 font-medium animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Onboarding />;
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
        return <Profile initialTab={profileSubTab} />;
      case 'videoHistory':
        return <VideoHistory onBack={() => handleTabChange('home')} onGoToPremium={() => handleTabChange('profile', 'subscription')} />;
      case 'usersAdmin':
        return <UsersAdminPanel onChangeTab={handleTabChange} />;
      default:
        return <Home onChangeTab={handleTabChange} onNavigateToBible={handleNavigateToBible} />;
    }
  };

  return (
    <>
      {renderContent()}
      <BottomNav currentTab={currentTab} onChangeTab={handleTabChange} />
      <TourGuide onChangeTab={handleTabChange} />
    </>
  );
}

import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <ToastProvider>
      <SettingsProvider>
        <AuthProvider>
          <DevotionalProvider>
            <div className="flex flex-col min-h-screen bg-white dark:bg-slate-900 max-w-md mx-auto relative shadow-2xl transition-colors duration-200">
              <AppContent />
            </div>
          </DevotionalProvider>
        </AuthProvider>
      </SettingsProvider>
    </ToastProvider>
  );
}
