import React, { useState, useEffect } from 'react';
import { Joyride, Step, EventData, TooltipRenderProps, STATUS, EVENTS, ACTIONS } from 'react-joyride';
import { X } from 'lucide-react';
import { TabType } from '../types';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface TourGuideProps {
  onChangeTab: (tab: TabType) => void;
}

export function TourGuide({ onChangeTab }: TourGuideProps) {
  const [run, setRun] = useState(false);
  const { user, profile } = useAuth();

  useEffect(() => {
    if (!user) return;

    const userKey = `has_seen_tour_${user.uid}`;
    const hasSeenLocal = localStorage.getItem(userKey) === 'true' || localStorage.getItem('has_seen_tour') === 'true';
    const hasSeenProfile = profile?.hasSeenTour === true;

    // Se o usuário já viu o tour (no perfil ou no localStorage), não executa
    if (hasSeenLocal || hasSeenProfile) {
      setRun(false);
      return;
    }

    // Aguarda o perfil ser carregado antes de disparar
    if (!profile) return;

    // Inicia o tour para novo usuário
    const timer = setTimeout(() => {
      setRun(true);
    }, 800);

    return () => clearTimeout(timer);
  }, [user?.uid, profile?.hasSeenTour, !!profile]);

  const markTourCompleted = () => {
    setRun(false);
    localStorage.setItem('has_seen_tour', 'true');
    if (user?.uid) {
      localStorage.setItem(`has_seen_tour_${user.uid}`, 'true');
      updateDoc(doc(db, 'users', user.uid), { hasSeenTour: true }).catch(() => {});
    }
  };

  const handleJoyrideCallback = (data: EventData) => {
    const { status, type, action, index } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (type === EVENTS.TOUR_START) {
      // Assim que o tour efetivamente comeca na tela, salva para que recarregamentos nao repitam
      if (user?.uid) {
        localStorage.setItem(`has_seen_tour_${user.uid}`, 'true');
        localStorage.setItem('has_seen_tour', 'true');
        updateDoc(doc(db, 'users', user.uid), { hasSeenTour: true }).catch(() => {});
      }
    }

    if (finishedStatuses.includes(status) || action === ACTIONS.CLOSE || type === EVENTS.TOUR_END) {
      markTourCompleted();
      return;
    }

    if (type === EVENTS.STEP_BEFORE) {
      if (index === 0) onChangeTab('home');
      else if (index === 1) onChangeTab('home');
      else if (index === 2) onChangeTab('home');
      else if (index === 3) onChangeTab('profile');
    }
  };

  const steps: Step[] = [
    {
      target: '#tour-streak',
      content: 'Sua semente foi plantada! Volte todos os dias para manter sua ofensiva acesa e crescer na jornada.',
      skipBeacon: true,
      placement: 'bottom',
      skipScroll: false,
    },
    {
      target: '#tour-devocional',
      content: 'Aqui você lê sua palavra diária e pode usar nossa Inteligência Artificial para gerar imagens lindas daquele versículo!',
      placement: 'top',
      skipScroll: false,
    },
    {
      target: '#tour-video-history',
      content: 'Perdeu algum dia? Não se preocupe! Todo o nosso acervo fica guardado aqui para você assistir quando quiser.',
      placement: 'top',
      skipScroll: false,
    },
    {
      target: '#tour-tab-profile',
      content: 'Aqui é o seu cantinho! Gerencie seu Diário, configure o aplicativo e descubra os benefícios exclusivos da versão Premium.',
      placement: 'top',
      skipScroll: true,
    }
  ];

  const CustomTooltip = ({
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    tooltipProps,
    isLastStep
  }: TooltipRenderProps) => {
    return (
      <div {...tooltipProps} className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border-4 border-yellow-400 dark:border-yellow-500 p-5 max-w-[320px] sm:max-w-sm mx-4 relative overflow-visible z-[10000]">
        
        {/* Floating Animated Mascot / Hand */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-20 h-20 bg-yellow-100 dark:bg-yellow-900/50 rounded-full border-4 border-white dark:border-slate-800 shadow-lg flex items-center justify-center animate-bounce z-10 text-4xl">
          {index === 0 ? '🌱' : index === 1 ? '✨' : index === 2 ? '📺' : '👤'}
        </div>
        
        {/* Pointing Hand Indicator depending on placement */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 animate-pulse text-4xl filter drop-shadow-md">
           👇
        </div>
        
        <button {...closeProps} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 dark:bg-slate-700 rounded-full p-1.5 transition-colors z-20">
          <X className="w-4 h-4" />
        </button>
        
        <div className="mt-8 text-center relative z-10">
          <p className="text-gray-800 dark:text-gray-100 font-bold leading-relaxed text-base mb-6">
            {step.content}
          </p>
          
          <div className="flex items-center justify-between mt-2">
            <div className="text-xs text-yellow-600 dark:text-yellow-500 font-bold bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded-full">
              {index + 1} / {steps.length}
            </div>
            <div className="flex gap-2">
              {index > 0 && (
                <button 
                  {...backProps} 
                  className="px-4 py-2.5 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Voltar
                </button>
              )}
              <button 
                {...primaryProps} 
                title=""
                className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 rounded-xl shadow-md transition-all active:scale-95"
              >
                {isLastStep ? 'Começar!' : 'Entendi!'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep={false}
      onEvent={handleJoyrideCallback}
      tooltipComponent={CustomTooltip}
    />
  );
}
