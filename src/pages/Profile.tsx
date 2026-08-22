import React, { useState, useRef } from 'react';
import { ProfileHeader } from '../components/profile/ProfileHeader';
import { DiaryTab } from '../components/profile/DiaryTab';
import { SavedVersesTab } from '../components/profile/SavedVersesTab';
import { SubscriptionTab } from '../components/profile/SubscriptionTab';

import { SettingsTab } from '../components/profile/SettingsTab';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { MessageCircle, Mail, X } from 'lucide-react';

type ProfileTab = 'diary' | 'verses' | 'subscription' | 'settings';

interface ProfileProps {
  initialTab?: ProfileTab;
}

export function Profile({ initialTab = 'diary' }: ProfileProps = {}) {
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
  
  // Carousel Drag to Scroll
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => setIsDragging(false);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // scroll speed
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };
  
  return (
    <div className="flex-1 flex flex-col bg-gray-50 dark:bg-slate-900 min-h-screen pb-20 transition-colors duration-200">
      <ProfileHeader />
      
      {/* Tab Navigation */}
      <div className="bg-white dark:bg-slate-900 px-5 pt-4 border-b border-gray-200 dark:border-slate-800 shrink-0 transition-colors duration-200">
        <div 
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="flex gap-6 overflow-x-auto scrollbar-hide cursor-grab active:cursor-grabbing"
        >
          <button
            onClick={() => setActiveTab('diary')}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap",
              activeTab === 'diary' ? "text-yellow-500 dark:text-yellow-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Diário
            {activeTab === 'diary' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('verses')}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap",
              activeTab === 'verses' ? "text-yellow-500 dark:text-yellow-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Versos Salvos
            {activeTab === 'verses' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('subscription')}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap",
              activeTab === 'subscription' ? "text-yellow-500 dark:text-yellow-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            )}
          >
            Assinatura
            {activeTab === 'subscription' && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-yellow-500 dark:bg-yellow-400 rounded-t-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={cn(
              "pb-3 text-sm font-semibold transition-colors relative whitespace-nowrap",
              activeTab === 'settings' ? "text-yellow-500 dark:text-yellow-400" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
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
        <div className="min-h-[60vh]">
          {activeTab === 'diary' && <DiaryTab />}
          {activeTab === 'verses' && <SavedVersesTab />}
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
            <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageCircle className="w-5 h-5 text-[#25D366]" />
                Atendimento via WhatsApp
              </h3>
              <button 
                onClick={() => setShowSupportModal(false)}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 flex flex-col gap-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Escolha um de nossos números de atendimento para falar com nossa equipe:
              </p>
              
              <a
                href="https://wa.me/5542999795021"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowSupportModal(false)}
                className="w-full bg-white dark:bg-slate-800 border-2 border-[#25D366] hover:bg-[#25D366] hover:text-white group text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-xl flex justify-between items-center transition-all shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    <MessageCircle className="w-4 h-4 text-[#25D366] group-hover:text-white" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span>Atendimento 1</span>
                    <span className="text-xs font-normal opacity-80">(42) 99979-5021</span>
                  </div>
                </div>
              </a>
              
              <a
                href="https://wa.me/5542999657408"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setShowSupportModal(false)}
                className="w-full bg-white dark:bg-slate-800 border-2 border-[#25D366] hover:bg-[#25D366] hover:text-white group text-gray-800 dark:text-gray-200 font-bold py-3 px-4 rounded-xl flex justify-between items-center transition-all shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#25D366]/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    <MessageCircle className="w-4 h-4 text-[#25D366] group-hover:text-white" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span>Atendimento 2</span>
                    <span className="text-xs font-normal opacity-80">(42) 99965-7408</span>
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
