import { useState } from 'react';
import { useDevotionals } from '../../context/DevotionalContext';
import { ArrowLeft, Save, Wand2, Loader2, Crown, X } from 'lucide-react';
import { generateDevotional } from '../../services/geminiService';
import { useAuth } from '../../context/AuthContext';
import { TabType } from '../../types';
import { format } from 'date-fns';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';

interface CreateDevotionalProps {
  onBack: () => void;
  initialTheme?: string;
  onChangeTab?: (tab: TabType, subTab?: 'diary' | 'verses' | 'subscription' | 'settings' | 'admin') => void;
}

export function CreateDevotional({ onBack, initialTheme, onChangeTab }: CreateDevotionalProps) {
  const toast = useToast();
  const { addCustomDevotional } = useDevotionals();
  const { profile, user } = useAuth();
  
  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';
  const hasAccess = profile?.isPremium || isAdmin;
  
  const [theme, setTheme] = useState(initialTheme || '');
  const [title, setTitle] = useState('');
  const [beautifulWord, setBeautifulWord] = useState('');
  const [content, setContent] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showAILimitModal, setShowAILimitModal] = useState(false);

  const quickThemes = ['Gratidão', 'Ansiedade & Paz', 'Esperança', 'Família', 'Propósito', 'Superação', 'Fé'];

  const handleSave = () => {
    if (!title || !content) return;
    
    addCustomDevotional({
      id: `custom-${Date.now()}`,
      theme: theme.trim() || 'Pessoal',
      title,
      description: 'Devocional criado por você.',
      beautifulWord,
      content
    });
    toast.success("Devocional salvo com sucesso!");
    onBack();
  };

  const handleGenerateAI = async () => {
    if (!hasAccess) {
      setShowPremiumModal(true);
      return;
    }

    if (!theme || !theme.trim()) {
      toast.info("Por favor, digite seu tema no campo 'Categoria / Tema' para gerar seu devocional ✨");
      const inputEl = document.getElementById('devotional-theme-input');
      inputEl?.focus();
      return;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Check Fair Use Policy (max 10 generations/day for non-admin Premium users)
    if (!isAdmin) {
      const lastGenDate = profile?.lastGenerationDate;
      const genCount = (lastGenDate === today) ? (profile?.aiGenerationsCount || 0) : 0;
      if (genCount >= 10) {
        setShowAILimitModal(true);
        return;
      }
    }
    
    try {
      setIsGenerating(true);
      const newDevotional = await generateDevotional(
        theme.trim(),
        profile?.name,
        profile?.faithJourney,
        profile?.needArea,
        beautifulWord
      );
      
      setTitle(newDevotional.title);
      setBeautifulWord(newDevotional.beautifulWord);
      setContent(newDevotional.content);
      toast.success("Devocional gerado com sucesso pela IA! ✨");

      if (user) {
        try {
          const lastGenDate = profile?.lastGenerationDate;
          const currentCount = (lastGenDate === today) ? (profile?.aiGenerationsCount || 0) : 0;
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            aiGenerationsCount: currentCount + 1,
            lastGenerationDate: today
          });
        } catch (err) {
          console.error("Error updating AI count:", err);
        }
      }
      
    } catch (error: any) {
      toast.error(error.message || "Houve um erro ao tentar gerar seu devocional inédito. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="pb-24 bg-gray-50 dark:bg-slate-900 transition-colors duration-200 min-h-screen relative">
      <div className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 transition-colors duration-200 z-10 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button 
            onClick={onBack}
            className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Criar Devocional</h2>
        </div>
        <button 
          onClick={handleSave}
          disabled={!title || !content}
          className="flex items-center gap-1.5 text-sm font-semibold text-white bg-yellow-500 hover:bg-yellow-600 active:scale-95 px-4 py-1.5 rounded-full disabled:opacity-50 transition-all cursor-pointer shadow-xs"
        >
          <Save className="w-4 h-4" />
          Salvar
        </button>
      </div>

      <div className="px-4 sm:px-6 pt-6">
        <button
          onClick={handleGenerateAI}
          disabled={isGenerating}
          className="w-full bg-yellow-500 hover:bg-yellow-600 active:scale-[0.99] text-white rounded-2xl py-3.5 px-4 font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-75"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Gerando devocional com IA...</span>
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              <span>Gerar Devocional com IA</span>
              {!hasAccess && <Crown className="w-4 h-4 ml-1 text-yellow-200" />}
            </>
          )}
        </button>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Categoria / Tema *
            </label>
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Necessário para a IA</span>
          </div>
          <input 
            id="devotional-theme-input"
            type="text" 
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="Ex: Gratidão, Ansiedade, Família, Esperança..."
            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-shadow"
          />

          {/* Sugestões rápidas de temas */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            <span className="text-[11px] text-gray-400 dark:text-gray-500 font-medium mr-1">Sugestões:</span>
            {quickThemes.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTheme(item)}
                className={`text-xs px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                  theme.toLowerCase() === item.toLowerCase()
                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700 font-semibold'
                    : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Título da Reflexão *</label>
          <input 
            type="text" 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: A paz que excede todo o entendimento"
            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-shadow"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Versículo ou Palavra de Força</label>
          <textarea 
            value={beautifulWord}
            onChange={(e) => setBeautifulWord(e.target.value)}
            placeholder="Ex: 'O Senhor é o meu pastor; nada me faltará.' (Salmos 23:1)"
            rows={2}
            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-shadow resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5">Sua Reflexão *</label>
          <textarea 
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva aqui sua reflexão ou gere automaticamente acima..."
            rows={8}
            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl px-4 py-3 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-shadow resize-none"
          />
        </div>
      </div>
      
      {/* Premium Lock Modal */}
      {showPremiumModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm relative shadow-2xl animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setShowPremiumModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="flex flex-col items-center text-center mt-2">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                <Crown className="w-6 h-6 text-yellow-600 dark:text-yellow-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Recurso Premium</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 text-sm">
                A geração de devocionais inéditos com Inteligência Artificial é exclusiva para assinantes do Florescer Premium.
              </p>
              
              <div className="w-full bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-100 dark:border-slate-700 mb-6">
                <div className="text-2xl font-black text-gray-900 dark:text-white mb-1">R$ 29,90 <span className="text-sm font-normal text-gray-500 dark:text-gray-400">/ mês</span></div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Cancele quando quiser, direto pelo aplicativo.</p>
              </div>

              <button
                onClick={() => {
                  setShowPremiumModal(false);
                  if (onChangeTab) onChangeTab('profile', 'subscription');
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-xl transition-colors shadow-sm"
              >
                Conhecer o Florescer Premium
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Fair Use Limit Modal */}
      {showAILimitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl text-center border border-yellow-100 dark:border-slate-800">
            <button 
              onClick={() => setShowAILimitModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-2">
              <Wand2 className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Limite Diário Atingido</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              Você atingiu o limite diário de <strong>10 reflexões profundas</strong> geradas por Inteligência Artificial. Volte amanhã para continuar gerando novas meditações!
            </p>

            <button
              onClick={() => setShowAILimitModal(false)}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3.5 px-4 rounded-xl transition-colors shadow-sm text-sm"
            >
              Compreendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
