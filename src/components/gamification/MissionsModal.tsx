import { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Target, 
  Coins, 
  BookOpen, 
  Clock, 
  ClipboardList, 
  CheckCircle2, 
  Gift, 
  ChevronRight, 
  ShieldCheck,
  History,
  Lock,
  ArrowRight,
  Flame,
  ScrollText,
  Loader2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import confetti from 'canvas-confetti';
import { format } from 'date-fns';
import { CoinHistoryModal } from './CoinHistoryModal';
import { CoinIcon } from '../common/CoinIcon';

interface MissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDevotional?: () => void;
}

export function MissionsModal({ isOpen, onClose, onNavigateToDevotional }: MissionsModalProps) {
  const { user, profile, awardDailyCoin } = useAuth();
  const toast = useToast();

  const [activeSeconds, setActiveSeconds] = useState(0);
  const [devotionalReadingDone, setDevotionalReadingDone] = useState(false);
  const [devotionalTimeSpent, setDevotionalTimeSpent] = useState(0);
  const [devotionalRequiredTime, setDevotionalRequiredTime] = useState(15);
  const [devotionalScrolled, setDevotionalScrolled] = useState(false);
  const [claimingMission, setClaimingMission] = useState<'devotional_reading' | 'session_15min' | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  
  // Verificação independente de resgate por missão
  const isReadingClaimedToday = Boolean(
    profile?.claimedDailyMissions?.includes(`devotional_reading_${today}`) || 
    (user && typeof window !== 'undefined' && localStorage.getItem(`claimed_mission_devotional_reading_${user.uid}_${today}`) === 'true')
  );

  const isSessionClaimedToday = Boolean(
    profile?.claimedDailyMissions?.includes(`session_15min_${today}`) || 
    (user && typeof window !== 'undefined' && localStorage.getItem(`claimed_mission_session_15min_${user.uid}_${today}`) === 'true')
  );

  const claimedCountToday = (isReadingClaimedToday ? 1 : 0) + (isSessionClaimedToday ? 1 : 0);
  const allMissionsClaimedToday = claimedCountToday >= 2;
  const userCoins = profile?.coins || 0;

  // Atualiza os dados de progresso das missões em tempo real quando o modal está aberto
  useEffect(() => {
    if (!isOpen || !user) return;

    const readProgress = () => {
      // 1. Missão 15 minutos
      const activeStorageKey = `active_session_${user.uid}_${today}`;
      try {
        const storedActive = localStorage.getItem(activeStorageKey);
        if (storedActive) {
          setActiveSeconds(parseInt(storedActive, 10) || 0);
        } else {
          setActiveSeconds(0);
        }
      } catch (e) {}

      // 2. Missão Leitura Devocional
      const devStorageKey = `devotional_mission_${user.uid}_${today}`;
      try {
        const devStored = localStorage.getItem(devStorageKey);
        if (devStored) {
          const parsed = JSON.parse(devStored);
          const reqTime = parsed.requiredTime || 15;
          setDevotionalRequiredTime(reqTime);
          setDevotionalTimeSpent(parsed.timeSpent || 0);
          setDevotionalScrolled(parsed.scrolled || false);
          setDevotionalReadingDone(parsed.completed || (parsed.timeSpent >= reqTime && parsed.scrolled));
        } else {
          setDevotionalTimeSpent(0);
          setDevotionalRequiredTime(15);
          setDevotionalScrolled(false);
          setDevotionalReadingDone(false);
        }
      } catch (e) {}
    };

    readProgress();
    const interval = setInterval(readProgress, 1000);
    return () => clearInterval(interval);
  }, [isOpen, user?.uid, today]);

  if (!isOpen) return null;

  // Cálculos de Progresso
  const TARGET_SECONDS = 15 * 60; // 900s
  const activeMinutes = Math.floor(activeSeconds / 60);
  const activeSecondsRemainder = activeSeconds % 60;
  const sessionProgressPercent = Math.min(100, Math.round((activeSeconds / TARGET_SECONDS) * 100));
  const isSessionMissionCompleted = activeSeconds >= TARGET_SECONDS;

  const readingTimeTarget = devotionalRequiredTime || 15;
  const readingProgressPercent = devotionalReadingDone 
    ? 100 
    : Math.min(99, Math.round((Math.min(readingTimeTarget, devotionalTimeSpent) / readingTimeTarget) * 50 + (devotionalScrolled ? 50 : 0)));
  const isReadingMissionCompleted = devotionalReadingDone || (devotionalTimeSpent >= readingTimeTarget && devotionalScrolled);

  const handleClaim = async (missionType: 'devotional_reading' | 'session_15min') => {
    if (!user || claimingMission !== null) return;
    if (missionType === 'devotional_reading' && isReadingClaimedToday) return;
    if (missionType === 'session_15min' && isSessionClaimedToday) return;

    setClaimingMission(missionType);
    try {
      const reason = missionType === 'session_15min' 
        ? 'Missão 15 min concluída' 
        : 'Leitura devocional concluída';

      const res = await awardDailyCoin(missionType, reason);
      
      if (res.awarded) {
        // Dispara chuva de confetes gloriosa
        confetti({
          particleCount: 90,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#EAB308', '#10B981', '#FCD34D', '#F43F5E']
        });

        toast.success(`🎉 Moeda resgatada com sucesso! +1 Moeda Florescer adicionada ao seu saldo.`);
      } else {
        if (res.reason === 'already_awarded_today') {
          toast.error("Você já resgatou a recompensa desta missão hoje! Volte amanhã.");
        } else {
          toast.error("Não foi possível resgatar no momento. Tente novamente.");
        }
      }
    } catch (err) {
      console.error("Error claiming reward:", err);
      toast.error("Erro ao resgatar recompensa.");
    } finally {
      setClaimingMission(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
        <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-amber-200/40 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-white p-5 relative shrink-0">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-1">
              <Target className="w-5 h-5 text-amber-200" />
              <h3 className="text-lg font-bold">Missões Diárias Florescer</h3>
            </div>
            <p className="text-xs text-amber-100">
              Conclua uma missão diária para receber Moedas e desbloquear conteúdos secretos!
            </p>

            {/* Saldo de Moedas & Botão de Extrato */}
            <div className="mt-4 bg-white/15 backdrop-blur-md rounded-2xl p-3.5 flex items-center justify-between border border-white/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400/30 flex items-center justify-center border border-amber-300/40 text-amber-100 shadow-inner">
                  <CoinIcon className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] text-amber-100 uppercase tracking-wider font-semibold block">Seu Saldo Atual</span>
                  <span className="text-2xl font-extrabold text-white leading-none">
                    {userCoins} <span className="text-xs font-normal text-amber-100">moedas</span>
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowHistoryModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer border border-white/20"
              >
                <History className="w-3.5 h-3.5" />
                <span>Extrato</span>
              </button>
            </div>
          </div>

          {/* Banner de Status Diário */}
          <div className="px-5 py-3 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200/50 dark:border-amber-900/40 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                Regra Diária: Até 2 moedas por dia (1 por cada missão)
              </span>
            </div>
            {allMissionsClaimedToday ? (
              <span className="inline-flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                2/2 Concluídas
              </span>
            ) : claimedCountToday === 1 ? (
              <span className="inline-flex items-center gap-1 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700">
                <CheckCircle2 className="w-3 h-3 text-amber-600" />
                1/2 Concluída
              </span>
            ) : null}
          </div>

          {/* Lista de Missões */}
          <div className="p-5 flex-1 overflow-y-auto space-y-4">

            {/* MISSÃO 1: Leitura Devocional */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isReadingClaimedToday
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40'
                : isReadingMissionCompleted
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                : 'bg-gray-50 dark:bg-slate-800/70 border-gray-200/80 dark:border-slate-700/80'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    isReadingClaimedToday || isReadingMissionCompleted
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300'
                      : 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                  }`}>
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      Meditar no Devocional de Hoje
                      {(isReadingClaimedToday || isReadingMissionCompleted) && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                      )}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Leia o devocional no seu ritmo e role até o final do texto.
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 shrink-0 bg-amber-100 dark:bg-amber-900/50 px-2.5 py-1 rounded-lg border border-amber-300/60 dark:border-amber-700/60 shadow-2xs">
                  <CoinIcon className="w-4 h-4" />
                  <span>+1</span>
                </span>
              </div>

              {/* Barra de Progresso */}
              <div className="space-y-1.5 mt-3">
                <div className="flex justify-between text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  <span>
                    {isReadingClaimedToday ? (
                      <strong className="text-emerald-600 dark:text-emerald-400">✅ Recompensa Resgatada (+1 Moeda)</strong>
                    ) : isReadingMissionCompleted ? (
                      <strong className="text-emerald-600 dark:text-emerald-400">✅ 100% Concluída — Pronto para resgatar!</strong>
                    ) : (
                      `Progresso: ${Math.min(readingTimeTarget, devotionalTimeSpent)}s / ${readingTimeTarget}s ${devotionalScrolled ? '• Rolagem OK' : ''}`
                    )}
                  </span>
                  <span>{isReadingClaimedToday ? 100 : readingProgressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      isReadingClaimedToday || isReadingMissionCompleted ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${isReadingClaimedToday ? 100 : readingProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* Botão de Ação / Resgate */}
              <div className="mt-3.5 pt-3 border-t border-gray-200/60 dark:border-slate-700/60 flex items-center justify-between">
                {isReadingClaimedToday ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Recompensa desta missão já recebida hoje
                  </span>
                ) : isReadingMissionCompleted ? (
                  <button
                    onClick={() => handleClaim('devotional_reading')}
                    disabled={claimingMission !== null}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-emerald-500/20 text-xs flex items-center justify-center gap-2 animate-pulse cursor-pointer active:scale-98 transition-all disabled:opacity-60"
                  >
                    {claimingMission === 'devotional_reading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Resgatando...</span>
                      </>
                    ) : (
                      <>
                        <Gift className="w-4 h-4" />
                        <span>🎁 Resgatar 1 Moeda Florescer</span>
                      </>
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToDevotional?.();
                    }}
                    className="w-full bg-amber-500/20 hover:bg-amber-500/30 text-yellow-950 dark:text-yellow-300 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>Ir para o Devocional</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* MISSÃO 2: 15 Minutos de Conexão */}
            <div className={`p-4 rounded-2xl border transition-all ${
              isSessionClaimedToday
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40'
                : isSessionMissionCompleted
                ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700'
                : 'bg-gray-50 dark:bg-slate-800/70 border-gray-200/80 dark:border-slate-700/80'
            }`}>
              <div className="flex items-start justify-between gap-3 mb-2.5">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                    isSessionClaimedToday || isSessionMissionCompleted
                      ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300'
                      : 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                  }`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      15 Minutos de Conexão com Deus
                      {(isSessionClaimedToday || isSessionMissionCompleted) && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 inline" />
                      )}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Permaneça ativo navegando, orando ou lendo no aplicativo hoje.
                    </p>
                  </div>
                </div>

                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 shrink-0 bg-amber-100 dark:bg-amber-900/50 px-2.5 py-1 rounded-lg border border-amber-300/60 dark:border-amber-700/60 shadow-2xs">
                  <CoinIcon className="w-4 h-4" />
                  <span>+1</span>
                </span>
              </div>

              {/* Barra de Progresso com Timer em Tempo Real */}
              <div className="space-y-1.5 mt-3">
                <div className="flex justify-between text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  <span>
                    {isSessionClaimedToday ? (
                      <strong className="text-emerald-600 dark:text-emerald-400">✅ Recompensa Resgatada (+1 Moeda)</strong>
                    ) : isSessionMissionCompleted ? (
                      <strong className="text-emerald-600 dark:text-emerald-400">✅ 100% Concluída — Pronto para resgatar!</strong>
                    ) : (
                      <>Tempo Ativo: <strong className="text-gray-800 dark:text-gray-200">{String(activeMinutes).padStart(2, '0')}:{String(activeSecondsRemainder).padStart(2, '0')} / 15:00 min</strong></>
                    )}
                  </span>
                  <span>{isSessionClaimedToday ? 100 : sessionProgressPercent}%</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 rounded-full ${
                      isSessionClaimedToday || isSessionMissionCompleted ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${isSessionClaimedToday ? 100 : sessionProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* Botão de Ação / Resgate */}
              <div className="mt-3.5 pt-3 border-t border-gray-200/60 dark:border-slate-700/60 flex items-center justify-between">
                {isSessionClaimedToday ? (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    Recompensa desta missão já recebida hoje
                  </span>
                ) : isSessionMissionCompleted ? (
                  <button
                    onClick={() => handleClaim('session_15min')}
                    disabled={claimingMission !== null}
                    className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md shadow-emerald-500/20 text-xs flex items-center justify-center gap-2 animate-pulse cursor-pointer active:scale-98 transition-all disabled:opacity-60"
                  >
                    {claimingMission === 'session_15min' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Resgatando...</span>
                      </>
                    ) : (
                      <>
                        <Gift className="w-4 h-4" />
                        <span>🎁 Resgatar 1 Moeda Florescer</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    O cronômetro pausa automaticamente caso você fique inativo.
                  </span>
                )}
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              As missões reiniciam todos os dias à meia-noite.
            </span>
            <button
              onClick={onClose}
              className="px-5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>

      <CoinHistoryModal
        isOpen={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />
    </>
  );
}
