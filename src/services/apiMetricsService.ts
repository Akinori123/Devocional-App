import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface ApiMetricsData {
  currentDate: string; // YYYY-MM-DD
  geminiToday: number;
  unsplashToday: number;
  cacheHitsToday: number;
  totalGeminiAllTime: number;
  totalUnsplashAllTime: number;
  totalCacheHitsAllTime: number;
  geminiLimit: number;
  unsplashLimit: number;
  lastUpdated?: any;
}

export const DEFAULT_GEMINI_LIMIT = 500;
export const DEFAULT_UNSPLASH_LIMIT = 50;

export function getTodayDateBrasilia(): string {
  const now = new Date();
  // Format in America/Sao_Paulo (Brasilia time)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Record an API usage event or Cache Hit into Firestore settings/api_metrics
 */
export async function recordApiUsage(
  type: 'gemini' | 'unsplash' | 'cache_hit',
  count: number = 1
): Promise<void> {
  try {
    const today = getTodayDateBrasilia();
    const metricsRef = doc(db, 'settings', 'api_metrics');
    const docSnap = await getDoc(metricsRef);

    if (!docSnap.exists()) {
      // Initialize first time
      await setDoc(metricsRef, {
        currentDate: today,
        geminiToday: type === 'gemini' ? count : 0,
        unsplashToday: type === 'unsplash' ? count : 0,
        cacheHitsToday: type === 'cache_hit' ? count : 0,
        totalGeminiAllTime: type === 'gemini' ? count : 0,
        totalUnsplashAllTime: type === 'unsplash' ? count : 0,
        totalCacheHitsAllTime: type === 'cache_hit' ? count : 0,
        geminiLimit: DEFAULT_GEMINI_LIMIT,
        unsplashLimit: DEFAULT_UNSPLASH_LIMIT,
        lastUpdated: serverTimestamp(),
      });
      return;
    }

    const data = docSnap.data();
    if (data.currentDate !== today) {
      // New day: reset today's counters
      await updateDoc(metricsRef, {
        currentDate: today,
        geminiToday: type === 'gemini' ? count : 0,
        unsplashToday: type === 'unsplash' ? count : 0,
        cacheHitsToday: type === 'cache_hit' ? count : 0,
        totalGeminiAllTime: increment(type === 'gemini' ? count : 0),
        totalUnsplashAllTime: increment(type === 'unsplash' ? count : 0),
        totalCacheHitsAllTime: increment(type === 'cache_hit' ? count : 0),
        geminiLimit: data.geminiLimit || DEFAULT_GEMINI_LIMIT,
        unsplashLimit: data.unsplashLimit || DEFAULT_UNSPLASH_LIMIT,
        lastUpdated: serverTimestamp(),
      });
    } else {
      // Same day: increment counters
      const updatePayload: Record<string, any> = {
        lastUpdated: serverTimestamp(),
      };
      if (type === 'gemini') {
        updatePayload.geminiToday = increment(count);
        updatePayload.totalGeminiAllTime = increment(count);
      } else if (type === 'unsplash') {
        updatePayload.unsplashToday = increment(count);
        updatePayload.totalUnsplashAllTime = increment(count);
      } else if (type === 'cache_hit') {
        updatePayload.cacheHitsToday = increment(count);
        updatePayload.totalCacheHitsAllTime = increment(count);
      }
      await updateDoc(metricsRef, updatePayload);
    }
  } catch (error) {
    console.warn('Failed to record API usage metric:', error);
  }
}

/**
 * Subscribe to API metrics changes in real-time
 */
export function subscribeToApiMetrics(
  onUpdate: (metrics: ApiMetricsData) => void,
  onError?: (error: any) => void
) {
  const metricsRef = doc(db, 'settings', 'api_metrics');
  return onSnapshot(
    metricsRef,
    (docSnap) => {
      const today = getTodayDateBrasilia();
      if (docSnap.exists()) {
        const data = docSnap.data() as any;
        const isCurrentDay = data.currentDate === today;
        onUpdate({
          currentDate: today,
          geminiToday: isCurrentDay ? (data.geminiToday || 0) : 0,
          unsplashToday: isCurrentDay ? (data.unsplashToday || 0) : 0,
          cacheHitsToday: isCurrentDay ? (data.cacheHitsToday || 0) : 0,
          totalGeminiAllTime: data.totalGeminiAllTime || 0,
          totalUnsplashAllTime: data.totalUnsplashAllTime || 0,
          totalCacheHitsAllTime: data.totalCacheHitsAllTime || 0,
          geminiLimit: data.geminiLimit || DEFAULT_GEMINI_LIMIT,
          unsplashLimit: data.unsplashLimit || DEFAULT_UNSPLASH_LIMIT,
          lastUpdated: data.lastUpdated,
        });
      } else {
        onUpdate({
          currentDate: today,
          geminiToday: 0,
          unsplashToday: 0,
          cacheHitsToday: 0,
          totalGeminiAllTime: 0,
          totalUnsplashAllTime: 0,
          totalCacheHitsAllTime: 0,
          geminiLimit: DEFAULT_GEMINI_LIMIT,
          unsplashLimit: DEFAULT_UNSPLASH_LIMIT,
        });
      }
    },
    (err) => {
      console.error('Error listening to API metrics:', err);
      if (onError) onError(err);
    }
  );
}

export type SystemHealthStatus = 'normal' | 'warning' | 'critical';

export interface SystemStatusEvaluation {
  status: SystemHealthStatus;
  label: string;
  geminiPercentage: number;
  unsplashPercentage: number;
  highestPercentage: number;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotColor: string;
}

export function evaluateSystemStatus(
  geminiToday: number,
  unsplashToday: number,
  geminiLimit: number = DEFAULT_GEMINI_LIMIT,
  unsplashLimit: number = DEFAULT_UNSPLASH_LIMIT
): SystemStatusEvaluation {
  const geminiPercentage = Math.min(100, Math.round((geminiToday / (geminiLimit || 1)) * 100));
  const unsplashPercentage = Math.min(100, Math.round((unsplashToday / (unsplashLimit || 1)) * 100));
  const highestPercentage = Math.max(geminiPercentage, unsplashPercentage);

  if (highestPercentage >= 90) {
    return {
      status: 'critical',
      label: 'Crítico (Limite Próximo)',
      geminiPercentage,
      unsplashPercentage,
      highestPercentage,
      description: 'Consumo próximo ou no teto diário. Risco iminente de Erro 429 (Too Many Requests).',
      badgeBg: 'bg-rose-100 dark:bg-rose-950/60',
      badgeText: 'text-rose-700 dark:text-rose-300',
      badgeBorder: 'border-rose-300 dark:border-rose-800',
      dotColor: 'bg-rose-500 animate-pulse',
    };
  }

  if (highestPercentage >= 70) {
    return {
      status: 'warning',
      label: 'Atenção (Consumo Elevado)',
      geminiPercentage,
      unsplashPercentage,
      highestPercentage,
      description: 'Volume diário acima de 70% da cota configurada. Monitore o fluxo de novos usuários.',
      badgeBg: 'bg-amber-100 dark:bg-amber-950/60',
      badgeText: 'text-amber-700 dark:text-amber-300',
      badgeBorder: 'border-amber-300 dark:border-amber-800',
      dotColor: 'bg-amber-500 animate-pulse',
    };
  }

  return {
    status: 'normal',
    label: 'Normal (Operando com Folga)',
    geminiPercentage,
    unsplashPercentage,
    highestPercentage,
    description: 'APIs operando em níveis seguros e estáveis. Cache ativo economizando requisições.',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60',
    badgeText: 'text-emerald-700 dark:text-emerald-300',
    badgeBorder: 'border-emerald-300 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
  };
}
