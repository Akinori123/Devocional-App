import { useState, useEffect } from 'react';
import { useAuth, CoinTransaction } from '../../context/AuthContext';
import { X, Coins, ArrowUpRight, ArrowDownLeft, Clock, ShieldCheck, BookOpen, Sparkles, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CoinIcon } from '../common/CoinIcon';

interface CoinHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CoinHistoryModal({ isOpen, onClose }: CoinHistoryModalProps) {
  const { profile, getCoinHistory } = useAuth();
  const [history, setHistory] = useState<CoinTransaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getCoinHistory()
        .then(data => setHistory(data))
        .catch(err => console.error("Error loading coin history:", err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, getCoinHistory]);

  if (!isOpen) return null;

  const userCoins = profile?.coins || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-500 to-yellow-600 text-white p-5 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 mb-1">
            <CoinIcon className="w-5 h-5 text-amber-200" />
            <h3 className="text-lg font-bold">Extrato de Moedas Florescer</h3>
          </div>
          <p className="text-xs text-amber-100">
            Registro seguro e histórico de todas as suas recompensas
          </p>

          {/* Balance card */}
          <div className="mt-4 bg-white/15 backdrop-blur-md rounded-2xl p-4 flex items-center justify-between border border-white/20">
            <div>
              <span className="text-xs text-amber-100 font-medium uppercase tracking-wider block">Saldo Atual</span>
              <span className="text-3xl font-extrabold text-white">{userCoins} <span className="text-lg font-normal text-amber-100">moedas</span></span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-400/30 flex items-center justify-center border border-amber-300/40 text-amber-100 shadow-inner">
              <CoinIcon className="w-7 h-7" />
            </div>
          </div>
        </div>

        {/* Rules and Mission Info */}
        <div className="p-4 bg-amber-50/70 dark:bg-amber-950/30 border-b border-amber-200/50 dark:border-amber-900/30 shrink-0">
          <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            Como Ganhar Moedas Diárias (Máx. 1/dia)
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-amber-950 dark:text-amber-200">
            <div className="flex items-start gap-2 bg-white/70 dark:bg-slate-800/80 p-2.5 rounded-xl border border-amber-200/40 dark:border-slate-700">
              <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Leitura do Devocional</span>
                <span className="text-[11px] text-gray-600 dark:text-gray-400">45s na leitura + scroll até o final</span>
              </div>
            </div>
            <div className="flex items-start gap-2 bg-white/70 dark:bg-slate-800/80 p-2.5 rounded-xl border border-amber-200/40 dark:border-slate-700">
              <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">15 Minutos Ativos</span>
                <span className="text-[11px] text-gray-600 dark:text-gray-400">Navegue e ore no aplicativo</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Transactions List */}
        <div className="p-4 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Histórico de Movimentações
            </h4>
            <span className="text-[11px] text-gray-400">{history.length} registro(s)</span>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500 mb-2" />
              <p className="text-xs">Carregando extrato...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="py-12 text-center text-gray-400 dark:text-gray-500">
              <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-amber-500">
                <CoinIcon className="w-7 h-7" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Nenhuma movimentação ainda</p>
              <p className="text-xs mt-1">Leia seu primeiro devocional por 45s ou navegue 15min para ganhar sua primeira moeda!</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((tx) => {
                const isCredit = tx.type === 'credit' || tx.amount > 0;
                let formattedDate = tx.date;
                try {
                  if (tx.createdAt) {
                    const parsed = typeof tx.createdAt === 'string' ? parseISO(tx.createdAt) : new Date(tx.createdAt);
                    formattedDate = format(parsed, "dd 'de' MMM, HH:mm", { locale: ptBR });
                  }
                } catch (e) {
                  // fallback
                }

                return (
                  <div 
                    key={tx.id}
                    className="p-3 bg-gray-50 dark:bg-slate-800/60 rounded-2xl flex items-center justify-between border border-gray-100 dark:border-slate-800/80 hover:bg-gray-100/70 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isCredit 
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/30' 
                          : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300/30'
                      }`}>
                        {isCredit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-gray-900 dark:text-white leading-tight">
                          {tx.reason || (isCredit ? 'Ganho Diário de Moeda' : 'Desbloqueio de Módulo')}
                        </p>
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 block">
                          {formattedDate} {tx.balanceAfter !== undefined && `• Saldo: ${tx.balanceAfter}`}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className={`text-sm font-bold block ${
                        isCredit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {isCredit ? `+${tx.amount}` : tx.amount}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-200 dark:bg-slate-800 hover:bg-gray-300 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
