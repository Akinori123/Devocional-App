import React, { useState, useRef, useEffect } from 'react';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { DiaryTab } from '../components/profile/DiaryTab';
import { SavedVersesTab } from '../components/profile/SavedVersesTab';
import { SubscriptionTab } from '../components/profile/SubscriptionTab';
import { FavoriteVideosTab } from '../components/profile/FavoriteVideosTab';
import { SettingsTab } from '../components/profile/SettingsTab';
import { VipVideoBanner } from '../components/video/VipVideoBanner';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { MessageCircle, Mail, Heart } from 'lucide-react';
import { TabType } from '../types';

export type ProfileTab = 'diary' | 'verses' | 'videos' | 'subscription' | 'settings';

interface ProfileProps {
  initialTab?: ProfileTab;
  onChangeTab?: (tab: TabType, subTab?: ProfileTab) => void;
  onNavigateToBible?: (selection: { bookId: string; chapter: number; verse: number }) => void;
}

export function Profile({ initialTab = 'diary', onChangeTab, onNavigateToBible }: ProfileProps = {}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const prevInitialTabRef = useRef(initialTab);

  useEffect(() => {
    if (initialTab && initialTab !== prevInitialTabRef.current) {
      prevInitialTabRef.current = initialTab;
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  const [showSupportModal, setShowSupportModal] = useState(false);
  const { user } = useAuth();
  
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  
  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 min-h-screen pb-24 transition-colors duration-200">
      <ProfileHeader />

      {/* VIP Video Banner Shortcut at Profile Top */}
      <div className="px-5 pt-3">
        <VipVideoBanner 
          onClick={() => onChangeTab?.('videoHistory')} 
          variant="compact"
        />
      </div>
      
      {/* Tab Navigation - Grid/Flex responsivo para caber todas as 5 abas perfeitamente na tela no PC e Mobile */}
      <div className="bg-white dark:bg-slate-900 px-2 sm:px-3 pt-2.5 border-b border-gray-200 dark:border-slate-800 shrink-0 transition-colors duration-200 mt-2">
        <div 
          ref={tabsContainerRef}
          onWheel={(e) => {
            if (tabsContainerRef.current) {
              const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
              tabsContainerRef.current.scrollLeft += delta;
            }
          }}
          className="flex items-center justify-between w-full overflow-x-auto scrollbar-none"
        >
          <button
            onClick={() => setActiveTab('diary')}
            className={cn(
              "flex-1 pb-2.5 pt-1 text-center text-xs sm:text-sm font-semibold transition-colors relative whitespace-nowrap px-1 cursor-pointer",
              activeTab === 'diary' ? "text-yellow-600 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Diário
            {activeTab === 'diary' && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('verses')}
            className={cn(
              "flex-1 pb-2.5 pt-1 text-center text-xs sm:text-sm font-semibold transition-colors relative whitespace-nowrap px-1 cursor-pointer",
              activeTab === 'verses' ? "text-yellow-600 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <span className="hidden xs:inline">Versos </span>Salvos
            {activeTab === 'verses' && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('videos')}
            className={cn(
              "flex-1 pb-2.5 pt-1 text-center text-xs sm:text-sm font-semibold transition-colors relative whitespace-nowrap px-1 cursor-pointer flex items-center justify-center gap-1",
              activeTab === 'videos' ? "text-yellow-600 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <Heart className={cn("w-3 h-3 shrink-0", activeTab === 'videos' ? "fill-yellow-500 text-yellow-500" : "text-gray-400")} />
            <span>Vídeos</span>
            {activeTab === 'videos' && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('subscription')}
            className={cn(
              "flex-1 pb-2.5 pt-1 text-center text-xs sm:text-sm font-semibold transition-colors relative whitespace-nowrap px-1 cursor-pointer",
              activeTab === 'subscription' ? "text-yellow-600 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Assinatura
            {activeTab === 'subscription' && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex-1 pb-2.5 pt-1 text-center text-xs sm:text-sm font-semibold transition-colors relative whitespace-nowrap px-1 cursor-pointer",
              activeTab === 'settings' ? "text-yellow-600 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <span className="hidden sm:inline">Configurações</span>
            <span className="sm:hidden">Ajustes</span>
            {activeTab === 'settings' && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-[50vh]">
          {activeTab === 'diary' && (
            <DiaryTab onNavigateToSubscription={() => setActiveTab('subscription')} />
          )}
          {activeTab === 'verses' && (
            <SavedVersesTab onNavigateToBible={onNavigateToBible} />
          )}
          {activeTab === 'videos' && (
            <FavoriteVideosTab 
              onGoToPremium={() => setActiveTab('subscription')}
              onExploreVideos={() => onChangeTab?.('videoHistory')}
            />
          )}
          {activeTab === 'subscription' && <SubscriptionTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
        
        {/* Support Section */}
        <div className="p-5 mt-4 border-t border-gray-200 dark:border-slate-800">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Atendimento e Sugestões</h3>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setShowSupportModal(true)}
              className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold py-3.5 px-4 rounded-xl flex justify-center items-center gap-2 transition-colors shadow-sm"
            >
              <MessageCircle className="w-5 h-5" />
              Suporte Técnico e Atendimento
            </button>

            <a
              href="mailto:floresceremadoracao@gmail.com"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3.5 px-4 rounded-xl flex flex-col justify-center items-center gap-1 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2 font-bold">
                <Mail className="w-5 h-5" />
                <span>Ideias, Recomendações e Bugs</span>
              </div>
              <span className="text-xs text-blue-100">floresceremadoracao@gmail.com</span>
            </a>
          </div>
        </div>
      </div>
      
      {/* Support Modal */}
      {showSupportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Suporte Florescer</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                Fale diretamente conosco pelo WhatsApp para tirar dúvidas sobre sua assinatura ou o aplicativo.
              </p>
              
              <div className="flex flex-col gap-3">
                <a
                  href="https://wa.me/5511999999999"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-[#25D366] hover:bg-[#1ebe57] text-white font-bold py-3 px-4 rounded-xl flex justify-center items-center gap-2 transition-colors shadow-sm"
                >
                  Abrir WhatsApp
                </a>
                <button
                  onClick={() => setShowSupportModal(false)}
                  className="w-full py-3 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
