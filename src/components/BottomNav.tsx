import { useState, useEffect, useRef } from 'react';
import { Home, Book, Map, User, ShieldAlert } from 'lucide-react';
import { TabType } from '../types';
import { cn } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

interface BottomNavProps {
  currentTab: TabType;
  onChangeTab: (tab: TabType) => void;
}

export function BottomNav({ currentTab, onChangeTab }: BottomNavProps) {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const { profile, user } = useAuth();
  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';

  useEffect(() => {
    const handleScroll = (e: Event) => {
      let currentScrollY = 0;
      if (e.target === document || e.target === window) {
        currentScrollY = window.scrollY;
      } else {
        const target = e.target as HTMLElement;
        if (target.scrollTop !== undefined) {
          currentScrollY = target.scrollTop;
        } else {
          return;
        }
      }
      if (currentScrollY > lastScrollY.current + 10) {
        setIsVisible(false);
        lastScrollY.current = currentScrollY;
      } else if (currentScrollY < lastScrollY.current - 10) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
      }
      if (currentScrollY < 50) {
        setIsVisible(true);
      }
    };

    // true = capture phase, so we get scroll events from any child container
    window.addEventListener('scroll', handleScroll, true);
    return () => window.removeEventListener('scroll', handleScroll, true);
  }, []);

  const tabs = [
    { id: 'home' as TabType, label: 'Hoje', icon: Home },
    { id: 'bible' as TabType, label: 'Bíblia', icon: Book },
    { id: 'journey' as TabType, label: 'Jornada', icon: Map },
    { id: 'profile' as TabType, label: 'Perfil', icon: User },
  ];

  if (isAdmin) {
    tabs.push({ id: 'usersAdmin' as TabType, label: 'Painel', icon: ShieldAlert });
  }

  return (
    <nav className={cn(
      "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 pb-safe z-40 transition-all duration-300 ease-in-out",
      isVisible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
    )}>
      <div className="flex justify-around items-center h-16">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          return (
            <button
              key={tab.id}
              id={`tour-tab-${tab.id}`}
              onClick={() => onChangeTab(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                isActive ? "text-yellow-500 dark:text-yellow-400" : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "fill-yellow-50 dark:fill-yellow-900/30")} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
