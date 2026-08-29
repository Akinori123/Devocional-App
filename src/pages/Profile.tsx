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
import { MessageCircle, Mail, Heart, Bookmark, Settings, Sparkles } from 'lucide-react';
import { TabType } from '../types';

export type ProfileTab = 'diary' | 'verses' | 'videos' | 'subscription' | 'settings';

interface ProfileProps {
  initialTab?: ProfileTab;
  onChangeTab?: (tab: TabType, subTab?: ProfileTab) => void;
}

export function Profile({ initialTab = 'diary', onChangeTab }: ProfileProps = {}) {
  const [activeTab, setActiveTab] = useState<ProfileTab>(initialTab);
  const prevInitialTabRef = useRef(initialTab);

  React.useEffect(() => {
    if (initialTab && initialTab !== prevInitialTabRef.current) {
      prevInitialTabRef.current = initialTab;
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  
  const [showSupportModal, setShowSupportModal] = useState(false);
  const { user } = useAuth();
  
  // Carousel Drag to Scroll on PC & Mouse
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const isMouseDownRef = useRef(false);
  const startXRef = useRef(0);
  const startScrollLeftRef = useRef(0);
  const hasMovedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isMouseDownRef.current = true;
    hasMovedRef.current = false;
    startXRef.current = e.clientX;
    startScrollLeftRef.current = tabsContainerRef.current?.scrollLeft || 0;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isMouseDownRef.current || !tabsContainerRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    if (Math.abs(deltaX) > 4) {
      hasMovedRef.current = true;
      tabsContainerRef.current.scrollLeft = startScrollLeftRef.current - deltaX;
    }
  };

  const handleMouseUp = () => {
    isMouseDownRef.current = false;
    setTimeout(() => {
      hasMovedRef.current = false;
    }, 100);
  };

  const handleTabClick = (tab: ProfileTab) => {
    if (hasMovedRef.current) return;
    setActiveTab(tab);
  };
  
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
      
      {/* Tab Navigation with Drag-to-Scroll & Wheel Scroll */}
      <div className="bg-white dark:bg-slate-900 px-3 pt-3 border-b border-gray-200 dark:border-slate-800 shrink-0 transition-colors duration-200 mt-2">
        <div 
          ref={tabsContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={(e) => {
            if (tabsContainerRef.current && e.deltaY !== 0) {
              tabsContainerRef.current.scrollLeft += e.deltaY;
            }
          }}
          className="flex gap-5 overflow-x-auto scrollbar-hide no-scrollbar cursor-grab active:cursor-grabbing select-none px-1"
        >
          <button
            onClick={() => handleTabClick('diary')}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap shrink-0 cursor-pointer",
              activeTab === 'diary' ? "text-yellow-500 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Diário
            {activeTab === 'diary' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('verses')}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap shrink-0 cursor-pointer",
              activeTab === 'verses' ? "text-yellow-500 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Versos Salvos
            {activeTab === 'verses' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('videos')}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap flex items-center gap-1.5 shrink-0 cursor-pointer",
              activeTab === 'videos' ? "text-yellow-500 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            <Heart className={cn("w-3.5 h-3.5", activeTab === 'videos' ? "fill-yellow-500 text-yellow-500" : "text-gray-400")} />
            Vídeos Favoritos
            {activeTab === 'videos' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('subscription')}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap shrink-0 cursor-pointer",
              activeTab === 'subscription' ? "text-yellow-500 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Assinatura
            {activeTab === 'subscription' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => handleTabClick('settings')}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap shrink-0 cursor-pointer",
              activeTab === 'settings' ? "text-yellow-500 dark:text-yellow-400 font-bold" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Configurações
            {activeTab === 'settings' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
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
          {activeTab === 'verses' && <SavedVersesTab />}
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
