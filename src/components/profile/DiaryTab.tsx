import { PenLine, Calendar, X, Loader2, Sparkles, Copy, Check, BookmarkPlus, Heart, Crown, Lock, Pencil, Trash2, Search, Filter, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format, subDays, getISOWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '../../context/ToastContext';
import { SubscriptionModal } from '../subscription/SubscriptionModal';
import { recordApiUsage } from '../../services/apiMetricsService';
import { useDragScroll } from '../../hooks/useDragScroll';

interface DiaryNote {
  id: string;
  title: string;
  text: string;
  createdAt: Timestamp | null;
}

interface SpiritualSummaryResult {
  title: string;
  summary: string;
  spiritualHighlights: string[];
  verseGuidance: string;
  personalPrayer: string;
}

interface DiaryTabProps {
  onNavigateToSubscription?: () => void;
}

const MAX_WEEKLY_SUMMARIES = 2;

export function DiaryTab({ onNavigateToSubscription }: DiaryTabProps) {
  const toast = useToast();
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<DiaryNote[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DiaryNote | null>(null);
  const [noteToDelete, setNoteToDelete] = useState<DiaryNote | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // VIP Paywall & Weekly Limit check
  const isPremiumUser = profile?.isPremium === true;
  const isAdmin = profile?.isAdmin === true || 
    user?.email === 'dofekrafael@gmail.com' || 
    user?.email === 'sjhonatan916@gmail.com' || 
    user?.email === 'floresceremadoracao@gmail.com';
  const hasAiAccess = isPremiumUser || isAdmin;
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [showWeeklyLimitModal, setShowWeeklyLimitModal] = useState(false);

  // Weekly Usage Calculation
  const currentWeekId = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-W${getISOWeek(now)}`;
  }, []);

  const weeklyUsage = profile?.diarySummaryUsage;
  const currentWeeklyCount = (weeklyUsage?.weekId === currentWeekId) ? (weeklyUsage?.count || 0) : 0;
  const remainingWeeklyUses = isAdmin ? 999 : Math.max(0, MAX_WEEKLY_SUMMARIES - currentWeeklyCount);
  const isWeeklyLimitReached = !isAdmin && currentWeeklyCount >= MAX_WEEKLY_SUMMARIES;

  // AI Spiritual Summary state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SpiritualSummaryResult | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [summaryPeriod, setSummaryPeriod] = useState<'7d' | '30d' | 'recent'>('7d');
  const [analyzedCount, setAnalyzedCount] = useState(0);
  const [isCopied, setIsCopied] = useState(false);
  const [isSavingSummaryToDiary, setIsSavingSummaryToDiary] = useState(false);

  // Drag Scroll hooks for desktop
  const yearsDrag = useDragScroll<HTMLDivElement>();
  const periodDrag = useDragScroll<HTMLDivElement>();

  // Search & Pagination & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [visibleCount, setVisibleCount] = useState(20);

  // Extrair anos únicos presentes no diário do usuário
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    notes.forEach(note => {
      if (note.createdAt) {
        yearsSet.add(note.createdAt.toDate().getFullYear().toString());
      }
    });
    return Array.from(yearsSet).sort((a, b) => Number(b) - Number(a));
  }, [notes]);

  // Filtrar anotações por busca e ano
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      // Filtro por ano
      if (selectedYear !== 'all') {
        const noteYear = note.createdAt ? note.createdAt.toDate().getFullYear().toString() : '';
        if (noteYear !== selectedYear) return false;
      }
      // Filtro por busca textual (título ou conteúdo)
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase();
        const matchesTitle = note.title?.toLowerCase().includes(queryLower);
        const matchesText = note.text?.toLowerCase().includes(queryLower);
        if (!matchesTitle && !matchesText) return false;
      }
      return true;
    });
  }, [notes, selectedYear, searchQuery]);

  // Anotações fatiadas para renderização eficiente
  const displayedNotes = useMemo(() => {
    return filteredNotes.slice(0, visibleCount);
  }, [filteredNotes, visibleCount]);

  useEffect(() => {
    if (!user) return;

    const notesRef = collection(db, 'users', user.uid, 'diaryNotes');
    const q = query(notesRef, orderBy('createdAt', 'desc'));
    
    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedNotes = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as DiaryNote[];
      setNotes(fetchedNotes);
    }, (error) => {
      console.error("Error loading diary notes:", error);
    });

    return () => unsub();
  }, [user]);

  const handleOpenCreateModal = () => {
    setEditingNote(null);
    setNewTitle('');
    setNewText('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (note: DiaryNote) => {
    setEditingNote(note);
    setNewTitle(note.title || '');
    setNewText(note.text || '');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!user || !newText.trim()) return;
    
    setIsSaving(true);
    try {
      if (editingNote) {
        // Atualizar anotação existente
        const noteRef = doc(db, 'users', user.uid, 'diaryNotes', editingNote.id);
        await updateDoc(noteRef, {
          title: newTitle.trim(),
          text: newText.trim(),
          updatedAt: serverTimestamp()
        });
        toast.success("Reflexão atualizada com sucesso!");
      } else {
        // Criar nova anotação
        const noteRef = doc(collection(db, 'users', user.uid, 'diaryNotes'));
        await setDoc(noteRef, {
          title: newTitle.trim(),
          text: newText.trim(),
          createdAt: serverTimestamp()
        });
        toast.success("Reflexão salva com sucesso!");
      }
      setIsModalOpen(false);
      setEditingNote(null);
      setNewTitle('');
      setNewText('');
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar reflexão. Verifique sua conexão e tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!user || !noteToDelete) return;
    setIsDeleting(true);
    try {
      const noteRef = doc(db, 'users', user.uid, 'diaryNotes', noteToDelete.id);
      await deleteDoc(noteRef);
      toast.success("Reflexão excluída com sucesso!");
      setNoteToDelete(null);
    } catch (error) {
      console.error("Error deleting note:", error);
      toast.error("Erro ao excluir reflexão.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleGenerateSummary = async (periodToUse: '7d' | '30d' | 'recent' = summaryPeriod) => {
    // 1. Verificação estrita de Paywall VIP
    if (!hasAiAccess) {
      setShowPaywallModal(true);
      return;
    }

    // 2. Verificação estrita de Limite Semanal (2x na semana)
    if (isWeeklyLimitReached) {
      setShowWeeklyLimitModal(true);
      return;
    }

    if (notes.length === 0) {
      toast.error("Você ainda não possui anotações no diário. Escreva sua primeira reflexão para a IA gerar seu resumo espiritual!");
      return;
    }

    setSummaryPeriod(periodToUse);
    setIsGeneratingSummary(true);
    setShowSummaryModal(true);
    setSummaryResult(null);

    try {
      let targetNotes: DiaryNote[] = [];

      if (periodToUse === '7d') {
        const cutoff = subDays(new Date(), 7);
        targetNotes = notes.filter(n => n.createdAt && n.createdAt.toDate() >= cutoff);
        // Fallback se não tiver nenhuma nos últimos 7 dias: pega as 5 mais recentes
        if (targetNotes.length === 0) {
          targetNotes = notes.slice(0, 5);
        }
      } else if (periodToUse === '30d') {
        const cutoff = subDays(new Date(), 30);
        targetNotes = notes.filter(n => n.createdAt && n.createdAt.toDate() >= cutoff);
        // Fallback se não tiver nenhuma nos últimos 30 dias: pega as 10 mais recentes
        if (targetNotes.length === 0) {
          targetNotes = notes.slice(0, 10);
        }
      } else {
        // 'recent'
        targetNotes = notes.slice(0, 15);
      }

      // Limitar a no máximo 15 amostras e truncar cada uma a 500 caracteres
      const preparedNotes = targetNotes.slice(0, 15).map(n => ({
        date: n.createdAt ? format(n.createdAt.toDate(), "dd/MM/yyyy", { locale: ptBR }) : "Data recente",
        title: n.title ? n.title.slice(0, 100) : "",
        content: n.text ? n.text.slice(0, 500) : ""
      }));

      setAnalyzedCount(preparedNotes.length);

      const res = await fetch('/api/gemini/summarize-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          notes: preparedNotes,
          period: periodToUse 
        })
      });

      if (!res.ok) {
        let errText = "Erro ao gerar resumo";
        try {
          const errData = await res.json();
          if (errData?.error) errText = errData.error;
        } catch {}
        throw new Error(errText);
      }

      const data: SpiritualSummaryResult = await res.json();
      setSummaryResult(data);
      recordApiUsage('gemini');

      // Atualizar contador semanal no Firestore se usuário logado (exceto admin ilimitado)
      if (user && !isAdmin) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            'diarySummaryUsage.weekId': currentWeekId,
            'diarySummaryUsage.count': currentWeeklyCount + 1,
            'diarySummaryUsage.lastUsedAt': new Date().toISOString()
          });
        } catch (err) {
          console.warn("Error updating diarySummaryUsage on Firestore:", err);
        }
      }
    } catch (error: any) {
      console.error("Error generating spiritual summary:", error);
      toast.error(error.message || "Não foi possível gerar o resumo agora. Tente novamente em instantes.");
      setShowSummaryModal(false);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleCopySummary = () => {
    if (!summaryResult) return;
    const textToCopy = `🌸 *${summaryResult.title}*\n_Resumo Espiritual Florescer_\n\n${summaryResult.summary}\n\n✨ *Destaques:*\n${summaryResult.spiritualHighlights.map(h => `• ${h}`).join('\n')}\n\n📖 *Palavra Guia:* ${summaryResult.verseGuidance}\n\n🙏 *Oração:*\n${summaryResult.personalPrayer}`;
    navigator.clipboard.writeText(textToCopy);
    setIsCopied(true);
    toast.success("Resumo copiado para a área de transferência!");
    setTimeout(() => setIsCopied(false), 2500);
  };

  const handleSaveSummaryAsNote = async () => {
    if (!user || !summaryResult) return;
    setIsSavingSummaryToDiary(true);
    try {
      const noteRef = doc(collection(db, 'users', user.uid, 'diaryNotes'));
      const textToSave = `${summaryResult.summary}\n\n✨ Destaques:\n${summaryResult.spiritualHighlights.map(h => `• ${h}`).join('\n')}\n\n📖 Palavra Guia: ${summaryResult.verseGuidance}\n\n🙏 Oração:\n${summaryResult.personalPrayer}`;
      
      await setDoc(noteRef, {
        title: `✨ Resumo: ${summaryResult.title}`,
        text: textToSave,
        createdAt: serverTimestamp()
      });
      toast.success("Resumo salvo como anotação no seu diário!");
    } catch (error) {
      console.error("Error saving summary to diary:", error);
      toast.error("Erro ao salvar resumo no diário.");
    } finally {
      setIsSavingSummaryToDiary(false);
    }
  };

  const formatDate = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'Hoje';
    return format(timestamp.toDate(), "dd MMM yyyy", { locale: ptBR });
  };

  return (
    <div className="p-5 space-y-4">
      {/* Botões de Ação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button 
          id="btn-write-diary"
          onClick={handleOpenCreateModal}
          className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-900/50 text-yellow-800 dark:text-yellow-400 py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-all active:scale-[0.98] shadow-xs text-sm cursor-pointer"
        >
          <PenLine className="w-4 h-4" />
          ✍️ Escrever no Diário
        </button>

        <button 
          id="btn-ai-spiritual-summary"
          onClick={() => handleGenerateSummary()}
          className="relative bg-gradient-to-r from-purple-600 via-indigo-600 to-yellow-500 hover:from-purple-700 hover:to-yellow-600 text-white py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-md transition-all active:scale-[0.98] text-sm cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
          <span>Resumo Espiritual (IA)</span>
          {!hasAiAccess ? (
            <span className="inline-flex items-center gap-0.5 bg-yellow-400 text-yellow-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ml-1 shadow-xs shrink-0">
              <Crown className="w-2.5 h-2.5" /> VIP
            </span>
          ) : !isAdmin ? (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full ml-1 shrink-0 ${
              remainingWeeklyUses > 0 
                ? 'bg-purple-900/70 text-purple-200 border border-purple-400/30' 
                : 'bg-rose-950/70 text-rose-200 border border-rose-400/30'
            }`}>
              {remainingWeeklyUses}/{MAX_WEEKLY_SUMMARIES} sem.
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 bg-purple-900/60 text-purple-200 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ml-1">
              PRO
            </span>
          )}
        </button>
      </div>

      <div className="space-y-3 mt-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Suas Reflexões {filteredNotes.length !== notes.length ? `(${filteredNotes.length} de ${notes.length})` : `(${notes.length})`}
          </h3>
          {notes.length > 0 && (
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> IA pronta para resumir
            </span>
          )}
        </div>

        {/* Barra de Busca e Filtro por Ano */}
        {notes.length > 0 && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
              <input
                id="input-search-diary"
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setVisibleCount(20);
                }}
                placeholder="Buscar em reflexões anteriores..."
                className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl pl-9 pr-9 py-2.5 text-xs text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setVisibleCount(20);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro por Ano com suporte a arrastar com mouse e wheel no PC */}
            {availableYears.length > 1 && (
              <div 
                {...yearsDrag.dragProps}
                className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 cursor-grab active:cursor-grabbing select-none"
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedYear('all');
                    setVisibleCount(20);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                    selectedYear === 'all'
                      ? 'bg-yellow-500 text-white shadow-xs'
                      : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                  }`}
                >
                  Todos os anos
                </button>
                {availableYears.map(year => (
                  <button
                    key={year}
                    type="button"
                    onClick={() => {
                      setSelectedYear(year);
                      setVisibleCount(20);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                      selectedYear === year
                        ? 'bg-yellow-500 text-white shadow-xs'
                        : 'bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {notes.length === 0 ? (
          <div className="text-center py-10 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-6">
            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center mx-auto mb-3 text-xl">
              📖
            </div>
            <h4 className="font-bold text-gray-800 dark:text-white text-sm mb-1">Seu diário está em branco</h4>
            <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed max-w-xs mx-auto">
              Feche os olhos, respire fundo e escreva o que Deus ministrou ao seu coração hoje.
            </p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="text-center py-8 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 p-5">
            <Search className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2 opacity-50" />
            <h4 className="font-bold text-gray-800 dark:text-white text-sm mb-1">Nenhuma reflexão encontrada</h4>
            <p className="text-gray-500 dark:text-gray-400 text-xs leading-relaxed max-w-xs mx-auto">
              Tente buscar por outras palavras ou limpar os filtros de busca.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedYear('all');
                setVisibleCount(20);
              }}
              className="mt-3 text-xs text-yellow-600 dark:text-yellow-400 font-semibold hover:underline cursor-pointer"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          <>
            {displayedNotes.map(note => (
              <div key={note.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-700 transition-colors duration-200 group">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-medium">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(note.createdAt)}
                  </div>
                  
                  {/* Botões de Ação: Editar e Excluir */}
                  <div className="flex items-center gap-1">
                    <button
                      id={`btn-edit-note-${note.id}`}
                      onClick={() => handleOpenEditModal(note)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-yellow-600 dark:hover:text-yellow-400 hover:bg-yellow-50 dark:hover:bg-yellow-900/30 transition-colors cursor-pointer"
                      title="Editar reflexão"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      id={`btn-delete-note-${note.id}`}
                      onClick={() => setNoteToDelete(note)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors cursor-pointer"
                      title="Excluir reflexão"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {note.title && <h4 className="font-bold text-gray-900 dark:text-white mb-1.5 text-sm">{note.title}</h4>}
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{note.text}</p>
              </div>
            ))}

            {/* Botão Carregar Mais */}
            {filteredNotes.length > displayedNotes.length && (
              <div className="pt-2 text-center">
                <button
                  id="btn-load-more-notes"
                  type="button"
                  onClick={() => setVisibleCount(prev => prev + 20)}
                  className="w-full py-3 bg-gray-50 dark:bg-slate-800/80 hover:bg-gray-100 dark:hover:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-300 font-semibold rounded-2xl text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                >
                  <ChevronDown className="w-4 h-4" />
                  Carregar mais reflexões ({displayedNotes.length} de {filteredNotes.length})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal Escrever / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 animate-in zoom-in-95 shadow-2xl transition-colors duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                {editingNote ? '✏️ Editar Reflexão' : '✍️ Escrever para Deus'}
              </h3>
              <button 
                onClick={() => {
                  setIsModalOpen(false);
                  setEditingNote(null);
                }} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <input 
                id="input-note-title"
                type="text" 
                placeholder="Título da reflexão (opcional)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors text-sm"
              />
              <div className="relative">
                <textarea 
                  id="input-note-text"
                  placeholder="O que Deus falou ao seu coração hoje?"
                  value={newText}
                  maxLength={500}
                  onChange={(e) => setNewText(e.target.value)}
                  rows={5}
                  className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none transition-colors text-sm pb-7"
                ></textarea>
                <div className="absolute right-3 bottom-2.5 text-[11px] font-medium text-gray-400 dark:text-gray-500 pointer-events-none">
                  <span className={newText.length >= 500 ? 'text-amber-500 font-bold' : ''}>
                    {newText.length}
                  </span>/500
                </div>
              </div>
              
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setEditingNote(null);
                  }}
                  className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  id="btn-save-note"
                  onClick={handleSave}
                  disabled={isSaving || !newText.trim()}
                  className="flex-1 bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl shadow-xs active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {editingNote ? 'Atualizando...' : 'Salvando...'}
                    </>
                  ) : (
                    editingNote ? 'Atualizar' : 'Salvar'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Confirmar Exclusão */}
      {noteToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 animate-in zoom-in-95 shadow-2xl transition-colors duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            
            <h3 className="font-bold text-gray-900 dark:text-white text-lg text-center mb-1">
              Excluir Reflexão?
            </h3>
            
            <p className="text-gray-500 dark:text-gray-400 text-xs text-center leading-relaxed mb-5">
              Tem certeza que deseja apagar esta anotação do seu diário? Esta ação não poderá ser desfeita.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNoteToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-3 bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 font-semibold rounded-xl text-sm hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                id="btn-confirm-delete-note"
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  'Sim, Excluir'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resumo Espiritual Semanal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-lg max-h-[88vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-purple-500/10 via-yellow-500/10 to-transparent">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base sm:text-lg">Resumo Espiritual com IA</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {analyzedCount > 0 ? `Sintetizando ${analyzedCount} reflexões selecionadas` : 'Gerado com carinho pela IA do Florescer'}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowSummaryModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Period Selector Tabs & Usage Badge */}
            <div className="px-5 pt-3 pb-2 bg-gray-50/50 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between gap-1.5">
              <div 
                {...periodDrag.dragProps}
                className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5 cursor-grab active:cursor-grabbing select-none"
              >
                <button
                  type="button"
                  disabled={isGeneratingSummary}
                  onClick={() => handleGenerateSummary('7d')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 disabled:opacity-50 ${
                    summaryPeriod === '7d'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-gray-200/70 dark:bg-slate-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Últimos 7 dias
                </button>
                <button
                  type="button"
                  disabled={isGeneratingSummary}
                  onClick={() => handleGenerateSummary('30d')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 disabled:opacity-50 ${
                    summaryPeriod === '30d'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-gray-200/70 dark:bg-slate-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Últimos 30 dias
                </button>
                <button
                  type="button"
                  disabled={isGeneratingSummary}
                  onClick={() => handleGenerateSummary('recent')}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 disabled:opacity-50 ${
                    summaryPeriod === 'recent'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-gray-200/70 dark:bg-slate-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-slate-700'
                  }`}
                >
                  Mais Recentes
                </button>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {!isAdmin && (
                  <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                    {remainingWeeklyUses}/{MAX_WEEKLY_SUMMARIES} semanais
                  </span>
                )}
                {!isGeneratingSummary && (
                  <button
                    type="button"
                    onClick={() => handleGenerateSummary(summaryPeriod)}
                    title="Regerar resumo"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-colors cursor-pointer shrink-0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {isGeneratingSummary ? (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="relative">
                    <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 animate-pulse">
                      <Sparkles className="w-8 h-8 animate-spin" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base mb-1">
                      Analisando seu Diário...
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                      Consultando os momentos de oração para tecer uma reflexão edificante e personalizada.
                    </p>
                  </div>
                </div>
              ) : summaryResult ? (
                <div className="space-y-5 animate-in fade-in duration-300">
                  {/* Title card */}
                  <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 rounded-2xl p-4 sm:p-5 text-center">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-200/60 dark:bg-purple-900/60 px-3 py-1 rounded-full">
                      Tema Central da Semana
                    </span>
                    <h4 className="font-serif font-bold text-purple-950 dark:text-purple-100 text-lg sm:text-xl mt-2 leading-snug">
                      {summaryResult.title}
                    </h4>
                  </div>

                  {/* Summary Text */}
                  <div className="space-y-2">
                    <h5 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                      <span>🕊️</span> Caminhada & Reflexão
                    </h5>
                    <p className="text-sm sm:text-base text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-slate-800/70 p-4 sm:p-5 rounded-2xl border border-gray-100 dark:border-slate-800">
                      {summaryResult.summary}
                    </p>
                  </div>

                  {/* Highlights */}
                  {summaryResult.spiritualHighlights?.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs sm:text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider flex items-center gap-1.5">
                        <span>✨</span> Destaques da sua Alma
                      </h5>
                      <div className="space-y-2">
                        {summaryResult.spiritualHighlights.map((hl, idx) => (
                          <div key={idx} className="flex items-start gap-2.5 bg-yellow-50/70 dark:bg-yellow-950/25 p-3 rounded-xl border border-yellow-100 dark:border-yellow-900/40 text-sm text-yellow-950 dark:text-yellow-100 font-medium leading-relaxed">
                            <span className="shrink-0 text-base">✨</span>
                            <span>{hl}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verse Guidance */}
                  {summaryResult.verseGuidance && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4 sm:p-5">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        📖 Versículo para a Próxima Semana
                      </span>
                      <p className="font-serif italic text-sm sm:text-base text-emerald-950 dark:text-emerald-100 mt-2 leading-relaxed">
                        "{summaryResult.verseGuidance}"
                      </p>
                    </div>
                  )}

                  {/* Personal Prayer */}
                  {summaryResult.personalPrayer && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-4 sm:p-5">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 mb-2">
                        <Heart className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        Oração Pastoral Personalizada
                      </div>
                      <p className="text-sm sm:text-base text-gray-800 dark:text-gray-100 leading-relaxed italic">
                        {summaryResult.personalPrayer}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Footer Buttons */}
            {summaryResult && !isGeneratingSummary && (
              <div className="p-4 border-t border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/80 flex gap-2">
                <button
                  onClick={handleCopySummary}
                  className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 text-gray-700 dark:text-gray-300 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  {isCopied ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={handleSaveSummaryAsNote}
                  disabled={isSavingSummaryToDiary}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {isSavingSummaryToDiary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookmarkPlus className="w-3.5 h-3.5" />}
                  Salvar no Diário
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Subscription VIP Paywall Modal */}
      <SubscriptionModal
        isOpen={showPaywallModal}
        onClose={() => setShowPaywallModal(false)}
        onNavigateToSubscription={onNavigateToSubscription}
        featureName="Resumo Espiritual da Semana com IA"
      />

      {/* Weekly Limit Reached Modal */}
      {showWeeklyLimitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 shadow-2xl flex flex-col items-center text-center space-y-4 animate-in zoom-in-95 duration-200 border border-purple-100 dark:border-purple-900/40">
            <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Sparkles className="w-8 h-8" />
            </div>

            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-3 py-1 rounded-full">
                2/2 Usados Esta Semana
              </span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-2">
                Limite Semanal Atingido
              </h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 leading-relaxed">
                O Resumo Espiritual com IA é calibrado para até <strong>2 resumos por semana</strong> por assinante, estimulando a reflexão profunda e a escrita contínua no diário.
              </p>
              <p className="text-[11px] text-purple-700 dark:text-purple-300 font-medium mt-3 bg-purple-50/70 dark:bg-purple-950/40 p-3 rounded-2xl border border-purple-100 dark:border-purple-900/30">
                🌿 Seu limite será renovado automaticamente na próxima semana. Continue registrando suas orações e reflexões diárias!
              </p>
            </div>

            <button
              onClick={() => setShowWeeklyLimitModal(false)}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm rounded-xl transition-all shadow-md active:scale-98 cursor-pointer"
            >
              Compreendi, continuar no Diário
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
