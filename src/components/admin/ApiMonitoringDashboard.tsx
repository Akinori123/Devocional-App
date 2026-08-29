import React, { useEffect, useState } from 'react';
import { 
  Activity, 
  Cpu, 
  Image as ImageIcon, 
  ShieldCheck, 
  AlertTriangle, 
  Database, 
  Sparkles, 
  RefreshCw,
  TrendingUp,
  Info,
  Clock,
  Layers
} from 'lucide-react';
import { 
  subscribeToApiMetrics, 
  ApiMetricsData, 
  DEFAULT_GEMINI_LIMIT, 
  DEFAULT_UNSPLASH_LIMIT,
  evaluateSystemStatus
} from '../../services/apiMetricsService';
import { collection, getDocs, query, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';

export const ApiMonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<ApiMetricsData>({
    currentDate: '',
    geminiToday: 0,
    unsplashToday: 0,
    cacheHitsToday: 0,
    totalGeminiAllTime: 0,
    totalUnsplashAllTime: 0,
    totalCacheHitsAllTime: 0,
    geminiLimit: DEFAULT_GEMINI_LIMIT,
    unsplashLimit: DEFAULT_UNSPLASH_LIMIT,
  });
  const [totalCachedVerses, setTotalCachedVerses] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  useEffect(() => {
    const unsubscribe = subscribeToApiMetrics((data) => {
      setMetrics(data);
      setLoading(false);
      setLastRefreshed(new Date());
    });

    // Count cached explanations in Firestore
    let unsubCached: (() => void) | undefined;
    try {
      unsubCached = onSnapshot(collection(db, 'bible_explanations'), (snap) => {
        setTotalCachedVerses(snap.size);
      }, (e) => {
        console.warn('Could not listen to cached verses count:', e);
        setTotalCachedVerses(0);
      });
    } catch (e) {
      console.warn('Could not subscribe to cached verses count:', e);
      setTotalCachedVerses(0);
    }

    return () => {
      unsubscribe();
      if (unsubCached) unsubCached();
    };
  }, []);

  const evalStatus = evaluateSystemStatus(
    metrics.geminiToday,
    metrics.unsplashToday,
    metrics.geminiLimit,
    metrics.unsplashLimit
  );

  const formatBrazilianDate = (dateStr?: string) => {
    if (!dateStr) return 'Carregando...';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-800/80 p-5 sm:p-6 rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white">
              Painel de Auditoria & Monitoramento de APIs
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">
            Acompanhamento em tempo real de consumo de cotas (Gemini e Unsplash), cache global e saúde operacional.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-900/60 px-3.5 py-2 rounded-xl border border-gray-200/80 dark:border-slate-700 shrink-0">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span>Hoje: <strong className="text-gray-900 dark:text-white">{formatBrazilianDate(metrics.currentDate)}</strong></span>
        </div>
      </div>

      {/* 3 Main Cards Grid - 1 Col stacked on mobile / narrow containers, 3 Cols on large desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
        {/* Card 1: Gemini AI */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-gray-100 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                    Gemini AI
                  </h4>
                  <p className="text-[11px] sm:text-xs text-gray-400 truncate">
                    Requisições Hoje
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40 shrink-0">
                {evalStatus.geminiPercentage}%
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-3">
              <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                {metrics.geminiToday}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-gray-400">
                / {metrics.geminiLimit} máx/dia
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 dark:bg-slate-700/60 h-2.5 rounded-full overflow-hidden my-3">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  evalStatus.geminiPercentage >= 90
                    ? 'bg-rose-500'
                    : evalStatus.geminiPercentage >= 70
                    ? 'bg-amber-500'
                    : 'bg-purple-600 dark:bg-purple-500'
                }`}
                style={{ width: `${evalStatus.geminiPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-slate-700/50 mt-2 gap-2">
            <span className="truncate">Acumulado Histórico:</span>
            <span className="font-bold text-gray-800 dark:text-gray-200 shrink-0">{metrics.totalGeminiAllTime} reqs</span>
          </div>
        </div>

        {/* Card 2: Unsplash */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-gray-100 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all flex flex-col justify-between relative overflow-hidden">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white truncate">
                    Unsplash API
                  </h4>
                  <p className="text-[11px] sm:text-xs text-gray-400 truncate">
                    Imagens Mágicas Hoje
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 shrink-0">
                {evalStatus.unsplashPercentage}%
              </span>
            </div>

            <div className="flex items-baseline gap-2 my-3">
              <span className="text-3xl sm:text-4xl font-black text-gray-900 dark:text-white tracking-tight">
                {metrics.unsplashToday}
              </span>
              <span className="text-xs sm:text-sm font-semibold text-gray-400">
                / {metrics.unsplashLimit} máx/dia
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-gray-100 dark:bg-slate-700/60 h-2.5 rounded-full overflow-hidden my-3">
              <div 
                className={`h-full transition-all duration-500 rounded-full ${
                  evalStatus.unsplashPercentage >= 90
                    ? 'bg-rose-500'
                    : evalStatus.unsplashPercentage >= 70
                    ? 'bg-amber-500'
                    : 'bg-blue-600 dark:bg-blue-500'
                }`}
                style={{ width: `${evalStatus.unsplashPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs sm:text-sm text-gray-500 dark:text-gray-400 pt-3 border-t border-gray-100 dark:border-slate-700/50 mt-2 gap-2">
            <span className="truncate">Acumulado Histórico:</span>
            <span className="font-bold text-gray-800 dark:text-gray-200 shrink-0">{metrics.totalUnsplashAllTime} fotos</span>
          </div>
        </div>

        {/* Card 3: Status do Sistema (Semáforo) */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-gray-100 dark:border-slate-700/60 shadow-sm hover:shadow-md transition-all relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white">
                    Status do Sistema
                  </h4>
                  <span className="text-[11px] sm:text-xs text-gray-400">Semáforo de Saúde</span>
                </div>
              </div>
            </div>

            {/* Status Indicator Badge */}
            <div className={`mt-2 p-3 rounded-xl border flex items-center gap-2.5 ${evalStatus.badgeBg} ${evalStatus.badgeBorder}`}>
              <div className={`w-3.5 h-3.5 rounded-full ${evalStatus.dotColor} shrink-0 animate-pulse`} />
              <div className="min-w-0">
                <div className={`text-xs sm:text-sm font-bold ${evalStatus.badgeText} whitespace-nowrap`}>
                  {evalStatus.label}
                </div>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-2.5 leading-relaxed">
              {evalStatus.description}
            </p>
          </div>

          <div className="pt-3 mt-3 border-t border-gray-100 dark:border-slate-700/50 flex items-center justify-between text-xs sm:text-sm gap-2">
            <span className="text-gray-400 truncate">Proteção 429:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 shrink-0 whitespace-nowrap">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
              Blindagem Ativa
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Dashboard: Cache Economy & Explanations Storage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {/* Cache Performance Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-2xl p-5 sm:p-6 border border-emerald-200/60 dark:border-emerald-900/40 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-bold text-emerald-900 dark:text-emerald-200">
                  Economia com Cache no Firestore
                </h4>
                <span className="text-xs text-emerald-700/80 dark:text-emerald-400/80">
                  Consultas que custaram R$ 0,00 de IA
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div className="bg-white/90 dark:bg-slate-900/90 p-4 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Leituras em Cache Hoje
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                  {metrics.cacheHitsToday}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Zero consumo de API</div>
              </div>

              <div className="bg-white/90 dark:bg-slate-900/90 p-4 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Versículos Catalogados
                </div>
                <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 mt-1">
                  {totalCachedVerses !== null ? totalCachedVerses : '...'}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">No acervo global</div>
              </div>
            </div>
          </div>
        </div>

        {/* Security & Anti-429 Explanatory Card */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-5 sm:p-6 border border-gray-100 dark:border-slate-700/60 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-gray-900 dark:text-white mb-3">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <span>Como funciona a Blindagem do Sistema</span>
            </div>
            <ul className="text-xs sm:text-sm text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-500 font-bold shrink-0">1.</span>
                <span><strong>Cache Inteligente:</strong> Ao consultar um versículo na Bíblia, o app busca primeiro na coleção <code>bible_explanations</code>. Se já existir, a entrega é instantânea e o Gemini não é acionado.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="text-emerald-500 font-bold shrink-0">2.</span>
                <span><strong>Tratamento Amigável de Erro 429:</strong> Caso ocorra sobrecarga ou limite de requisições, o app intercepta e exibe uma mensagem acolhedora sem quebrar a tela.</span>
              </li>
            </ul>
          </div>

          <div className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100 dark:border-slate-700/50">
            Atualizado automaticamente em tempo real via Firestore.
          </div>
        </div>
      </div>
    </div>
  );
};
