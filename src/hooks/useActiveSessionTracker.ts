import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { format } from 'date-fns';

const TARGET_ACTIVE_SECONDS = 15 * 60; // 15 minutos = 900 segundos
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos de inatividade máxima permitida (mais tolerante para momentos de oração/leitura)

export function useActiveSessionTracker() {
  const { user, profile, awardDailyCoin } = useAuth();
  const toast = useToast();
  const hasAwardedRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const storageKey = `active_session_${user.uid}_${today}`;
    const isSessionClaimedToday = Boolean(
      profile?.claimedDailyMissions?.includes(`session_15min_${today}`) || 
      (typeof window !== 'undefined' && localStorage.getItem(`claimed_mission_session_15min_${user.uid}_${today}`) === 'true')
    );

    // Se já recebeu a missão de 15 min hoje, não precisa notificar novamente
    if (isSessionClaimedToday) {
      hasAwardedRef.current = true;
      return;
    }

    let accumulatedSeconds = 0;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        accumulatedSeconds = parseInt(stored, 10) || 0;
      }
    } catch (e) {
      // ignore
    }

    if (accumulatedSeconds >= TARGET_ACTIVE_SECONDS) {
      if (!hasAwardedRef.current) {
        hasAwardedRef.current = true;
        toast.success('🎯 Missão Concluída: 15 minutos no app! Abra o menu Missões para resgatar sua Moeda 🎁');
      }
      return;
    }

    let lastUserActivityTime = Date.now();

    // Listeners de atividade real do usuário na tela
    const registerUserInteraction = () => {
      lastUserActivityTime = Date.now();
    };

    const interactionEvents: (keyof WindowEventMap)[] = ['touchstart', 'scroll', 'click', 'mousemove', 'keydown', 'focus'];

    interactionEvents.forEach(eventType => {
      window.addEventListener(eventType, registerUserInteraction, { passive: true });
    });

    const intervalId = setInterval(() => {
      const now = Date.now();
      const isTabHidden = typeof document !== 'undefined' && document.hidden;
      const timeSinceLastInteraction = now - lastUserActivityTime;
      const isUserActive = !isTabHidden && timeSinceLastInteraction < IDLE_TIMEOUT_MS;

      // Se o usuário estiver inativo por mais de 5 minutos ou com a aba minimizada/oculta, pausa o contador
      if (!isUserActive) return;

      accumulatedSeconds += 1;
      try {
        localStorage.setItem(storageKey, accumulatedSeconds.toString());
      } catch (e) {
        // ignore
      }

      if (accumulatedSeconds >= TARGET_ACTIVE_SECONDS && !hasAwardedRef.current) {
        hasAwardedRef.current = true;
        clearInterval(intervalId);
        toast.success('🎯 Missão Concluída: 15 minutos no app! Abra o menu Missões para resgatar sua Moeda 🎁');
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
      interactionEvents.forEach(eventType => {
        window.removeEventListener(eventType, registerUserInteraction);
      });
    };
  }, [user?.uid, profile?.lastCoinDate, awardDailyCoin, toast]);
}
