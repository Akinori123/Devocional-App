import { useState, useMemo, useEffect } from 'react';
import { useDevotionals } from '../../context/DevotionalContext';
import { useAuth } from '../../context/AuthContext';
import { Plus, Wand2, BookOpen, Trash2, X, Check, Search, ChevronLeft, ChevronRight, MessageSquareHeart, CheckCircle2, Lock, Sparkles, Share2, Coins, Crown, Loader2, ShieldCheck } from 'lucide-react';
import { DevotionalItem } from '../../data/devotionals';
import { TabType } from '../../types';
import { format } from 'date-fns';
import { getJourneyStatus } from '../../utils/journey';
import { getThemeStyle } from '../../utils/themeStyle';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { VipVideoBanner } from '../video/VipVideoBanner';
import { useToast } from '../../context/ToastContext';
import { CoinHistoryModal } from '../gamification/CoinHistoryModal';
import { MissionsModal } from '../gamification/MissionsModal';
import { CoinIcon } from '../common/CoinIcon';

interface JourneyListProps {
  onSelectDevotional: (devotional: DevotionalItem, allRead: boolean) => void;
  onCreateNew: (theme?: string) => void;
  onChangeTab?: (tab: TabType, subTab?: 'diary' | 'verses' | 'videos' | 'subscription' | 'settings' | 'admin') => void;
}

export function JourneyList({ onSelectDevotional, onCreateNew, onChangeTab }: JourneyListProps) {
  const toast = useToast();
  const { adminDevotionals, readHistory, customDevotionals, deleteCustomDevotional, themeLastRead, hasMoreGlobal, loadMoreGlobalDevotionals } = useDevotionals();
  const { user, profile, spendCoins } = useAuth();
  const userName = profile?.name ? profile.name.split(' ')[0] : 'Irmã(o)';
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [customCurrentPage, setCustomCurrentPage] = useState(1);
  const CUSTOM_PER_PAGE = 6;
  const [lockedTheme, setLockedTheme] = useState<string | null>(null);
  const [unlockingSecretTheme, setUnlockingSecretTheme] = useState<{ theme: string; cost: number } | null>(null);
  const [isSpending, setIsSpending] = useState(false);
  const [showCoinHistory, setShowCoinHistory] = useState(false);
  const [showMissionsModal, setShowMissionsModal] = useState(false);
  const THEMES_PER_PAGE = 8; // Reduce per page since cards are bigger
  
  const streakCount = profile?.streakCount || 0;
  const plant = getJourneyStatus(streakCount);
  const userCoins = profile?.coins || 0;
  const isAdmin = !!(profile?.isAdmin || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com');
  const isVipUser = !!(profile?.isPremium || isAdmin);

  const themes = useMemo(() => {
    // Apenas temas dos módulos globais/padrão oficiais criados pela administração
    return Array.from(new Set(adminDevotionals.map(d => d.theme))).sort() as string[];
  }, [adminDevotionals]);

  const filteredThemes = useMemo(() => {
    return themes.filter(theme => theme.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [themes, searchQuery]);

  const totalPages = Math.ceil(filteredThemes.length / THEMES_PER_PAGE) || 1;
  const paginatedThemes = filteredThemes.slice((currentPage - 1) * THEMES_PER_PAGE, currentPage * THEMES_PER_PAGE);

  // Custom user devotionals pagination
  const totalCustomPages = Math.ceil(customDevotionals.length / CUSTOM_PER_PAGE) || 1;
  const paginatedCustomDevotionals = customDevotionals.slice(
    (customCurrentPage - 1) * CUSTOM_PER_PAGE, 
    customCurrentPage * CUSTOM_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Ao mudar de página para a próxima ou última, se houver mais no servidor, carrega automaticamente!
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(p => p + 1);
    }
    // Se estiver na última página ou penúltima e ainda existirem temas no servidor Firestore, carrega automaticamente
    if (hasMoreGlobal) {
      loadMoreGlobalDevotionals();
    }
  };

  const handlePrevPage = () => {
    setCurrentPage(p => Math.max(1, p - 1));
  };

  const handleShareJourney = (theme: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}${window.location.pathname}?tab=journey&theme=${encodeURIComponent(theme)}`;
    const shareData = {
      title: `Jornada ${theme} - Florescer`,
      text: `Venha caminhar comigo na jornada devocional "${theme}" no aplicativo Florescer!`,
      url: shareUrl
    };

    if (navigator.share) {
      navigator.share(shareData).catch(() => {
        // Fallback to clipboard
        navigator.clipboard.writeText(shareUrl);
        toast.success("Link da jornada copiado!");
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link da jornada copiado!");
    }
  };

  const handleThemeClick = (theme: string) => {
    const themeDevotionals = adminDevotionals.filter(d => d.theme === theme).sort((a, b) => {
      if (a.createdAt && b.createdAt) {
         const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
         const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
         if (timeA !== timeB) return timeA - timeB;
      }
      const numA = parseInt(a.id.replace(/\D/g, ''));
      const numB = parseInt(b.id.replace(/\D/g, ''));
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
         return numA - numB;
      }
      return a.id.localeCompare(b.id);
    });

    const firstDev = themeDevotionals[0];
    const isSecret = firstDev?.visibility === 'secret' || (firstDev as any)?.isSecret === true;
    const isVip = firstDev?.visibility === 'vip' || (firstDev as any)?.isVip === true;
    const visibility = isSecret ? 'secret' : (isVip ? 'vip' : (firstDev?.visibility || 'free'));
    const coinCost = firstDev?.coinCost ?? (firstDev as any)?.unlockCost ?? 30;

    // Check VIP gate
    if (visibility === 'vip' && !isVipUser) {
      toast.error("Este módulo é exclusivo para assinantes VIP!");
      onChangeTab?.('profile', 'subscription');
      return;
    }

    // Check Secret gate: Admin/VIP also see the lock unless unlocked or using Admin bypass
    const isUnlockedSecret = Boolean(
      profile?.unlocked_modules?.includes(theme) || 
      profile?.unlockedSecretModules?.includes(theme)
    );
    if (visibility === 'secret' && !isUnlockedSecret) {
      setUnlockingSecretTheme({ theme, cost: coinCost });
      return;
    }

    const firstUnreadIndex = themeDevotionals.findIndex(d => !readHistory.includes(d.id));
    const today = format(new Date(), 'yyyy-MM-dd');
    
    if (user) {
      updateDoc(doc(db, 'users', user.uid), { activeTheme: theme }).catch(console.warn);
    }
    
    if (firstUnreadIndex !== -1) {
      if (themeLastRead[theme] === today) {
        setLockedTheme(theme);
        return;
      }
      onSelectDevotional(themeDevotionals[firstUnreadIndex], false);
    } else {
      // If all are read, open the first one to review
      onSelectDevotional(themeDevotionals[0], true);
    }
  };

  const handleAdminFreeAccess = (themeName: string) => {
    setUnlockingSecretTheme(null);
    const themeDevotionals = adminDevotionals.filter(d => d.theme === themeName).sort((a, b) => {
      if (a.createdAt && b.createdAt) {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
        if (timeA !== timeB) return timeA - timeB;
      }
      const numA = parseInt(a.id.replace(/\D/g, ''));
      const numB = parseInt(b.id.replace(/\D/g, ''));
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return a.id.localeCompare(b.id);
    });

    if (themeDevotionals.length === 0) {
      toast.error("Nenhum devocional encontrado neste módulo.");
      return;
    }

    const firstUnreadIndex = themeDevotionals.findIndex(d => !readHistory.includes(d.id));
    const today = format(new Date(), 'yyyy-MM-dd');

    if (user) {
      updateDoc(doc(db, 'users', user.uid), { activeTheme: themeName }).catch(console.warn);
    }

    if (firstUnreadIndex !== -1) {
      if (themeLastRead[themeName] === today) {
        setLockedTheme(themeName);
        return;
      }
      onSelectDevotional(themeDevotionals[firstUnreadIndex], false);
    } else {
      onSelectDevotional(themeDevotionals[0], true);
    }
  };

  const handleConfirmUnlockSecret = async () => {
    if (!unlockingSecretTheme) return;
    const { theme, cost } = unlockingSecretTheme;

    if (userCoins < cost) {
      toast.error(`Você precisa de ${cost} moedas para desbloquear. Seu saldo atual é de ${userCoins} moedas.`);
      return;
    }

    setIsSpending(true);
    try {
      const success = await spendCoins(cost, theme);
      if (success) {
        toast.success(`🎉 Módulo "${theme}" desbloqueado com sucesso!`);
        setUnlockingSecretTheme(null);
      } else {
        toast.error("Não foi possível desbloquear o módulo. Tente novamente.");
      }
    } catch (e: any) {
      console.error("Error spending coins:", e);
      toast.error("Erro ao desbloquear módulo.");
    } finally {
      setIsSpending(false);
    }
  };

  return (
    <div className="pb-36 min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col relative transition-colors duration-200">
      {/* Header */}
      <div className="bg-yellow-400 dark:bg-slate-900 text-yellow-950 dark:text-white rounded-b-3xl shadow-sm transition-colors duration-200 border-b border-yellow-500/20 dark:border-slate-800 overflow-hidden">
        {/* Top Bar with Logo & Avatar */}
        <div className="bg-yellow-400 dark:bg-slate-800 px-6 pt-5 pb-2.5 flex justify-between items-center transition-colors duration-200 border-b border-yellow-950/20 dark:border-slate-700/60">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/40 dark:bg-slate-700/80 p-1 rounded-2xl backdrop-blur-md shadow-sm overflow-hidden flex items-center justify-center w-11 h-11 shrink-0 border border-white/40 dark:border-slate-600">
              <img src="/images/rosa.png" alt="Florescer" className="w-full h-full object-cover" />
            </div>
            <span className="font-serif font-bold text-yellow-950 dark:text-yellow-400 text-xl tracking-tight">Florescer</span>
          </div>
          
          <div className="flex items-center gap-2.5">
            {/* Coins Balance Indicator */}
            <button
              onClick={() => setShowMissionsModal(true)}
              className="bg-amber-500/15 hover:bg-amber-500/25 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 text-amber-900 dark:text-amber-300 border border-amber-500/30 px-3 py-1.5 rounded-full flex items-center gap-1.5 text-xs font-bold shadow-xs hover:scale-105 transition-all cursor-pointer shrink-0"
              title="Ver Missões Diárias e Saldo de Moedas"
            >
              <CoinIcon className="w-4 h-4" />
              <span>{userCoins}</span>
            </button>

            <button 
              onClick={() => onChangeTab?.('profile')} 
              className="w-11 h-11 rounded-full border-2 border-white/60 dark:border-slate-600 overflow-hidden shadow-sm flex items-center justify-center bg-yellow-100 dark:bg-slate-700 hover:scale-105 transition-transform shrink-0"
            >
              {profile?.photoURL || user?.photoURL ? (
                <img src={profile?.photoURL || user?.photoURL || ''} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="text-yellow-900 dark:text-yellow-400 font-bold text-base">{userName.charAt(0).toUpperCase()}</span>
              )}
            </button>
          </div>
        </div>

        <div className="px-6 pt-3 pb-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold font-serif mb-0.5 text-yellow-950 dark:text-white">Jornada</h1>
            <p className="text-yellow-900 dark:text-gray-300 text-sm">Trilhas de crescimento espiritual.</p>
          </div>
          <div className="flex flex-col items-center justify-center bg-white/40 dark:bg-slate-800/80 rounded-2xl p-2.5 backdrop-blur-sm shadow-sm border border-white/30 dark:border-slate-700">
            <span className="text-2xl mb-0.5" title="Sua ofensiva floresce!">{plant.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-950 dark:text-yellow-400">{plant.label}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 mt-6 space-y-8 pb-6">
        {/* Acervo de Vídeos VIP Banner */}
        <section>
          <VipVideoBanner 
            onClick={() => onChangeTab?.('videoHistory')} 
            variant="full"
          />
        </section>

        {/* Categories Grid */}
        <section>
          <div className="flex flex-col gap-3 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-yellow-500" />
              Temas Diários
            </h2>
            <div className="sticky top-3 z-30 bg-gray-50/95 dark:bg-slate-900/95 backdrop-blur-md py-1.5 -mx-1 px-1 rounded-2xl">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Buscar temas..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </div>
            </div>
          </div>
          
          {filteredThemes.length === 0 ? (
            <p className="text-sm text-gray-500 italic text-center py-4">Nenhum tema encontrado.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {paginatedThemes.map(theme => {
                   const themeDevs = adminDevotionals.filter(d => d.theme === theme).sort((a, b) => {
                      if (a.createdAt && b.createdAt) {
                         const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
                         const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
                         if (timeA !== timeB) return timeA - timeB;
                      }
                      const numA = parseInt(a.id.replace(/\D/g, ''));
                      const numB = parseInt(b.id.replace(/\D/g, ''));
                      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                         return numA - numB;
                      }
                      return a.id.localeCompare(b.id);
                    });

                    const firstDev = themeDevs[0];
                    const isSecret = firstDev?.visibility === 'secret' || (firstDev as any)?.isSecret === true;
                    const isVip = firstDev?.visibility === 'vip' || (firstDev as any)?.isVip === true;
                    const visibility = isSecret ? 'secret' : (isVip ? 'vip' : (firstDev?.visibility || 'free'));
                    const coinCost = firstDev?.coinCost ?? (firstDev as any)?.unlockCost ?? 30;
                    const isUnlockedSecret = Boolean(
                      profile?.unlocked_modules?.includes(theme) || 
                      profile?.unlockedSecretModules?.includes(theme)
                    );
                    const isSecretLocked = visibility === 'secret' && !isUnlockedSecret;
                    const isVipLocked = visibility === 'vip' && !isVipUser;

                    const total = themeDevs.length;
                    const readCount = themeDevs.filter(d => readHistory.includes(d.id)).length;
                    
                    const DAYS_PER_MODULE = 7;
                    const totalModules = Math.ceil(total / DAYS_PER_MODULE) || 1;
                    
                    let currentModule = 1;
                    if (total === 0) {
                      currentModule = 1;
                    } else if (readCount === total) {
                      currentModule = totalModules;
                    } else {
                      currentModule = Math.floor(readCount / DAYS_PER_MODULE) + 1;
                    }
                    
                    let totalInCurrentModule = DAYS_PER_MODULE;
                    if (total === 0) {
                      totalInCurrentModule = 0;
                    } else if (currentModule === totalModules) {
                      totalInCurrentModule = (total % DAYS_PER_MODULE === 0) ? DAYS_PER_MODULE : total % DAYS_PER_MODULE;
                    }
                    
                    let moduleReadCount = total === 0 ? 0 : readCount - ((currentModule - 1) * DAYS_PER_MODULE);

                    const progressPercent = totalInCurrentModule > 0 ? Math.round((moduleReadCount / totalInCurrentModule) * 100) : 0;
                    
                    let displayName = theme;
                    const isDiaAvulso = theme.toLowerCase() === 'dia avulso' || theme.toLowerCase().includes('avulso');
                    
                    const cardTitle = isDiaAvulso 
                      ? (themeDevs.length === 1 ? (themeDevs[0].title || theme) : theme)
                      : `Módulo ${currentModule} • ${displayName}`;
                    
                    const themeStyle = getThemeStyle(displayName);
                    const isAllModuleCompleted = totalInCurrentModule > 0 && moduleReadCount === totalInCurrentModule;

                    return (
                    <div
                      key={theme}
                      onClick={() => handleThemeClick(theme)}
                      className="w-full text-left bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-700 hover:border-yellow-200 dark:hover:border-slate-600 transition-all group flex items-center gap-3.5 cursor-pointer relative"
                    >
                      {/* Deterministic Avatar */}
                      <div className={`w-12 h-12 rounded-xl ${isSecretLocked ? 'bg-gradient-to-br from-amber-600 to-purple-800' : themeStyle.gradient} flex items-center justify-center text-white font-bold text-xl shadow-xs shrink-0 relative overflow-hidden`}>
                        {isSecretLocked ? (
                          <Lock className="w-5 h-5 text-amber-200 animate-pulse" />
                        ) : isVipLocked ? (
                          <Crown className="w-5 h-5 text-yellow-200" />
                        ) : isAllModuleCompleted ? (
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        ) : (
                          <span className="font-serif tracking-tight drop-shadow-xs">{themeStyle.initial}</span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        {/* Linha 1: Apenas o Título do Módulo */}
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors text-sm leading-tight line-clamp-2">
                          {cardTitle}
                        </h3>

                        {/* Linha 2 (Rodapé do Card): Ícone de compartilhar, moedas e progresso alinhados */}
                        <div className="flex items-center justify-between gap-3 mt-2">
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Badges de Visibilidade / Moedas */}
                            {isSecretLocked && (
                              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-700/60 shrink-0 flex items-center gap-1">
                                <CoinIcon className="w-3.5 h-3.5" /> {coinCost}
                              </span>
                            )}
                            {isVipLocked && (
                              <span className="bg-yellow-100 dark:bg-yellow-950/60 text-yellow-900 dark:text-yellow-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-300 dark:border-yellow-700/60 shrink-0 flex items-center gap-1">
                                <span>👑</span> VIP
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 shrink-0 ml-auto">
                            {/* Botão de Compartilhar Link */}
                            <button
                              onClick={(e) => handleShareJourney(theme, e)}
                              className="p-1 text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                              title="Compartilhar esta jornada (Deep Link)"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Tag de Progresso */}
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isAllModuleCompleted
                                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                                : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300'
                            }`}>
                              {moduleReadCount}/{totalInCurrentModule}
                            </span>
                          </div>
                        </div>
                        
                        {/* Barra de Progresso */}
                        <div className="w-full h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
                          <div 
                            className={`h-full ${isAllModuleCompleted ? 'bg-emerald-500' : 'bg-yellow-400 dark:bg-yellow-500'} rounded-full transition-all duration-500 ease-out`}
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {(totalPages > 1 || hasMoreGlobal) && (
                <div className="flex items-center justify-between mt-6 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2 shadow-sm transition-colors duration-200">
                  <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors flex items-center gap-1"
                    title="Página Anterior"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Página {currentPage} {totalPages > 1 ? `de ${totalPages}` : ''}
                  </span>
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages && !hasMoreGlobal}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors flex items-center gap-1"
                    title="Próxima Página"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Custom Devotionals (UGC) */}
        {customDevotionals.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-yellow-500" />
                Meus Devocionais ({customDevotionals.length})
              </h2>
            </div>
            
            <div className="space-y-3">
              {paginatedCustomDevotionals.map(dev => (
                <div key={dev.id} className="relative group">
                  <button
                    onClick={() => onSelectDevotional(dev, false)}
                    className="w-full text-left bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col gap-2 hover:border-yellow-200 dark:hover:border-slate-600 transition-colors pr-12"
                  >
                    <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider w-fit">
                      {dev.theme}
                    </span>
                    <h3 className="font-bold text-gray-900 dark:text-white leading-tight">{dev.title}</h3>
                  </button>
                  {confirmDeleteId === dev.id ? (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center bg-red-50 rounded-full shadow-sm p-1 gap-1 border border-red-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomDevotional(dev.id);
                          setConfirmDeleteId(null);
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-200 rounded-full transition-colors"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmDeleteId(null);
                        }}
                        className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(dev.id);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Custom Devotionals Pagination */}
            {totalCustomPages > 1 && (
              <div className="flex items-center justify-between mt-4 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2 shadow-sm transition-colors duration-200">
                <button
                  onClick={() => setCustomCurrentPage(p => Math.max(1, p - 1))}
                  disabled={customCurrentPage === 1}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
                  title="Página Anterior"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  Página {customCurrentPage} de {totalCustomPages}
                </span>
                <button
                  onClick={() => setCustomCurrentPage(p => Math.min(totalCustomPages, p + 1))}
                  disabled={customCurrentPage === totalCustomPages}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
                  title="Próxima Página"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* FAB to create new devotional */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-md px-5 pointer-events-none z-40 flex justify-end">
        <button
          onClick={() => onCreateNew()}
          className="pointer-events-auto w-14 h-14 bg-yellow-500 text-white rounded-full shadow-xl hover:bg-yellow-600 active:scale-90 transition-all flex items-center justify-center"
          title="Criar Devocional com IA"
        >
          <Plus className="w-6 h-6" />
        </button>
      </div>

      {/* Modal Desbloquear Módulo Secreto (Moedas) */}
      {unlockingSecretTheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95">
            <button 
              onClick={() => setUnlockingSecretTheme(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-5 mt-2">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 mx-auto rounded-3xl flex items-center justify-center mb-3 text-3xl shadow-sm border border-amber-200 dark:border-amber-800">
                🔮
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Módulo Secreto</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                A jornada <strong>"{unlockingSecretTheme.theme}"</strong> é um módulo especial que pode ser liberado com suas moedas conquistadas!
              </p>
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-4 border border-amber-200 dark:border-amber-800/50 mb-4 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400">Seu Saldo:</span>
                <span className="font-bold text-yellow-700 dark:text-yellow-400 flex items-center gap-1.5">
                  <CoinIcon className="w-4 h-4" /> {userCoins} Moedas
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-600 dark:text-gray-400">Custo de Desbloqueio:</span>
                <span className="font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                  <CoinIcon className="w-4 h-4" /> {unlockingSecretTheme.cost} Moedas
                </span>
              </div>
            </div>

            {isAdmin && (
              <div className="bg-purple-50 dark:bg-purple-950/40 p-3.5 rounded-2xl border border-purple-200 dark:border-purple-800/60 mb-4 text-xs">
                <span className="font-bold flex items-center gap-1.5 text-purple-900 dark:text-purple-300">
                  <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  Acesso de Administrador
                </span>
                <p className="mt-1 text-[11px] text-purple-700 dark:text-purple-400 leading-tight">
                  Como Admin, você tem passe livre para inspecionar este módulo sem gastar moedas, ou pode usar suas moedas para testar o fluxo de usuário.
                </p>
                <button
                  onClick={() => handleAdminFreeAccess(unlockingSecretTheme.theme)}
                  className="w-full mt-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-98 transition-all cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Abrir com Passe Livre (Admin)</span>
                </button>
              </div>
            )}

            {userCoins >= unlockingSecretTheme.cost ? (
              <button
                onClick={handleConfirmUnlockSecret}
                disabled={isSpending}
                className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-md text-xs disabled:opacity-50 cursor-pointer"
              >
                {isSpending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Desbloqueando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Desbloquear por {unlockingSecretTheme.cost} Moedas
                  </>
                )}
              </button>
            ) : (
              <div className="space-y-2">
                <button
                  disabled
                  className="w-full bg-gray-200 dark:bg-slate-800 text-gray-400 dark:text-gray-500 py-3 px-4 rounded-xl font-bold text-xs cursor-not-allowed"
                >
                  Faltam {unlockingSecretTheme.cost - userCoins} Moedas
                </button>
                <p className="text-[11px] text-center text-gray-500 dark:text-gray-400">
                  💡 Dica: Conclua as Missões Diárias (Leitura e Conexão) para acumular até 2 moedas todo dia!
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Lock Modal */}
      {lockedTheme && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 max-w-sm w-full shadow-2xl relative">
            <button 
              onClick={() => setLockedTheme(null)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="text-center mb-6 mt-2">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 text-green-500 mx-auto rounded-2xl flex items-center justify-center mb-4 text-3xl">
                ✔️
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Leitura concluída!</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Você já concluiu a leitura de <strong>{lockedTheme}</strong> de hoje. Volte amanhã para o próximo dia da jornada!
              </p>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-4 border border-yellow-100 dark:border-yellow-900/50">
              <p className="text-xs text-yellow-800 dark:text-yellow-300 text-center font-medium mb-3">
                Precisa de mais conforto agora?
              </p>
              <button
                onClick={() => {
                  const themeToPass = lockedTheme;
                  setLockedTheme(null);
                  onCreateNew(themeToPass || undefined);
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm text-sm mb-2"
              >
                <Wand2 className="w-4 h-4" />
                Gerar devocional com IA
              </button>
              <button
                onClick={() => {
                  if (lockedTheme) {
                    const themeDevotionals = adminDevotionals.filter(d => d.theme === lockedTheme).sort((a, b) => {
                      if (a.createdAt && b.createdAt) {
                         const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
                         const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
                         if (timeA !== timeB) return timeA - timeB;
                      }
                      const numA = parseInt(a.id.replace(/\D/g, ''));
                      const numB = parseInt(b.id.replace(/\D/g, ''));
                      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
                         return numA - numB;
                      }
                      return a.id.localeCompare(b.id);
                    });
                    const readInTheme = themeDevotionals.filter(d => readHistory.includes(d.id));
                    const lastReadDevotional = readInTheme.length > 0 
                      ? readInTheme[readInTheme.length - 1] 
                      : (themeDevotionals.length > 0 ? themeDevotionals[0] : null);
                    
                    setLockedTheme(null);
                    if (lastReadDevotional) {
                      onSelectDevotional(lastReadDevotional, true);
                    }
                  }
                }}
                className="w-full bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-sm border border-gray-200 dark:border-slate-700 text-sm"
              >
                <BookOpen className="w-4 h-4" />
                Ler novamente a de hoje
              </button>
            </div>
          </div>
        </div>
      )}

      <CoinHistoryModal
        isOpen={showCoinHistory}
        onClose={() => setShowCoinHistory(false)}
      />

      <MissionsModal
        isOpen={showMissionsModal}
        onClose={() => setShowMissionsModal(false)}
        onNavigateToDevotional={() => {
          setShowMissionsModal(false);
          onChangeTab?.('journey');
        }}
      />
    </div>
  );
}
