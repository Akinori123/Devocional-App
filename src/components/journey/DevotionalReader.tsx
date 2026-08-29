import { useEffect, useState, useRef, useMemo } from 'react';
import { DevotionalItem } from '../../data/devotionals';
import { ArrowLeft, Share2, Sparkles, Loader2, Type, Image as ImageIcon, X, Download, Crown, Palette, Lock, BookOpen, Copy, Check, Quote, Heart } from 'lucide-react';
import { useDevotionals } from '../../context/DevotionalContext';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { generateDevotional } from '../../services/geminiService';
import { parseVerseReference, fetchVerseText } from '../../utils/bibleParser';
import { cn } from '../../lib/utils';
import * as htmlToImage from 'html-to-image';
import { TabType } from '../../types';
import { format } from 'date-fns';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../../context/ToastContext';
import { recordApiUsage } from '../../services/apiMetricsService';

interface DevotionalReaderProps {
  devotional: DevotionalItem;
  isAllRead?: boolean;
  onChangeTab?: (tab: TabType, subTab?: 'diary' | 'verses' | 'subscription' | 'settings' | 'admin') => void;
  onNavigateToBible?: (selection: { bookId: string; chapter: number; verse: number }) => void;
  onGenerated?: (devotional: DevotionalItem) => void;
  onCreateNew?: (theme?: string) => void;
  onBack: () => void;
}

function parseDevotionalVerse(devotionalItem: DevotionalItem | any): { verseText: string; verseReference: string } {
  if (!devotionalItem) return { verseText: '', verseReference: '' };

  // 1. Direct properties if saved in custom/admin format
  if (devotionalItem.verseText || devotionalItem.verseRef) {
    const rawText = (devotionalItem.verseText || '').trim();
    const rawRef = (devotionalItem.verseRef || '').trim();
    // If verseText is just numbers or empty, and verseRef is empty or just reference
    if (/^\d+$/.test(rawText) && rawRef) {
      return { verseText: '', verseReference: rawRef.includes(rawText) ? rawRef : `${rawRef}-${rawText}` };
    }
    return {
      verseText: rawText,
      verseReference: rawRef
    };
  }

  if (devotionalItem.verse) {
    if (typeof devotionalItem.verse === 'object') {
      const vText = (devotionalItem.verse.text || devotionalItem.verse.verseText || '').trim();
      const vRef = (devotionalItem.verse.reference || devotionalItem.verse.verseRef || devotionalItem.verse.ref || '').trim();
      return {
        verseText: /^\d+$/.test(vText) ? '' : vText,
        verseReference: vRef
      };
    } else if (typeof devotionalItem.verse === 'string') {
      return parseDevotionalVerseString(devotionalItem.verse);
    }
  }

  const rawWord = devotionalItem.beautifulWord || devotionalItem.word || '';
  if (rawWord && typeof rawWord === 'string') {
    return parseDevotionalVerseString(rawWord);
  }

  // Fallback: check if description starts with a verse reference
  if (devotionalItem.description && typeof devotionalItem.description === 'string' && devotionalItem.description.includes('(') && devotionalItem.description.includes(')')) {
    return parseDevotionalVerseString(devotionalItem.description);
  }

  return { verseText: '', verseReference: '' };
}

function parseDevotionalVerseString(text: string): { verseText: string; verseReference: string } {
  if (!text) return { verseText: '', verseReference: '' };
  
  // Clean backslashes e.g. \"
  const cleanStr = text.replace(/\\"/g, '"').trim();

  // Pattern 1: "Verse text" (Reference) or Verse text (Reference)
  const parenMatch = cleanStr.match(/^["“\s]*(.*?)["”\s]*\(([^)]+)\)\s*$/);
  if (parenMatch) {
    const textPart = parenMatch[1].replace(/^["“\s]+|["”\s]+$/g, '').trim();
    const refPart = parenMatch[2].trim();
    return {
      verseText: textPart,
      verseReference: refPart
    };
  }

  // Pattern 2: Is the entire string just a Bible reference? e.g. "Romanos 8:38-39", "1 João 4:19", "Sl 23:1-6"
  const isPureRef = cleanStr.match(/^((?:\d\s*)?[A-Za-zÀ-ÿ\s]+?\s+\d+\s*[:.]\s*\d+(?:\s*[-–—]\s*\d+)?)\.?$/);
  if (isPureRef) {
    return {
      verseText: '',
      verseReference: isPureRef[1].replace(/\s*[-–—]\s*/g, '-').trim()
    };
  }

  // Pattern 3: Reference - Verse text OR Reference: Verse text
  const refStartMatch = cleanStr.match(/^((?:\d\s*)?[A-Za-zÀ-ÿ\s]+?\s+\d+\s*[:.]\s*\d+(?:\s*[-–—]\s*\d+)?)\s*[-:—–]\s*["“\s]*(.*?)["”\s]*$/);
  if (refStartMatch) {
    const potentialText = refStartMatch[2].replace(/^["“\s]+|["”\s]+$/g, '').trim();
    if (/^\d+$/.test(potentialText)) {
      // It was just the end of a verse range (e.g. 8:38 - 39)
      return {
        verseText: '',
        verseReference: `${refStartMatch[1]}-${potentialText}`
      };
    }
    return {
      verseText: potentialText,
      verseReference: refStartMatch[1].trim()
    };
  }

  // Pattern 4: "Verse text" - Reference OR Verse text - Reference
  const refEndMatch = cleanStr.match(/^["“\s]*(.*?)[”"\s]*\s*[-—–]\s*((?:\d\s*)?[A-Za-zÀ-ÿ\s]+?\s+\d+\s*[:.]\s*\d+(?:\s*[-–—]\s*\d+)?)\s*$/);
  if (refEndMatch) {
    const textPart = refEndMatch[1].replace(/^["“\s]+|["”\s]+$/g, '').trim();
    return {
      verseText: textPart,
      verseReference: refEndMatch[2].trim()
    };
  }

  // Pattern 5: Pure text
  const cleanText = cleanStr.replace(/^["“\s]+|["”\s]+$/g, '').trim();
  return {
    verseText: cleanText,
    verseReference: ''
  };
}

function parseDevotionalContent(content: string) {
  if (!content) return { paragraphs: [], prayer: null };
  const parts = content.split('\n\n');
  const paragraphs: string[] = [];
  let prayer: string | null = null;

  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('**Oração:**') || trimmed.startsWith('Oração:') || trimmed.startsWith('**Oração**')) {
      const cleanPrayer = trimmed
        .replace(/^\*\*Oração:?\*\*\s*/i, '')
        .replace(/^Oração:\s*/i, '')
        .trim();
      prayer = cleanPrayer;
    } else {
      paragraphs.push(trimmed);
    }
  }

  return { paragraphs, prayer };
}

export function DevotionalReader({ devotional, isAllRead, onChangeTab, onNavigateToBible, onGenerated, onCreateNew, onBack }: DevotionalReaderProps) {
  const toast = useToast();
  const { markAsRead, addCustomDevotional, allDevotionals, adminDevotionals, readHistory } = useDevotionals();
  const { profile, user, awardDailyCoin } = useAuth();
  
  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';
  const hasAccess = profile?.isPremium || isAdmin;
  
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isToday = profile?.lastGenerationDate === todayStr;
  const aiGenerationsUsed = isToday ? (profile?.aiGenerationsCount || 0) : 0;
  const isPremiumUser = profile?.isPremium === true;
  const maxAiGenerations = isAdmin ? 9999 : (isPremiumUser ? 10 : 1);
  const remainingAiGenerations = Math.max(0, maxAiGenerations - aiGenerationsUsed);
  const hasAiLimitReached = !isAdmin && aiGenerationsUsed >= maxAiGenerations;

  const [showFreeLimitModal, setShowFreeLimitModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showAILimitModal, setShowAILimitModal] = useState(false);
  const { fontSize, cycleFontSize } = useSettings();
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedVerse, setCopiedVerse] = useState(false);
  
  const [showShareModal, setShowShareModal] = useState(false);
  const [generatedBg, setGeneratedBg] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [useFallbackBg, setUseFallbackBg] = useState(false);

  const [dynamicVerseText, setDynamicVerseText] = useState<string>('');
  const [loadingVerseText, setLoadingVerseText] = useState<boolean>(false);

  const parsedVerse = useMemo(() => parseDevotionalVerse(devotional), [devotional]);

  useEffect(() => {
    setDynamicVerseText('');
    const textIsMissingOrInvalid = !parsedVerse.verseText || /^\d+$/.test(parsedVerse.verseText);

    if (textIsMissingOrInvalid && parsedVerse.verseReference) {
      let isMounted = true;
      setLoadingVerseText(true);
      fetchVerseText(parsedVerse.verseReference)
        .then((txt) => {
          if (isMounted && txt) {
            setDynamicVerseText(txt);
          }
        })
        .catch((err) => {
          console.warn('Erro ao buscar versículo da API bíblica:', err);
        })
        .finally(() => {
          if (isMounted) setLoadingVerseText(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [parsedVerse.verseReference, parsedVerse.verseText]);

  const displayVerseText = dynamicVerseText || (parsedVerse.verseText && !/^\d+$/.test(parsedVerse.verseText) ? parsedVerse.verseText : '');
  const displayVerseRef = parsedVerse.verseReference || '';

  const presetThemes = [
    { label: "Amanhecer", prompt: "A beautiful gentle sunrise over mountains with soft warm colors" },
    { label: "Céu Estrelado", prompt: "A beautiful starry night sky with a subtle galaxy glow" },
    { label: "Minimalista", prompt: "A clean minimalist abstract background with soft gradient" },
    { label: "Natureza", prompt: "A lush green forest with sunlight filtering through leaves" },
    { label: "Leão", prompt: "A majestic lion profile silhouette against a warm sunset, subtle" },
    { label: "Montanhas", prompt: "Majestic misty mountains fading into the distance, peaceful" },
    { label: "Calmaria", prompt: "A peaceful calm ocean surface with pastel sky reflection" },
    { label: "Bíblico", prompt: "An ancient scroll on a wooden table with soft candle light, aesthetic" },
    { label: "Flores", prompt: "A soft macro shot of delicate spring flowers blooming" }
  ];

  const handleGenerateBg = async (promptToUse: string) => {
    if (!promptToUse.trim()) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    let currentCount = profile?.dailyImageCount || 0;

    if (!profile?.isPremium && !isAdmin) {
      if (profile?.hasUsedFreeImage) {
        setShowPremiumModal(true);
        return;
      }
    } else if (profile?.isPremium && !isAdmin) {
      if (profile?.lastImageDate !== todayStr) {
        currentCount = 0;
      }
      if (currentCount >= 5) {
        toast.error("Você atingiu o limite de 5 criações mágicas por dia. Volte amanhã para gerar mais!");
        return;
      }
    }

    setUseFallbackBg(false);
    setGeneratedBg(null);
    setIsGeneratingImage(true);
    try {
      const response = await fetch('/api/gemini/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptToUse })
      });
      
      if (!response.ok) {
        let errText = "Falha ao gerar";
        try {
          const errJson = await response.json();
          if (errJson?.error) errText = errJson.error;
        } catch {}
        
        if (
          response.status === 429 || 
          errText.includes('429') || 
          errText.includes('RESOURCE_EXHAUSTED') || 
          errText.includes('quota') ||
          errText.includes('Limite')
        ) {
          throw new Error("Nossos servidores estão muito cheios no momento (O Teólogo está descansando). Por favor, tente novamente em alguns minutos.");
        }
        throw new Error(errText);
      }
      
      const data = await response.json();
      setGeneratedBg(data.image);

      // Registra consumo das APIs
      recordApiUsage('unsplash');
      recordApiUsage('gemini');

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        if (!profile?.isPremium && !isAdmin) {
          await updateDoc(userRef, { hasUsedFreeImage: true });
        } else if (profile?.isPremium && !isAdmin) {
          await updateDoc(userRef, { 
            dailyImageCount: currentCount + 1,
            lastImageDate: todayStr
          });
        }
      }
    } catch (error: any) {
      let msg = error?.message || "Não foi possível carregar a imagem da IA. Aplicando fundo padrão.";
      if (
        msg.includes('429') || 
        msg.includes('RESOURCE_EXHAUSTED') || 
        msg.includes('quota')
      ) {
        msg = "Nossos servidores estão muito cheios no momento (O Teólogo está descansando). Por favor, tente novamente em alguns minutos.";
      }
      toast.error(msg);
      console.error(error);
      setUseFallbackBg(true);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleShareImage = async () => {
    if (!cardRef.current) return;
    
    try {
      const toastId = toast.success("Preparando imagem...");
      const dataUrl = await htmlToImage.toPng(cardRef.current, { 
        cacheBust: true, 
        pixelRatio: 2,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });

      if (navigator.share) {
        try {
          const blob = await (await fetch(dataUrl)).blob();
          const file = new File([blob], 'devocional.png', { type: 'image/png' });
          await navigator.share({
            title: 'Devocional Florescer',
            text: 'Olha que linda essa palavra do dia!',
            files: [file]
          });
          toast.success("Pronto!");
          return;
        } catch (shareError: any) {
          if (shareError.name !== 'AbortError') {
             console.error('Share failed', shareError);
          }
        }
      }
      
      // Fallback
      const link = document.createElement('a');
      link.download = `devocional-${new Date().getTime()}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Imagem baixada com sucesso!");
    } catch (error) {
      console.error('Error sharing image:', error);
      toast.error('Não foi possível gerar a imagem. Tente novamente.');
    }
  };

  const cardRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markedDevotionalIdRef = useRef<string>('');
  
  // Anti-Cheat Reading Mission State & Refs (Dynamic Reading Calculation + Scroll to end)
  const timeSpentOnDevotionalRef = useRef<number>(0);
  const hasScrolledToEndRef = useRef<boolean>(false);
  const hasAwardedReadingCoinRef = useRef<boolean>(false);

  // Cálculo de Tempo Dinâmico com base no número de palavras do texto
  const requiredReadingTime = useMemo(() => {
    if (!devotional) return 15;
    const fullText = [
      devotional.title || '',
      devotional.beautifulWord || '',
      displayVerseText || '',
      devotional.content || '',
      devotional.description || ''
    ].join(' ');
    
    // Contagem de palavras reais
    const words = fullText.trim().split(/\s+/).filter(Boolean);
    const wordCount = words.length;

    // Média humana de leitura: 250 palavras por minuto. Piso mínimo amigável de 15 segundos.
    const dynamicSeconds = Math.max(15, Math.floor((wordCount / 250) * 60));
    return dynamicSeconds;
  }, [devotional, displayVerseText]);

  const scrollToTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement?.scrollTo({ top: 0, behavior: 'smooth' });
      document.body?.scrollTo({ top: 0, behavior: 'smooth' });
      
      if (containerRef.current) {
        containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        if (containerRef.current.parentElement) {
          containerRef.current.parentElement.scrollTo({ top: 0, behavior: 'smooth' });
        }
      }
    } catch (e) {
      console.warn("Error scrolling to top:", e);
    }
  };

  useEffect(() => {
    if (devotional?.id) {
      scrollToTop();
      timeSpentOnDevotionalRef.current = 0;
      hasScrolledToEndRef.current = false;
      hasAwardedReadingCoinRef.current = false;

      if (markedDevotionalIdRef.current !== devotional.id) {
        markedDevotionalIdRef.current = devotional.id;
        markAsRead(devotional.id, devotional.theme);
      }
    }
  }, [devotional?.id, devotional?.theme, markAsRead]);

  // Anti-Cheat Engine: Verificação simultânea de Tempo Dinâmico de Leitura + Scroll ao final
  useEffect(() => {
    if (!devotional?.id || !user) return;

    const today = format(new Date(), 'yyyy-MM-dd');
    const isReadingClaimedToday = Boolean(
      profile?.claimedDailyMissions?.includes(`devotional_reading_${today}`) || 
      (typeof window !== 'undefined' && localStorage.getItem(`claimed_mission_devotional_reading_${user.uid}_${today}`) === 'true')
    );
    if (isReadingClaimedToday) {
      hasAwardedReadingCoinRef.current = true;
      return;
    }

    const devStorageKey = `devotional_mission_${user.uid}_${today}`;
    
    // Carrega progresso anterior de hoje se houver
    try {
      const stored = localStorage.getItem(devStorageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.timeSpent) timeSpentOnDevotionalRef.current = Math.max(timeSpentOnDevotionalRef.current, parsed.timeSpent);
        if (parsed.scrolled) hasScrolledToEndRef.current = true;
        if (parsed.completed) hasAwardedReadingCoinRef.current = true;
      }
    } catch (e) {}

    const saveAndCheckProgress = () => {
      const isCompleted = timeSpentOnDevotionalRef.current >= requiredReadingTime && hasScrolledToEndRef.current;
      
      try {
        localStorage.setItem(devStorageKey, JSON.stringify({
          timeSpent: timeSpentOnDevotionalRef.current,
          requiredTime: requiredReadingTime,
          scrolled: hasScrolledToEndRef.current,
          completed: isCompleted
        }));
      } catch (e) {}

      if (isCompleted && !hasAwardedReadingCoinRef.current) {
        hasAwardedReadingCoinRef.current = true;
        toast.success('🎯 Missão Concluída: Leitura do devocional finalizada! Abra o menu Missões para resgatar sua Moeda 🎁');
      }
    };

    // 1. Contador de tempo ativo na tela
    let isVisible = document.visibilityState === 'visible';
    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const timer = setInterval(() => {
      if (!isVisible) return;
      timeSpentOnDevotionalRef.current += 1;
      saveAndCheckProgress();
    }, 1000);

    // 2. Detecção de Scroll até o final do texto
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // Se o usuário rolou até 88% ou mais da página (ou últimos 300px)
      if (scrollY + windowHeight >= docHeight - 300 || (scrollY + windowHeight) / docHeight >= 0.88) {
        hasScrolledToEndRef.current = true;
        saveAndCheckProgress();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [devotional?.id, user?.uid, profile?.lastCoinDate, requiredReadingTime, awardDailyCoin, toast]);

  const handleShare = () => {
    const textToShare = `${devotional.title} - ${devotional.beautifulWord}\n\n${devotional.content}\n\nCompartilhado do Devocional App`;
    const encodedText = encodeURIComponent(textToShare);
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodedText}`;
    
    // Abre no navegador padrão (celular ou whatsapp web)
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  

  const handleGenerateAI = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const isTodayDate = profile?.lastGenerationDate === today;
    const currentCount = isTodayDate ? (profile?.aiGenerationsCount || 0) : 0;
    const isPremium = profile?.isPremium === true;
    const maxAllowed = isAdmin ? 9999 : (isPremium ? 10 : 1);

    if (!isAdmin && currentCount >= maxAllowed) {
      if (!isPremium) {
        setShowFreeLimitModal(true);
      } else {
        setShowAILimitModal(true);
      }
      return;
    }

    try {
      setIsGenerating(true);
      const newDevotional = await generateDevotional(
        devotional.theme,
        profile?.name,
        profile?.faithJourney,
        profile?.needArea,
        devotional.beautifulWord
      );
      addCustomDevotional(newDevotional);

      if (user) {
        try {
          const userRef = doc(db, 'users', user.uid);
          await updateDoc(userRef, {
            aiGenerationsCount: currentCount + 1,
            lastGenerationDate: today
          });
        } catch (err) {
          console.error("Error updating AI count:", err);
        }
      }

      if (onGenerated) {
        onGenerated(newDevotional);
      }

      // Rola a página suavemente para o topo para a leitura da nova palavra
      setTimeout(() => {
        scrollToTop();
      }, 50);
      setTimeout(() => {
        scrollToTop();
      }, 250);
    } catch (error: any) {
      toast.error(error.message || "Houve um erro ao tentar gerar seu devocional inédito. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-sm leading-relaxed';
      case 'lg': return 'text-lg leading-loose';
      case 'xl': return 'text-xl leading-loose';
      default: return 'text-base leading-relaxed';
    }
  };

  return (
    <div ref={containerRef} className="pb-24 bg-[#FAFAFA] dark:bg-slate-900 min-h-screen overflow-y-auto transition-colors duration-200">
      {/* Navbar fixa */}
      <div className="sticky top-0 bg-[#FAFAFA]/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 z-10 px-4 py-3 flex items-center justify-between transition-colors duration-200">
        <button 
          onClick={onBack}
          className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-semibold uppercase tracking-wider text-yellow-500 bg-yellow-50 dark:bg-yellow-900/30 dark:text-yellow-300 px-3 py-1 rounded-full">
          {devotional.theme}
        </span>
        <div className="flex items-center gap-1">
          <button 
            onClick={cycleFontSize}
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400 rounded-full hover:bg-yellow-50 dark:hover:bg-slate-800 transition-colors"
            title="Ajustar Tamanho da Fonte"
          >
            <Type className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 max-w-prose mx-auto">
        <h1 className="text-3xl font-bold font-serif text-gray-900 dark:text-white mb-4 leading-tight transition-colors duration-200">
          {devotional.title}
        </h1>
        
        {devotional.description && !devotional.description.endsWith('...') && (
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 font-medium leading-relaxed">
            {devotional.description}
          </p>
        )}

        {/* Citação do Versículo em Destaque */}
        {(() => {
          if (!displayVerseText && !displayVerseRef && !loadingVerseText) return null;

          const verseText = displayVerseText;
          const verseRef = displayVerseRef;

          const handleCopyVerse = () => {
            if (!verseText) return;
            const textToCopy = verseRef 
              ? `"${verseText}" (${verseRef})`
              : `"${verseText}"`;
            navigator.clipboard.writeText(textToCopy);
            setCopiedVerse(true);
            toast.success("Versículo copiado!");
            setTimeout(() => setCopiedVerse(false), 2500);
          };

          const handleOpenInBible = () => {
            if (!verseRef) {
              if (onChangeTab) onChangeTab('bible');
              return;
            }
            const parsed = parseVerseReference(verseRef);
            if (parsed && onNavigateToBible) {
              onNavigateToBible(parsed);
            } else if (onChangeTab) {
              onChangeTab('bible');
            }
          };

          return (
            <div className="relative my-6 bg-amber-50/60 dark:bg-amber-950/20 rounded-2xl p-5 sm:p-6 border border-amber-200/70 dark:border-amber-900/40 shadow-xs transition-colors">
              <div className="flex items-start gap-3.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 mt-0.5">
                  <Quote className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <blockquote className="text-lg sm:text-xl font-serif text-gray-800 dark:text-gray-100 italic leading-relaxed">
                    {loadingVerseText && !verseText ? (
                      <span className="inline-flex items-center gap-2 text-amber-700 dark:text-amber-300 font-sans text-sm not-italic animate-pulse">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                        Carregando versículo sagrado...
                      </span>
                    ) : (
                      `"${verseText}"`
                    )}
                  </blockquote>
                  
                  {verseRef && (
                    <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 flex flex-wrap items-center justify-between gap-2.5">
                      <span className="font-serif font-bold text-sm text-amber-800 dark:text-amber-300">
                        — {verseRef}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleCopyVerse}
                          disabled={!verseText || loadingVerseText}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:text-amber-600 dark:hover:text-amber-400 disabled:opacity-40 px-3 py-1.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-gray-200/80 dark:border-slate-700 hover:border-amber-300 dark:hover:border-amber-700 transition-all shadow-xs active:scale-95 cursor-pointer"
                          title="Copiar versículo"
                        >
                          {copiedVerse ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{copiedVerse ? 'Copiado!' : 'Copiar'}</span>
                        </button>
                        
                        <button
                          onClick={handleOpenInBible}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-900 dark:text-amber-100 hover:bg-amber-200/80 dark:hover:bg-amber-900/80 px-3 py-1.5 rounded-xl bg-amber-100/90 dark:bg-amber-900/60 border border-amber-300/80 dark:border-amber-700/60 transition-all shadow-xs active:scale-95 cursor-pointer"
                          title="Ler este capítulo e versículo na Bíblia"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-amber-700 dark:text-amber-300" />
                          <span>Ler na Bíblia</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}

        {/* Corpo do Texto e Oração */}
        {(() => {
          const { paragraphs, prayer } = parseDevotionalContent(devotional.content);
          return (
            <>
              <div className={cn("space-y-6 text-gray-700 dark:text-gray-300 mb-8 transition-all duration-200", getFontSizeClass())}>
                {paragraphs.map((paragraph, index) => (
                  <p key={index} className="leading-relaxed">{paragraph}</p>
                ))}
              </div>

              {prayer && (
                <div className="mb-10 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-yellow-50/80 dark:from-slate-800 dark:via-amber-950/20 dark:to-slate-800/90 rounded-2xl p-5 sm:p-6 border border-amber-200/70 dark:border-amber-900/40 shadow-xs">
                  <div className="flex items-center gap-2 mb-3 text-amber-800 dark:text-amber-300 font-serif font-bold text-base">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>Oração do Dia</span>
                  </div>
                  <p className={cn("font-serif italic text-gray-700 dark:text-gray-200 leading-relaxed", getFontSizeClass())}>
                    {prayer}
                  </p>
                </div>
              )}
            </>
          );
        })()}

        {/* Botão de Compartilhar */}
        <div className="grid grid-cols-2 gap-3 mb-12">
          <button
            onClick={handleShare}
            className="w-full flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#20bd5a] text-white py-3.5 px-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition-all text-sm"
          >
            <Share2 className="w-4 h-4" />
            WhatsApp
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-700 text-white py-3.5 px-4 rounded-2xl font-semibold shadow-sm active:scale-[0.98] transition-all text-sm"
          >
            <ImageIcon className="w-4 h-4" />
            Gerar Imagem
          </button>
        </div>

        {/* AI Generator Placeholder / Completion CTA */}
        {(() => {
          const themeDevs = adminDevotionals.filter(d => d.theme === devotional.theme);
          const isThemeCompleted = themeDevs.length > 0 && themeDevs.every(d => readHistory.includes(d.id) || d.id === devotional.id);

          if (isThemeCompleted) {
            return (
              <div className="mt-8 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-yellow-200 dark:border-yellow-900/50 text-center transition-colors duration-200 shadow-sm">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  🎉 Jornada Concluída!
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-5 leading-relaxed">
                  Você finalizou os devocionais base deste tema. Deseja ir além? Utilize a Inteligência Artificial para gerar reflexões infinitas e inéditas sobre este assunto!
                </p>
                <button 
                  onClick={() => {
                    if (onCreateNew) {
                      onCreateNew(devotional.theme);
                    }
                  }}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm"
                >
                  ✨ Gerar Reflexão Inédita
                </button>
              </div>
            );
          }

          return (
            <div className="mt-8 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-6 border border-yellow-100 dark:border-yellow-900/50 text-center transition-colors duration-200">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-500 dark:text-yellow-400 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Quer ir mais fundo?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
                Gere uma reflexão inédita sobre este tema, criada por IA especialmente para o seu momento.
              </p>
              <button 
                id="btn-generate-ai-devotional"
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="w-full bg-yellow-500 hover:bg-yellow-600 active:bg-yellow-700 text-white font-medium px-4 py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-80 disabled:cursor-not-allowed shadow-sm"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin shrink-0" />
                    <span className="text-xs sm:text-sm font-medium whitespace-nowrap">Buscando palavra...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 shrink-0 text-yellow-100" />
                    <span className="text-xs sm:text-sm md:text-base font-semibold whitespace-nowrap truncate">
                      Receber Nova Palavra
                    </span>
                    {!isAdmin && (
                      <span className="text-[11px] font-medium bg-black/15 dark:bg-white/20 px-2 py-0.5 rounded-full whitespace-nowrap">
                        {isPremiumUser 
                          ? `${remainingAiGenerations}/10 hoje`
                          : (remainingAiGenerations > 0 ? "1 grátis hoje" : "Limite 1/1 hoje")
                        }
                      </span>
                    )}
                    {!isPremiumUser && !isAdmin && remainingAiGenerations === 0 && (
                      <Crown className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 text-yellow-200 fill-yellow-200/40" />
                    )}
                  </>
                )}
              </button>
            </div>
          );
        })()}
      </div>

      
      
      {/* Modal de Compartilhamento de Imagem - Estúdio */}
      {showShareModal && (
        <div 
          className="fixed inset-0 z-[100] flex flex-col bg-white/95 dark:bg-slate-900/95 sm:p-6 overflow-hidden backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowShareModal(false)}
        >
          <div 
            className="flex-1 flex flex-col w-full h-full max-w-lg mx-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 sm:p-0 sm:mb-6 border-b border-slate-200 dark:border-white/10 sm:border-0">
              <h3 className="text-slate-900 dark:text-white font-bold text-lg flex items-center gap-2">
                <Palette className="w-5 h-5 text-yellow-500" /> Estúdio de Criação
              </h3>
              <button 
                onClick={() => setShowShareModal(false)}
                className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 dark:bg-white/10 dark:text-white/70 dark:hover:text-white rounded-full transition-colors"
                aria-label="Fechar estúdio"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
              
              {/* Controles da IA */}
              <div className="w-full max-w-sm mb-6 space-y-4">
                <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-200 dark:border-white/10">
                  <label className="text-slate-700 dark:text-white/80 text-sm font-medium mb-2 block">
                    Fundo Gerado por IA
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      placeholder="Ex: Jardim com flores ao amanhecer..."
                      className="flex-1 bg-white dark:bg-black/30 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-white/30 outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500 transition-all"
                    />
                    <button 
                      onClick={() => handleGenerateBg(customPrompt)}
                      disabled={isGeneratingImage || !customPrompt.trim()}
                      className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-white p-2 rounded-lg transition-colors flex items-center justify-center min-w-[40px]"
                    >
                      {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : 
                        (!profile?.isPremium && !isAdmin && profile?.hasUsedFreeImage ? <Lock className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />)
                      }
                    </button>
                  </div>
                  
                  <div className="mt-2 text-center flex items-center justify-center gap-1">
                    {isAdmin ? (
                      <span className="text-xs text-yellow-600 dark:text-yellow-500 font-medium flex items-center gap-1">👑 Acesso Ilimitado</span>
                    ) : (
                      <>
                        {!profile?.isPremium ? (
                          profile?.hasUsedFreeImage ? (
                             <span className="text-xs text-yellow-600 dark:text-yellow-500 flex items-center gap-1 font-medium"><Lock className="w-3 h-3" /> Faça upgrade para gerar mais</span>
                          ) : (
                             <span className="text-xs text-yellow-600 dark:text-yellow-500 font-medium">✨ 1 Geração Gratuita Disponível</span>
                          )
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-white/50">Geradas hoje: {profile?.lastImageDate === format(new Date(), 'yyyy-MM-dd') ? (profile?.dailyImageCount || 0) : 0}/5</span>
                        )}
                      </>
                    )}
                  </div>
                  
                  <div className="mt-3">
                    <p className="text-xs text-slate-500 dark:text-white/50 mb-2">Temas Rápidos:</p>
                    <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-3 custom-scrollbar">
                      {presetThemes.map((preset, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setCustomPrompt(preset.prompt);
                            handleGenerateBg(preset.prompt);
                          }}
                          disabled={isGeneratingImage}
                          className="text-xs bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white/90 py-1.5 px-3 rounded-full transition-colors"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* O "Card" que será transformado em imagem (Stories 9:16) */}
              <div 
                ref={cardRef}
                className="w-full max-w-[280px] aspect-[9/16] rounded-2xl shadow-2xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden bg-black ring-1 ring-white/10"
                style={{ padding: '2rem' }}
              >
                {generatedBg ? (
                  <img src={generatedBg} alt="Fundo" className="absolute inset-0 w-full h-full object-cover opacity-80" />
                ) : useFallbackBg ? (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-600 via-rose-800 to-purple-900 opacity-95"></div>
                    <div className="absolute top-0 left-0 w-full h-full opacity-30 mix-blend-overlay bg-gradient-to-tr from-white/20 to-transparent"></div>
                    <div className="absolute -top-24 -right-24 w-56 h-56 bg-white/20 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-black/50 rounded-full blur-3xl"></div>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-yellow-600 via-yellow-700 to-yellow-900 opacity-90"></div>
                    <div className="absolute top-0 left-0 w-full h-full opacity-20 mix-blend-overlay bg-gradient-to-tr from-white/10 to-transparent"></div>
                    <div className="absolute -top-24 -right-24 w-48 h-48 bg-white/20 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-black/40 rounded-full blur-3xl"></div>
                  </>
                )}
                
                {generatedBg && <div className="absolute inset-0 bg-black/40 mix-blend-multiply"></div>}
                
                <div className="relative z-10 flex-1 flex flex-col items-center justify-center w-full mt-8">
                  <QuoteIcon className="w-8 h-8 text-white/60 mb-4 drop-shadow-md" />
                  <p className="text-white font-serif text-lg sm:text-xl font-bold leading-relaxed drop-shadow-xl" style={{ textShadow: '0 2px 10px rgba(0,0,0,0.5)' }}>
                    "{displayVerseText || devotional.title}"
                  </p>
                  {displayVerseRef && (
                    <span className="text-yellow-300 font-serif font-semibold text-xs sm:text-sm mt-3 drop-shadow-md">
                      — {displayVerseRef}
                    </span>
                  )}
                  <div className="w-12 h-1 bg-yellow-400/80 rounded-full mt-6 mb-2" />
                </div>
                
                <div className="relative z-10 mt-auto pt-8 flex flex-col items-center justify-center gap-1 w-full pb-4">
                  <div className="flex items-center gap-2 text-white/90">
                    <div className="w-5 h-5 bg-white/20 rounded-md flex items-center justify-center backdrop-blur-sm">
                      <Sparkles className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs font-bold tracking-wider uppercase drop-shadow-md">Florescer</span>
                  </div>
                  <p className="text-[9px] text-white/60 tracking-widest uppercase mt-1">Devocional App</p>
                </div>
              </div>
              
            </div>

            {/* Z-index adjustment and padding-bottom to avoid nav overlap */}
            <div className="p-4 sm:p-0 sm:mt-6 sm:max-w-sm sm:mx-auto sm:w-full bg-white/90 dark:bg-slate-900/90 border-t border-slate-200 dark:border-white/10 sm:border-0 sm:bg-transparent pb-24 sm:pb-0 z-10">
              <button
                onClick={handleShareImage}
                disabled={isGeneratingImage}
                className="w-full flex items-center justify-center gap-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 disabled:bg-gray-500 text-white py-4 px-6 rounded-2xl font-bold shadow-lg active:scale-[0.98] transition-all"
              >
                <Share2 className="w-5 h-5" />
                Compartilhar Card
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Free Limit Reached Modal (1x/day) */}
      {showFreeLimitModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm relative shadow-2xl text-center border border-yellow-100 dark:border-slate-800">
            <button 
              onClick={() => setShowFreeLimitModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 bg-gray-100 dark:bg-slate-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-14 h-14 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4 mt-2">
              <Crown className="w-7 h-7" />
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Limite Gratuito Atingido</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
              Você já usou sua <strong>1 reflexão diária gratuita</strong> com Inteligência Artificial hoje.<br /><br />
              Deseja gerar até <strong>10 devocionais inéditos por dia</strong>? Assine o Florescer Premium!
            </p>

            <div className="w-full bg-yellow-50/80 dark:bg-yellow-950/30 rounded-xl p-3.5 border border-yellow-100 dark:border-yellow-900/50 mb-5">
              <div className="text-2xl font-black text-gray-900 dark:text-white mb-0.5">R$ 29,90 <span className="text-xs font-normal text-gray-500 dark:text-gray-400">/ mês</span></div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Acesso a 10 gerações diárias e todo conteúdo exclusivo.</p>
            </div>

            <button
              onClick={() => {
                setShowFreeLimitModal(false);
                if (onChangeTab) onChangeTab('profile', 'subscription');
              }}
              className="w-full bg-yellow-500 hover:bg-yellow-600 active:scale-[0.98] text-white font-bold py-3.5 px-4 rounded-xl transition-all shadow-sm text-sm mb-2"
            >
              Desbloquear 10 Gerações / Dia
            </button>

            <button
              onClick={() => setShowFreeLimitModal(false)}
              className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 py-1.5 transition-colors"
            >
              Voltar amanhã para a cota gratuita
            </button>
          </div>
        </div>
      )}

      {/* Generic Premium Modal */}
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
                Desbloqueie criação de fundos mágicos, até 10 reflexões com IA diárias e vídeos exclusivos no Florescer Premium.
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

      {/* AI Fair Use Limit Modal (Premium 10x/day) */}
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
              <Sparkles className="w-7 h-7" />
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

// Ícone auxiliar de aspas
function QuoteIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11.192 15.757c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.15-1.53.92-1.73 1.4-.36 2.59-1.25 3.56-2.67l-2.02-1.55c-.63.95-1.35 1.54-2.15 1.77-1.11.32-1.89.96-2.33 1.91-.44.95-.66 2.05-.66 3.31v.79c0 1.25.26 2.21.78 2.87.52.66 1.25 1.05 2.19 1.17 1.03.13 1.9-.11 2.62-.71.72-.6 1.08-1.45 1.08-2.55zm10.27 0c0-.88-.23-1.618-.69-2.217-.326-.412-.768-.683-1.327-.812-.55-.128-1.07-.137-1.54-.028-.16-.95.15-1.53.92-1.73 1.4-.36 2.59-1.25 3.56-2.67l-2.02-1.55c-.63.95-1.35 1.54-2.15 1.77-1.11.32-1.89.96-2.33 1.91-.44.95-.66 2.05-.66 3.31v.79c0 1.25.26 2.21.78 2.87.52.66 1.25 1.05 2.19 1.17 1.03.13 1.9-.11 2.62-.71.72-.6 1.08-1.45 1.08-2.55z" />
    </svg>
  );
}
