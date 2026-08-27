import { useState, useMemo, useEffect } from 'react';
import { useDevotionals } from '../../context/DevotionalContext';
import { useAuth } from '../../context/AuthContext';
import { Plus, Wand2, BookOpen, Trash2, X, Check, Search, ChevronLeft, ChevronRight, MessageSquareHeart } from 'lucide-react';
import { DevotionalItem } from '../../data/devotionals';
import { TabType } from '../../types';
import { format } from 'date-fns';
import { getJourneyStatus } from '../../utils/journey';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

interface JourneyListProps {
  onSelectDevotional: (devotional: DevotionalItem, allRead: boolean) => void;
  onCreateNew: (theme?: string) => void;
  onChangeTab?: (tab: TabType) => void;
}

export function JourneyList({ onSelectDevotional, onCreateNew, onChangeTab }: JourneyListProps) {
  const { allDevotionals, readHistory, customDevotionals, deleteCustomDevotional, themeLastRead, hasMoreGlobal, loadMoreGlobalDevotionals } = useDevotionals();
  const { user, profile } = useAuth();
  const userName = profile?.name ? profile.name.split(' ')[0] : 'Irmã(o)';
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [lockedTheme, setLockedTheme] = useState<string | null>(null);
  const THEMES_PER_PAGE = 8; // Reduce per page since cards are bigger
  
  const streakCount = profile?.streakCount || 0;
  const plant = getJourneyStatus(streakCount);

  const themes = useMemo(() => {
    return Array.from(new Set(allDevotionals.map(d => d.theme))).sort() as string[];
  }, [allDevotionals]);

  const filteredThemes = useMemo(() => {
    return themes.filter(theme => theme.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [themes, searchQuery]);

  const totalPages = Math.ceil(filteredThemes.length / THEMES_PER_PAGE);
  const paginatedThemes = filteredThemes.slice((currentPage - 1) * THEMES_PER_PAGE, currentPage * THEMES_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const handleThemeClick = (theme: string) => {
    const themeDevotionals = allDevotionals.filter(d => d.theme === theme).sort((a, b) => {
      // Tenta ordenar por createdAt primeiro
      if (a.createdAt && b.createdAt) {
         const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
         const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
         if (timeA !== timeB) return timeA - timeB;
      }
      
      // Fallback para os mocks (d1, d2, d10, etc.)
      const numA = parseInt(a.id.replace(/\D/g, ''));
      const numB = parseInt(b.id.replace(/\D/g, ''));
      
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
         return numA - numB;
      }
      
      return a.id.localeCompare(b.id);
    });
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

  return (
    <div className="pb-36 min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col relative transition-colors duration-200">
      {/* Header */}
      <div className="sticky top-0 bg-yellow-400/95 dark:bg-slate-900/95 backdrop-blur-md text-yellow-950 dark:text-white pt-10 pb-8 px-6 rounded-b-3xl shadow-sm z-50 shrink-0 transition-colors duration-200 border-b border-yellow-500/20 dark:border-slate-800">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/40 dark:bg-slate-800 p-1.5 rounded-2xl backdrop-blur-md shadow-sm overflow-hidden flex items-center justify-center w-14 h-14 shrink-0 border border-white/40 dark:border-slate-700">
              <img src="/rosa.png" alt="Florescer" className="w-full h-full object-cover" />
            </div>
            <span className="font-serif font-bold text-yellow-950 dark:text-yellow-400 text-2xl tracking-tight">Florescer</span>
          </div>
          
          <button 
            onClick={() => onChangeTab?.('profile')} 
            className="w-14 h-14 rounded-full border-2 border-white/60 dark:border-slate-700 overflow-hidden shadow-sm flex items-center justify-center bg-yellow-100 dark:bg-slate-800 hover:scale-105 transition-transform shrink-0"
          >
            {profile?.photoURL || user?.photoURL ? (
              <img src={profile?.photoURL || user?.photoURL || ''} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-yellow-900 dark:text-yellow-400 font-bold text-lg">{userName.charAt(0).toUpperCase()}</span>
            )}
          </button>
        </div>

        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold font-serif mb-1 text-yellow-950 dark:text-white">Jornada</h1>
            <p className="text-yellow-900 dark:text-gray-300 text-sm">Trilhas de crescimento espiritual.</p>
          </div>
          <div className="flex flex-col items-center justify-center bg-white/40 dark:bg-slate-800/80 rounded-2xl p-2.5 backdrop-blur-sm shadow-sm border border-white/30 dark:border-slate-700">
            <span className="text-2xl mb-0.5" title="Sua ofensiva floresce!">{plant.icon}</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-yellow-950 dark:text-yellow-400">{plant.label}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-5 mt-6 space-y-8 pb-6 overflow-y-auto">
        {/* Categories Grid */}
        <section>
          <div className="flex flex-col gap-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-yellow-500" />
              Temas Diários
            </h2>
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Buscar temas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all shadow-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
              />
            </div>
          </div>
          
          {filteredThemes.length === 0 ? (
            <p className="text-sm text-gray-500 italic text-center py-4">Nenhum tema encontrado.</p>
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {paginatedThemes.map(theme => {
                   const themeDevs = allDevotionals.filter(d => d.theme === theme).sort((a, b) => {
      // Tenta ordenar por createdAt primeiro
      if (a.createdAt && b.createdAt) {
         const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
         const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
         if (timeA !== timeB) return timeA - timeB;
      }
      
      // Fallback para os mocks (d1, d2, d10, etc.)
      const numA = parseInt(a.id.replace(/\D/g, ''));
      const numB = parseInt(b.id.replace(/\D/g, ''));
      
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
         return numA - numB;
      }
      
      return a.id.localeCompare(b.id);
    });
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
                   
                   return (
                    <button
                      key={theme}
                      onClick={() => handleThemeClick(theme)}
                      className="w-full text-left bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 hover:border-yellow-200 dark:hover:border-slate-600 transition-all group flex flex-col gap-3"
                    >
                      <div className="flex justify-between items-center">
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors text-sm">
                          {cardTitle}
                        </h3>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-slate-700 px-2.5 py-1 rounded-full shrink-0">
                          {moduleReadCount}/{totalInCurrentModule}
                        </span>
                      </div>
                      
                      <div className="w-full h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-yellow-400 dark:bg-yellow-500 rounded-full transition-all duration-500 ease-out"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-xl p-2 shadow-sm transition-colors duration-200">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    Página {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg disabled:opacity-50 disabled:hover:bg-transparent dark:disabled:hover:bg-transparent transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}

              {hasMoreGlobal && (
                <div className="mt-4 flex justify-center">
                  <button 
                    onClick={loadMoreGlobalDevotionals}
                    className="text-xs font-semibold text-yellow-600 dark:text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-2 rounded-full hover:bg-yellow-100 dark:hover:bg-yellow-900/40 transition-colors"
                  >
                    Carregar mais temas do servidor
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        {/* Custom Devotionals (UGC) */}
        {customDevotionals.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-yellow-500" />
              Meus Devocionais
            </h2>
            <div className="space-y-3">
              {customDevotionals.map(dev => (
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
                    const themeDevotionals = allDevotionals.filter(d => d.theme === lockedTheme).sort((a, b) => {
      // Tenta ordenar por createdAt primeiro
      if (a.createdAt && b.createdAt) {
         const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt?.seconds * 1000 || 0);
         const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt?.seconds * 1000 || 0);
         if (timeA !== timeB) return timeA - timeB;
      }
      
      // Fallback para os mocks (d1, d2, d10, etc.)
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
    </div>
  );
}
