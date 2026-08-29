import { PenLine, Calendar, X, Loader2, Sparkles, Copy, Check, BookmarkPlus, Heart, Crown, Lock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { collection, onSnapshot, doc, setDoc, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from '../../context/ToastContext';
import { SubscriptionModal } from '../subscription/SubscriptionModal';

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

export function DiaryTab({ onNavigateToSubscription }: DiaryTabProps) {
  const toast = useToast();
  const { user, profile } = useAuth();
  const [notes, setNotes] = useState<DiaryNote[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newText, setNewText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // VIP Paywall check
  const isPremiumUser = profile?.isPremium === true;
  const isAdmin = profile?.isAdmin === true || 
    user?.email === 'dofekrafael@gmail.com' || 
    user?.email === 'sjhonatan916@gmail.com' || 
    user?.email === 'floresceremadoracao@gmail.com';
  const hasAiAccess = isPremiumUser || isAdmin;
  const [showPaywallModal, setShowPaywallModal] = useState(false);

  // AI Spiritual Summary state
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [summaryResult, setSummaryResult] = useState<SpiritualSummaryResult | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isSavingSummaryToDiary, setIsSavingSummaryToDiary] = useState(false);

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

  const handleSave = async () => {
    if (!user || !newText.trim()) return;
    
    setIsSaving(true);
    try {
      const noteRef = doc(collection(db, 'users', user.uid, 'diaryNotes'));
      await setDoc(noteRef, {
        title: newTitle.trim(),
        text: newText.trim(),
        createdAt: serverTimestamp()
      });
      setIsModalOpen(false);
      setNewTitle('');
      setNewText('');
      toast.success("Anotação salva com sucesso!");
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar anotação. Verifique sua conexão e tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateSummary = async () => {
    // 1. Verificação estrita de Paywall VIP
    if (!hasAiAccess) {
      setShowPaywallModal(true);
      return;
    }

    if (notes.length === 0) {
      toast.error("Você ainda não possui anotações no diário. Escreva sua primeira reflexão para a IA gerar seu resumo espiritual!");
      return;
    }

    setIsGeneratingSummary(true);
    setShowSummaryModal(true);
    setSummaryResult(null);

    try {
      // Filtrar anotações dos últimos 7 dias (ou as 10 mais recentes se poucas)
      const recentNotes = notes.slice(0, 10).map(n => ({
        date: n.createdAt ? format(n.createdAt.toDate(), "dd/MM/yyyy") : "Sem data",
        title: n.title,
        content: n.text
      }));

      const res = await fetch('/api/gemini/summarize-diary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: recentNotes })
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
          onClick={() => setIsModalOpen(true)}
          className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-900/50 text-yellow-800 dark:text-yellow-400 py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-all active:scale-[0.98] shadow-xs text-sm"
        >
          <PenLine className="w-4 h-4" />
          ✍️ Escrever no Diário
        </button>

        <button 
          onClick={handleGenerateSummary}
          className="relative bg-gradient-to-r from-purple-600 via-indigo-600 to-yellow-500 hover:from-purple-700 hover:to-yellow-600 text-white py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold shadow-md transition-all active:scale-[0.98] text-sm cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
          <span>Resumo Espiritual (IA)</span>
          {!hasAiAccess ? (
            <span className="inline-flex items-center gap-0.5 bg-yellow-400 text-yellow-950 text-[10px] font-black uppercase px-2 py-0.5 rounded-full ml-1 shadow-xs shrink-0">
              <Crown className="w-2.5 h-2.5" /> VIP
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
            Suas Reflexões ({notes.length})
          </h3>
          {notes.length > 0 && (
            <span className="text-xs text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> IA pronta para resumir
            </span>
          )}
        </div>

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
        ) : (
          notes.map(note => (
            <div key={note.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-xs border border-gray-100 dark:border-slate-700 transition-colors duration-200">
              <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-xs font-medium mb-2">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(note.createdAt)}
              </div>
              {note.title && <h4 className="font-bold text-gray-900 dark:text-white mb-1 text-sm">{note.title}</h4>}
              <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{note.text}</p>
            </div>
          ))
        )}
      </div>

      {/* Modal Escrever */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-sm p-6 animate-in zoom-in-95 shadow-2xl transition-colors duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">✍️ Escrever para Deus</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <input 
                type="text" 
                placeholder="Título da reflexão (opcional)"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-colors text-sm"
              />
              <textarea 
                placeholder="O que Deus falou ao seu coração hoje?"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={5}
                className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-3 text-gray-800 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 resize-none transition-colors text-sm"
              ></textarea>
              
              <button 
                onClick={handleSave}
                disabled={isSaving || !newText.trim()}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3.5 rounded-xl shadow-xs active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Reflexão'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Resumo Espiritual Semanal */}
      {showSummaryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-3xl w-full max-w-md max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gradient-to-r from-purple-500/10 via-yellow-500/10 to-transparent">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-base">Resumo Espiritual da Semana</h3>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">Gerado com carinho pela IA do Florescer</p>
                </div>
              </div>
              <button 
                onClick={() => setShowSummaryModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
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
                <div className="space-y-4 animate-in fade-in duration-300">
                  {/* Title card */}
                  <div className="bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 rounded-2xl p-4 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-200/60 dark:bg-purple-900/60 px-2.5 py-0.5 rounded-full">
                      Tema Central da Semana
                    </span>
                    <h4 className="font-serif font-bold text-purple-950 dark:text-purple-100 text-lg mt-1.5">
                      {summaryResult.title}
                    </h4>
                  </div>

                  {/* Summary Text */}
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Caminhada & Reflexão
                    </h5>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap bg-gray-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-gray-100 dark:border-slate-800">
                      {summaryResult.summary}
                    </p>
                  </div>

                  {/* Highlights */}
                  {summaryResult.spiritualHighlights?.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                        Destaques da sua Alma
                      </h5>
                      <div className="space-y-1.5">
                        {summaryResult.spiritualHighlights.map((hl, idx) => (
                          <div key={idx} className="flex items-start gap-2 bg-yellow-50/60 dark:bg-yellow-950/20 p-2.5 rounded-xl border border-yellow-100/60 dark:border-yellow-900/30 text-xs text-yellow-950 dark:text-yellow-200 font-medium">
                            <span className="shrink-0">✨</span>
                            <span>{hl}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Verse Guidance */}
                  {summaryResult.verseGuidance && (
                    <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50 rounded-2xl p-4">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                        📖 Versículo para a Próxima Semana
                      </span>
                      <p className="font-serif italic text-xs text-emerald-950 dark:text-emerald-100 mt-1">
                        "{summaryResult.verseGuidance}"
                      </p>
                    </div>
                  )}

                  {/* Personal Prayer */}
                  {summaryResult.personalPrayer && (
                    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 rounded-2xl p-4">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300 mb-1">
                        <Heart className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        Oração Pastoral Personalizada
                      </div>
                      <p className="text-xs text-gray-800 dark:text-gray-200 leading-relaxed italic">
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
                  className="flex-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-100 text-gray-700 dark:text-gray-300 py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  {isCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {isCopied ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={handleSaveSummaryAsNote}
                  disabled={isSavingSummaryToDiary}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
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
    </div>
  );
}
