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
import { collection, getDocs, query, limit } from 'firebase/firestore';
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
    const fetchCachedCount = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'bible_explanations'), limit(500)));
        setTotalCachedVerses(snap.size);
      } catch (e) {
        console.warn('Could not fetch cached verses count:', e);
      }
    };
    fetchCachedCount();

    return () => unsubscribe();
  }, []);

  const evalStatus = evaluateSystemStatus(
    metrics.geminiToday,
    metrics.unsplashToday,
    metrics.geminiLimit,
    metrics.unsplashLimit
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-800/80 p-5 rounded-2xl border border-gray-100 dark:border-slate-700/50 shadow-sm backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-white">
              Painel de Auditoria & Monitoramento de APIs
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Acompanhamento em tempo real de consumo de cotas (Gemini e Unsplash), cache global e saúde operacional.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-slate-900/60 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-slate-700">
          <Clock className="w-3.5 h-3.5 text-indigo-500" />
          <span>Hoje: {metrics.currentDate || 'Carregando...'}</span>
        </div>
      </div>

      {/* 3 Main Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Card 1: Gemini AI */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Gemini AI</h4>
                <span className="text-[10px] text-gray-400">Requisições Hoje</span>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
              {evalStatus.geminiPercentage}%
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {metrics.geminiToday}
            </span>
            <span className="text-xs font-semibold text-gray-400">
              / {metrics.geminiLimit} máx/dia
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden my-3">
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

          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-slate-700/50">
            <span>Acumulado Histórico:</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{metrics.totalGeminiAllTime} reqs</span>
          </div>
        </div>

        {/* Card 2: Unsplash */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Unsplash API</h4>
                <span className="text-[10px] text-gray-400">Imagens Mágicas Hoje</span>
              </div>
            </div>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40">
              {evalStatus.unsplashPercentage}%
            </span>
          </div>

          <div className="flex items-baseline gap-2 my-2">
            <span className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {metrics.unsplashToday}
            </span>
            <span className="text-xs font-semibold text-gray-400">
              / {metrics.unsplashLimit} máx/dia
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-gray-100 dark:bg-slate-700/60 h-2 rounded-full overflow-hidden my-3">
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

          <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-slate-700/50">
            <span>Acumulado Histórico:</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{metrics.totalUnsplashAllTime} fotos</span>
          </div>
        </div>

        {/* Card 3: Status do Sistema (Semáforo) */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/50 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-slate-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">Status do Sistema</h4>
                  <span className="text-[10px] text-gray-400">Semáforo de Saúde</span>
                </div>
              </div>
            </div>

            {/* Status Indicator Badge */}
            <div className={`mt-2 p-2.5 rounded-xl border flex items-center gap-2.5 ${evalStatus.badgeBg} ${evalStatus.badgeBorder}`}>
              <div className={`w-3 h-3 rounded-full ${evalStatus.dotColor} shrink-0`} />
              <div className="truncate">
                <div className={`text-xs font-bold ${evalStatus.badgeText}`}>
                  {evalStatus.label}
                </div>
              </div>
            </div>

            <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              {evalStatus.description}
            </p>
          </div>

          <div className="pt-2 mt-3 border-t border-gray-100 dark:border-slate-700/50 flex items-center justify-between text-[11px]">
            <span className="text-gray-400">Proteção 429:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
              Blindagem Ativa
            </span>
          </div>
        </div>
      </div>

      {/* Secondary Dashboard: Cache Economy & Explanations Storage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Cache Performance Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-2xl p-5 border border-emerald-200/60 dark:border-emerald-900/40">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                Economia com Cache no Firestore
              </h4>
              <span className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                Consultas que custaram R$ 0,00 de IA
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
              <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Leituras em Cache Hoje
              </div>
              <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                {metrics.cacheHitsToday}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">Zero consumo de API</div>
            </div>

            <div className="bg-white/80 dark:bg-slate-900/80 p-3 rounded-xl border border-emerald-200/50 dark:border-emerald-900/30">
              <div className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Versículos Catalogados
              </div>
              <div className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                {totalCachedVerses !== null ? totalCachedVerses : '...'}
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">No acervo global</div>
            </div>
          </div>
        </div>

        {/* Security & Anti-429 Explanatory Card */}
        <div className="bg-white dark:bg-slate-800/80 rounded-2xl p-5 border border-gray-100 dark:border-slate-700/50 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-800 dark:text-gray-200 mb-2">
              <Info className="w-4 h-4 text-indigo-500" />
              <span>Como funciona a Blindagem do Sistema</span>
            </div>
            <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-2 leading-relaxed">
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">1.</span>
                <span><strong>Cache Inteligente:</strong> Ao consultar um versículo na Bíblia, o app busca primeiro na coleção <code>bible_explanations</code>. Se já existir, a entrega é instantânea e o Gemini não é acionado.</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-emerald-500 font-bold">2.</span>
                <span><strong>Tratamento Amigável de Erro 429:</strong> Caso ocorra sobrecarga ou limite de requisições, o app intercepta e exibe uma mensagem acolhedora sem quebrar a tela.</span>
              </li>
            </ul>
          </div>

          <div className="text-[11px] text-gray-400 mt-3 pt-2 border-t border-gray-100 dark:border-slate-700/50">
            Atualizado automaticamente em tempo real via Firestore.
          </div>
        </div>
      </div>
    </div>
  );
};
