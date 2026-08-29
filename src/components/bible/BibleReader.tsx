import { useState, useEffect, useRef, useCallback } from 'react';
import { BibleBook } from '../../data/bibleBooks';
import { 
  ArrowLeft, 
  Loader2, 
  Bookmark, 
  Type, 
  Square, 
  Crown, 
  ChevronLeft, 
  ChevronRight, 
  Volume2, 
  VolumeX,
  Sparkles, 
  Brain, 
  X, 
  Copy, 
  Check, 
  BookOpen, 
  Lightbulb, 
  HeartHandshake,
  Share2
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { db } from '../../lib/firebase';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useScrollDirection } from '../../hooks/useScrollDirection';
import { useToast } from '../../context/ToastContext';
import { recordApiUsage } from '../../services/apiMetricsService';

interface BibleReaderProps {
  book: BibleBook;
  chapter: number;
  initialVerse?: number;
  onBack: () => void;
  onShowPremium: () => void;
  onSelectChapter?: (chapter: number) => void;
}

interface Verse {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

interface BibleApiResponse {
  reference: string;
  verses: Verse[];
  text: string;
  translation_id: string;
  translation_name: string;
  translation_note: string;
}

interface AIExplanation {
  reference: string;
  text: string;
  context: string;
  meaning: string;
  practicalApplication: string;
  shortPrayer: string;
}

/**
 * Normaliza textos e referências bíblicas para que motores de SpeechSynthesis
 * não leiam números com dois-pontos (ex: 2:4) como horário ("duas horas e quatro minutos").
 */
function cleanTextForSpeech(text: string): string {
  if (!text) return '';
  return text
    // Ex: "2:4-6" -> "capítulo 2, versículos 4 a 6"
    .replace(/(\d+):(\d+)-(\d+)/g, 'capítulo $1, versículos $2 a $3')
    // Ex: "2:4, 5" ou "2:4,5" -> "capítulo 2, versículos 4 e 5"
    .replace(/(\d+):(\d+),\s*(\d+)/g, 'capítulo $1, versículos $2 e $3')
    // Ex: "2:4" -> "capítulo 2, versículo 4"
    .replace(/(\d+):(\d+)/g, 'capítulo $1, versículo $2')
    // Ex: "vs. 4" ou "v. 4" -> "versículo 4"
    .replace(/\b(?:vs\.|v\.)\s*(\d+)/gi, 'versículo $1')
    // Ex: "cap. 2" -> "capítulo 2"
    .replace(/\bcap\.\s*(\d+)/gi, 'capítulo $1')
    // Remove pontuações estranhas, asteriscos ou formatações markdown
    .replace(/[*_#`~[\]]/g, '')
    .trim();
}

export function BibleReader({ book, chapter, initialVerse, onBack, onShowPremium, onSelectChapter }: BibleReaderProps) {
  const toast = useToast();
  const { user, profile, markBibleChapterCompleted, updateBibleLastRead } = useAuth();
  const { fontSize, cycleFontSize } = useSettings();
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedVerses, setSelectedVerses] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const { scrollDirection, isAtTop } = useScrollDirection();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeVerseIndex, setActiveVerseIndex] = useState<number | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // AI Theological Explanation State
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanationResult, setExplanationResult] = useState<AIExplanation | null>(null);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [copiedExplanation, setCopiedExplanation] = useState(false);
  const [isPlayingExplanation, setIsPlayingExplanation] = useState(false);
  const isPlayingExplanationRef = useRef(false);

  const synthRef = useRef<SpeechSynthesis | null>(null);
  const isPlayingRef = useRef(false);
  const timeoutRef = useRef<any>(null);

  const isAdmin = profile?.isAdmin === true || user?.email === 'dofekrafael@gmail.com' || user?.email === 'sjhonatan916@gmail.com' || user?.email === 'floresceremadoracao@gmail.com';
  const hasAccess = profile?.isPremium || isAdmin;

  const isChapterRead = profile?.bibleProgress?.[book.id]?.includes(chapter) || false;

  // Sync state to ref
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  const stopExplanationAudio = useCallback(() => {
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch (e) {
        console.error("Error cancelling explanation speech:", e);
      }
    }
    isPlayingExplanationRef.current = false;
    setIsPlayingExplanation(false);
  }, []);

  const stopAudio = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (synthRef.current) {
      try {
        synthRef.current.cancel();
      } catch (e) {
        console.error("Error cancelling speech:", e);
      }
    }
    isPlayingRef.current = false;
    setIsPlaying(false);
    isPlayingExplanationRef.current = false;
    setIsPlayingExplanation(false);
    setActiveVerseIndex(null);
  }, []);

  // 1. Escuta do Ciclo de Vida (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Limpa timers pendentes
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        // Cancela fala para limpar a fila do navegador
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          try {
            window.speechSynthesis.cancel();
          } catch (e) {
            console.error("Error cancelling speech on visibilitychange:", e);
          }
        }
        // Altera o estado para pausado mantendo o versículo atual salvo em activeVerseIndex
        isPlayingRef.current = false;
        setIsPlaying(false);
        isPlayingExplanationRef.current = false;
        setIsPlayingExplanation(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Initialize SpeechSynthesis and load voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
      
      const loadVoices = () => {
        const availVoices = window.speechSynthesis.getVoices();
        if (availVoices.length > 0) {
          setVoices(availVoices);
        }
      };

      loadVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }

    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const getPortugueseVoice = useCallback((): SpeechSynthesisVoice | null => {
    if (!voices.length && synthRef.current) {
      const currentVoices = synthRef.current.getVoices();
      if (currentVoices.length > 0) setVoices(currentVoices);
    }
    
    const ptVoices = voices.filter(v => v.lang.toLowerCase().startsWith('pt'));
    const ptBrVoice = ptVoices.find(v => 
      v.lang.toLowerCase().includes('br') || 
      v.name.toLowerCase().includes('brazil') || 
      v.name.toLowerCase().includes('portuguese') ||
      v.name.toLowerCase().includes('luciana') ||
      v.name.toLowerCase().includes('felipe')
    );
    
    return ptBrVoice || ptVoices[0] || null;
  }, [voices]);

  const speakVerse = useCallback((index: number, versesList: Verse[]) => {
    // Trava de segurança 1: Aborta se o app estiver em segundo plano ou áudio pausado
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }
    if (!isPlayingRef.current) {
      return;
    }

    if (!versesList || versesList.length === 0 || index < 0 || index >= versesList.length) {
      stopAudio();
      return;
    }

    if (!synthRef.current) return;

    setActiveVerseIndex(index);

    const verse = versesList[index];
    const cleanedVerseText = cleanTextForSpeech(verse.text.trim());
    const textToSpeak = index === 0 
      ? `${book.name}, Capítulo ${chapter}. ${cleanedVerseText}`
      : cleanedVerseText;

    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    const ptVoice = getPortugueseVoice();
    if (ptVoice) {
      utterance.voice = ptVoice;
    }
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Smoothly scroll active verse into view
    const verseElement = document.getElementById(`verse-${verse.verse}`);
    if (verseElement) {
      verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    utterance.onend = () => {
      // 2. Proteção do Incrementador: Trava de segurança contra eventos fantasmas em background
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (!isPlayingRef.current) {
        return;
      }

      if (index + 1 < versesList.length) {
        // Add a short delay (100ms) before speaking the next verse to allow speech synthesis queue to reset cleanly
        timeoutRef.current = setTimeout(() => {
          if (typeof document !== 'undefined' && document.hidden) {
            return;
          }
          if (!isPlayingRef.current) {
            return;
          }
          speakVerse(index + 1, versesList);
        }, 100);
      } else {
        stopAudio();
      }
    };

    utterance.onerror = (err) => {
      // Trava de segurança em caso de erro
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }
      if (!isPlayingRef.current) {
        return;
      }

      console.warn("Speech synthesis error at verse", index, err);
      if (index + 1 < versesList.length) {
        timeoutRef.current = setTimeout(() => {
          if (typeof document !== 'undefined' && document.hidden) {
            return;
          }
          if (!isPlayingRef.current) {
            return;
          }
          speakVerse(index + 1, versesList);
        }, 250);
      } else {
        stopAudio();
      }
    };

    if (synthRef.current.paused) {
      synthRef.current.resume();
    }

    synthRef.current.speak(utterance);
  }, [book.name, chapter, getPortugueseVoice, stopAudio]);

  const handleToggleAudio = () => {
    if (!hasAccess) {
      onShowPremium();
      return;
    }

    if (isPlaying) {
      stopAudio();
    } else {
      if (!verses.length) return;
      
      if (synthRef.current) {
        try {
          synthRef.current.cancel();
        } catch (e) {}
      }

      isPlayingRef.current = true;
      setIsPlaying(true);
      
      let startIndex = 0;
      if (selectedVerses.size > 0) {
        const firstSelected = Math.min(...Array.from(selectedVerses));
        const foundIndex = verses.findIndex(v => v.verse === firstSelected);
        if (foundIndex !== -1) startIndex = foundIndex;
      } else if (activeVerseIndex !== null && activeVerseIndex >= 0 && activeVerseIndex < verses.length) {
        startIndex = activeVerseIndex;
      }
      
      speakVerse(startIndex, verses);
    }
  };

  useEffect(() => {
    const fetchChapter = async () => {
      stopAudio();
      setLoading(true);
      setError(null);
      setSelectedVerses(new Set());
      
      try {
        let query = `${book.id}%20${chapter}`;
        
        if (book.chapters === 1) {
          const versesMap: Record<string, number> = {
            'oba': 21,
            'phm': 25,
            '2jn': 13,
            '3jn': 15,
            'jud': 25
          };
          if (versesMap[book.id]) {
            query = `${book.id}%201:1-${versesMap[book.id]}`;
          }
        }

        const makeRequest = async (retries = 2): Promise<Response> => {
          const response = await fetch(`https://bible-api.com/${query}?translation=almeida`);
          if (response.status === 429 && retries > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            return makeRequest(retries - 1);
          }
          return response;
        };

        let response = await makeRequest();
        
        // Fallback to default translation if almeida fails
        if (!response.ok) {
          response = await fetch(`https://bible-api.com/${query}`);
        }

        if (!response.ok) {
          throw new Error('Falha ao carregar o capítulo');
        }
        
        const data: BibleApiResponse = await response.json();
        setVerses(data.verses);

        if (initialVerse) {
          setSelectedVerses(new Set([initialVerse]));
        }
      } catch (err) {
        setError('Não foi possível carregar o texto bíblico. Verifique sua conexão.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchChapter();
  }, [book, chapter, stopAudio]);

  useEffect(() => {
    if (!loading && initialVerse && verses.length > 0) {
      const scrollToVerse = (retries = 3) => {
        const verseElement = document.getElementById(`verse-${initialVerse}`);
        if (verseElement) {
          verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          verseElement.classList.add('bg-yellow-100', 'dark:bg-yellow-900/40');
          setTimeout(() => {
            verseElement.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/40');
          }, 2000);
        } else if (retries > 0) {
          setTimeout(() => scrollToVerse(retries - 1), 200);
        }
      };
      setTimeout(() => scrollToVerse(), 150);
    }
  }, [loading, initialVerse, verses]);

  // Automatically update last read reference when chapter loads
  const lastRecordedBibleRef = useRef<string>('');
  useEffect(() => {
    const key = `${book.id}-${chapter}`;
    if (!loading && !error && verses.length > 0 && lastRecordedBibleRef.current !== key) {
      lastRecordedBibleRef.current = key;
      updateBibleLastRead(book.id, book.name, chapter);
    }
  }, [loading, error, verses.length, book.id, book.name, chapter, updateBibleLastRead]);

  // Auto-mark chapter as completed when scrolling near bottom of chapter
  useEffect(() => {
    if (!user || loading || error || verses.length === 0) return;
    
    const handleScrollBottom = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      
      // Se rolou até próximo do final (últimos 250px da página), marca inteligentemente como lido
      if (scrollY + windowHeight >= docHeight - 250) {
        markBibleChapterCompleted(book.id, book.name, chapter, true).catch(() => {});
      }
    };

    window.addEventListener('scroll', handleScrollBottom, { passive: true });
    return () => window.removeEventListener('scroll', handleScrollBottom);
  }, [user?.uid, book.id, book.name, chapter, loading, error, verses.length, markBibleChapterCompleted]);

  const toggleVerseSelection = (verseNumber: number) => {
    const newSelected = new Set(selectedVerses);
    if (newSelected.has(verseNumber)) {
      newSelected.delete(verseNumber);
    } else {
      newSelected.add(verseNumber);
    }
    setSelectedVerses(newSelected);
  };

  const handleNavigateChapter = (targetChapter: number) => {
    // Se o usuário avançar de capítulo, marca o capítulo atual como concluído de forma inteligente
    if (user && targetChapter > chapter) {
      markBibleChapterCompleted(book.id, book.name, chapter, true).catch(() => {});
    }
    stopAudio();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (onSelectChapter) {
      onSelectChapter(targetChapter);
    }
  };

  const handleSaveVerses = async () => {
    if (!user || selectedVerses.size === 0) return;
    
    setIsSaving(true);
    try {
      const versesToSave = Array.from(selectedVerses).map(verseNum => verses.find(v => v.verse === verseNum)!);
      
      const reference = `${book.name} ${chapter}:${versesToSave.map(v => v.verse).join(', ')}`;
      const text = versesToSave.map(v => v.text.trim()).join(' ');

      const verseRef = doc(collection(db, 'users', user.uid, 'savedVerses'));
      await setDoc(verseRef, {
        reference,
        text,
        createdAt: serverTimestamp()
      });

      setSelectedVerses(new Set());
      toast.success('Mensagem guardada com segurança! ✅');
    } catch (err) {
      console.error("Error saving verses:", err);
      toast.error('Erro ao salvar versículos. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExplainWithAI = async () => {
    if (!hasAccess) {
      setShowPaywallModal(true);
      return;
    }

    if (selectedVerses.size === 0) {
      toast.info('💡 Toque em um versículo do texto para que o Teólogo IA explique.');
      return;
    }

    const selectedVersesList = Array.from(selectedVerses)
      .sort((a, b) => a - b)
      .map(verseNum => verses.find(v => v.verse === verseNum)!)
      .filter(Boolean);

    if (selectedVersesList.length === 0) return;

    const reference = `${book.name} ${chapter}:${selectedVersesList.map(v => v.verse).join(', ')}`;
    const text = selectedVersesList.map(v => v.text.trim()).join(' ');

    setIsExplaining(true);
    try {
      // 1. OTIMIZAÇÃO DE CUSTOS: Consulta primeiro o Cache Global no Firestore
      const cleanBookId = (book.id || book.name).toLowerCase().replace(/[^a-z0-9]/g, '');
      const sortedVerseNumbers = selectedVersesList.map(v => v.verse);
      const cacheDocId = `${cleanBookId}_c${chapter}_v${sortedVerseNumbers.join('-')}`;
      const cacheRef = doc(db, 'bible_explanations', cacheDocId);

      try {
        const cachedSnap = await getDoc(cacheRef);
        if (cachedSnap.exists()) {
          const cachedData = cachedSnap.data();
          if (cachedData && (cachedData.context || cachedData.meaning)) {
            setExplanationResult({
              reference: cachedData.reference || reference,
              text: cachedData.text || text,
              context: cachedData.context || '',
              meaning: cachedData.meaning || '',
              practicalApplication: cachedData.practicalApplication || '',
              shortPrayer: cachedData.shortPrayer || ''
            });
            // Registra economia de cache no monitoramento
            recordApiUsage('cache_hit');
            setIsExplaining(false);
            return;
          }
        }
      } catch (cacheErr) {
        console.warn('Cache lookup error, proceeding with API call:', cacheErr);
      }

      // 2. Se não existir no cache, chama a API do Gemini
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 35000);

      const payload = JSON.stringify({
        reference,
        text,
        bookId: book.id,
        bookName: book.name,
        chapter,
        verseNumbers: sortedVerseNumbers,
        cacheDocId
      });

      let res: Response;
      try {
        res = await fetch('/api/gemini/explain-verse', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: payload,
          signal: controller.signal
        });
      } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
          throw new Error('A requisição demorou muito para responder (Tempo limite esgotado). Verifique sua conexão e a chave GEMINI_API_KEY na Vercel.');
        }
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res.ok) {
        let errorMsg = `Erro ${res.status}: Falha ao consultar o Teólogo.`;
        try {
          const errData = await res.json();
          if (errData?.error) {
            errorMsg = errData.error;
          }
        } catch {
          // not json
        }
        
        // 3. BLINDAGEM CONTRA RATE LIMIT (ERRO 429)
        if (
          res.status === 429 || 
          errorMsg.includes('429') || 
          errorMsg.includes('RESOURCE_EXHAUSTED') || 
          errorMsg.includes('quota') ||
          errorMsg.includes('Limite')
        ) {
          throw new Error('Nossos servidores estão muito cheios no momento (O Teólogo está descansando). Por favor, tente novamente em alguns minutos.');
        }

        if (res.status === 404) {
          errorMsg = "Rota da API não encontrada (404). Verifique as variáveis de ambiente e o deploy na Vercel.";
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      if (!data || (!data.context && !data.meaning && !data.practicalApplication)) {
        throw new Error('A resposta do Teólogo veio incompleta. Tente selecionar o versículo novamente.');
      }

      // Salva no estado da UI
      setExplanationResult({
        reference,
        text,
        context: data.context || '',
        meaning: data.meaning || '',
        practicalApplication: data.practicalApplication || '',
        shortPrayer: data.shortPrayer || ''
      });

      // Dupla garantia: Tenta salvar no Firestore pelo cliente caso a API backend tenha sido executada sem permissão de escrita
      try {
        console.log(`[BibleReader] Gravando cache no Firestore via cliente: bible_explanations/${cacheDocId}`);
        await setDoc(cacheRef, {
          reference,
          text,
          bookId: book.id,
          bookName: book.name,
          chapter,
          verseNumbers: sortedVerseNumbers,
          context: data.context || '',
          meaning: data.meaning || '',
          practicalApplication: data.practicalApplication || '',
          shortPrayer: data.shortPrayer || '',
          createdAt: new Date().toISOString(),
          cachedBy: user?.uid || 'anonymous'
        }, { merge: true });
        console.log(`[BibleReader] Cache cliente gravado com sucesso: ${cacheDocId}`);
      } catch (saveCacheErr) {
        console.warn('[BibleReader] Aviso ao salvar explicação no cache do Firestore via cliente:', saveCacheErr);
      }

      // Registra consumo ou economia de cache
      if (data.cached) {
        recordApiUsage('cache_hit');
      } else {
        recordApiUsage('gemini');
      }
    } catch (err: any) {
      console.error("AI Explanation error:", err);
      let displayMessage = err.message || 'Não foi possível consultar o Teólogo. Tente novamente.';
      if (
        displayMessage.includes('429') || 
        displayMessage.includes('RESOURCE_EXHAUSTED') || 
        displayMessage.includes('quota')
      ) {
        displayMessage = 'Nossos servidores estão muito cheios no momento (O Teólogo está descansando). Por favor, tente novamente em alguns minutos.';
      }
      toast.error(displayMessage);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleToggleExplanationAudio = () => {
    if (isPlayingExplanation) {
      stopExplanationAudio();
      return;
    }

    if (!explanationResult) return;

    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      toast.error('Leitor de áudio não suportado no seu navegador.');
      return;
    }

    // Stop Bible chapter audio if it is playing
    stopAudio();

    const cleanRef = cleanTextForSpeech(explanationResult.reference);
    const partsToSpeak = [
      `Explicação teológica de ${cleanRef}.`,
      `Texto: ${cleanTextForSpeech(explanationResult.text)}.`,
      `Contexto histórico e teológico: ${cleanTextForSpeech(explanationResult.context)}.`,
      `Significado da mensagem: ${cleanTextForSpeech(explanationResult.meaning)}.`,
      `Como aplicar na sua vida hoje: ${cleanTextForSpeech(explanationResult.practicalApplication)}.`,
      explanationResult.shortPrayer ? `Oração: ${cleanTextForSpeech(explanationResult.shortPrayer)}` : ''
    ].filter(Boolean);

    const fullSpeechText = partsToSpeak.join(' ');

    const utterance = new SpeechSynthesisUtterance(fullSpeechText);
    const ptVoice = getPortugueseVoice();
    if (ptVoice) {
      utterance.voice = ptVoice;
    }
    utterance.lang = 'pt-BR';
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      isPlayingExplanationRef.current = false;
      setIsPlayingExplanation(false);
    };

    utterance.onerror = (err) => {
      console.warn("Explanation speech error:", err);
      isPlayingExplanationRef.current = false;
      setIsPlayingExplanation(false);
    };

    isPlayingExplanationRef.current = true;
    setIsPlayingExplanation(true);

    try {
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.error("Error starting explanation speech:", e);
      isPlayingExplanationRef.current = false;
      setIsPlayingExplanation(false);
    }
  };

  const handleCopyExplanation = () => {
    if (!explanationResult) return;
    const shareText = `📖 ${explanationResult.reference}\n"${explanationResult.text}"\n\n🏛️ CONTEXTO:\n${explanationResult.context}\n\n💡 SIGNIFICADO:\n${explanationResult.meaning}\n\n🌿 APLICAÇÃO PRÁTICA:\n${explanationResult.practicalApplication}\n\n🙏 ORAÇÃO:\n${explanationResult.shortPrayer}\n\n✨ Explicado pelo Teólogo Particular do Florescer`;
    
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareText);
      setCopiedExplanation(true);
      toast.success('Explicação copiada com sucesso! 📋');
      setTimeout(() => setCopiedExplanation(false), 2500);
    }
  };

  const handleShareExplanation = async () => {
    if (!explanationResult) return;
    const shareText = `📖 ${explanationResult.reference}\n"${explanationResult.text}"\n\n💡 REFLEXÃO & SIGNIFICADO:\n${explanationResult.meaning}\n\n🌿 APLICAÇÃO PRÁTICA:\n${explanationResult.practicalApplication}\n\n🙏 ORAÇÃO:\n${explanationResult.shortPrayer}\n\n✨ Florescer Devocional`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Explicação: ${explanationResult.reference}`,
          text: shareText
        });
      } catch (err) {
        // User dismissed
      }
    } else {
      handleCopyExplanation();
    }
  };

  const getFontSizeClass = () => {
    switch (fontSize) {
      case 'sm': return 'text-sm';
      case 'lg': return 'text-lg';
      case 'xl': return 'text-xl';
      default: return 'text-base';
    }
  };

  return (
    <div className="pb-24 bg-[#FAFAFA] dark:bg-slate-900 min-h-screen transition-colors duration-200 relative">
      {/* Fixed Sticky Header */}
      <div 
        className={cn(
          "sticky top-0 bg-[#FAFAFA]/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 z-20 px-3 sm:px-5 py-3 flex items-center justify-between gap-2 transition-all duration-300",
          !isAtTop && scrollDirection === 'down' ? "-translate-y-full opacity-0" : "translate-y-0 opacity-100"
        )}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button 
            onClick={onBack}
            className="p-2 -ml-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white rounded-full hover:bg-gray-200/60 dark:hover:bg-slate-800 transition-colors shrink-0"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-base sm:text-lg font-bold font-serif text-gray-900 dark:text-white truncate">
            {book.name} {chapter}
          </h2>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button 
            onClick={handleToggleAudio}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full transition-all text-xs font-semibold shadow-xs active:scale-95",
              isPlaying 
                ? "bg-red-500 text-white dark:bg-red-600 animate-pulse"
                : "bg-yellow-500 text-white hover:bg-yellow-600 dark:bg-yellow-600 dark:hover:bg-yellow-500"
            )}
            title="Ouvir Capítulo em Áudio"
          >
            {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span className="hidden xs:inline">{isPlaying ? 'Parar Áudio' : 'Ouvir'}</span>
            {!hasAccess && <Crown className="w-3 h-3 text-yellow-200 ml-0.5" />}
          </button>

          {/* Action Button: Teólogo IA / Explicar */}
          <button 
            onClick={handleExplainWithAI}
            disabled={isExplaining}
            className={cn(
              "flex items-center gap-1.5 text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-full transition-all shadow-xs active:scale-95 disabled:opacity-50",
              selectedVerses.size > 0
                ? "text-white bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 shadow-amber-500/20 ring-2 ring-amber-400/40 animate-pulse"
                : "text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-950/70 hover:bg-amber-200 dark:hover:bg-amber-900/60 border border-amber-300/60 dark:border-amber-700/50"
            )}
            title={selectedVerses.size > 0 ? "Explicar versículos selecionados com IA" : "Teólogo IA - Explicação teológica de versículos"}
          >
            {isExplaining ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className={cn("w-3.5 h-3.5", selectedVerses.size > 0 ? "fill-current" : "text-amber-600 dark:text-amber-400 fill-current")} />
            )}
            <span>
              {selectedVerses.size > 0 
                ? `Explicar (${selectedVerses.size})` 
                : 'Teólogo IA'}
            </span>
            {!hasAccess && <Crown className="w-3 h-3 text-amber-500 dark:text-amber-400" />}
          </button>
          
          {selectedVerses.size > 0 && (
            <button 
              onClick={handleSaveVerses}
              disabled={isSaving}
              className="hidden xs:flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-300 px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-yellow-200 dark:hover:bg-yellow-900/60 transition-colors disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bookmark className="w-3.5 h-3.5 fill-current" />
              )}
              <span>Guardar</span>
            </button>
          )}
          <button 
            onClick={cycleFontSize}
            className="p-2 text-gray-600 dark:text-gray-300 hover:text-yellow-600 dark:hover:text-yellow-400 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            title="Ajustar Tamanho da Fonte"
          >
            <Type className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-6 py-6 max-w-prose mx-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 text-yellow-500">
            <Loader2 className="w-8 h-8 animate-spin mb-4" />
            <p className="text-sm text-gray-500 font-medium">Carregando {book.name} {chapter}...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-xl text-sm mb-6 text-center">
            {error}
          </div>
        )}

        {!loading && !error && (
          <>
            <div className={cn("space-y-2 transition-all duration-200", getFontSizeClass())}>
              {verses.map((verse, idx) => {
                const isSelected = selectedVerses.has(verse.verse);
                const isSpeakingCurrent = activeVerseIndex === idx;

                return (
                  <div
                    key={verse.verse}
                    id={`verse-${verse.verse}`}
                    onClick={() => toggleVerseSelection(verse.verse)}
                    className={cn(
                      "cursor-pointer rounded-xl p-2.5 transition-all duration-200 relative select-none",
                      isSpeakingCurrent
                        ? "bg-yellow-100 dark:bg-yellow-950/70 border-l-4 border-yellow-500 shadow-xs"
                        : isSelected 
                          ? "bg-yellow-50 dark:bg-yellow-900/40 border border-yellow-200/60 dark:border-yellow-800/40 shadow-xs" 
                          : "hover:bg-gray-100/80 dark:hover:bg-slate-800/60"
                    )}
                  >
                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-serif transition-colors duration-200">
                      <sup className={cn(
                        "font-sans font-bold text-xs mr-2 relative -top-1 transition-colors duration-200 select-none",
                        isSpeakingCurrent
                          ? "text-yellow-700 dark:text-yellow-400 font-extrabold text-sm"
                          : isSelected ? "text-yellow-600 dark:text-yellow-400" : "text-gray-400 dark:text-gray-500"
                      )}>
                        {verse.verse}
                      </sup>
                      <span className={cn(
                        isSpeakingCurrent 
                          ? "text-yellow-950 dark:text-yellow-100 font-medium" 
                          : isSelected && "text-yellow-900 dark:text-yellow-200 font-medium"
                      )}>
                        {verse.text.trim()}
                      </span>
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Bottom Chapter Navigation Bar */}
            {onSelectChapter && book.chapters > 1 && (
              <div className="mt-8 pt-5 border-t border-gray-200 dark:border-slate-800 flex items-center justify-between gap-2 sm:gap-4">
                {chapter > 1 ? (
                  <button
                    onClick={() => handleNavigateChapter(chapter - 1)}
                    className="flex items-center gap-1.5 px-3.5 sm:px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 active:scale-95 transition-all shadow-xs"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Capítulo {chapter - 1}</span>
                  </button>
                ) : (
                  <div className="w-20 sm:w-24 pointer-events-none" />
                )}

                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                  Cap. {chapter} de {book.chapters}
                </span>

                {chapter < book.chapters ? (
                  <button
                    onClick={() => handleNavigateChapter(chapter + 1)}
                    className="flex items-center gap-1.5 px-3.5 sm:px-5 py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 active:scale-95 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-yellow-500/20"
                  >
                    <span>Capítulo {chapter + 1}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="text-right">
                    <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800/40">
                      Livro Concluído 🎉
                    </span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Bottom Action Bar for Selected Verses */}
      {selectedVerses.size > 0 && (
        <div className="fixed bottom-20 sm:bottom-8 left-0 right-0 z-50 px-4 pointer-events-none flex justify-center animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="bg-white/95 dark:bg-slate-800/95 backdrop-blur-md px-3.5 py-2.5 rounded-2xl shadow-2xl border border-yellow-200/80 dark:border-slate-700 pointer-events-auto flex items-center gap-2 max-w-md w-full justify-between">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate">
                {selectedVerses.size} {selectedVerses.size === 1 ? 'versículo' : 'versículos'}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Botão: Explicar com IA (Teólogo Particular) */}
              <button
                onClick={handleExplainWithAI}
                disabled={isExplaining}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white text-xs font-bold shadow-md shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-60"
              >
                {isExplaining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Brain className="w-4 h-4" />
                )}
                <span>Explicar com IA</span>
                {!hasAccess && <Crown className="w-3.5 h-3.5 text-yellow-200 ml-0.5" />}
              </button>

              {/* Botão: Guardar */}
              <button
                onClick={handleSaveVerses}
                disabled={isSaving}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-200 active:scale-95 transition-colors"
                title="Guardar versículo"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin text-yellow-600" /> : <Bookmark className="w-4 h-4" />}
              </button>

              {/* Botão: Limpar Seleção */}
              <button
                onClick={() => setSelectedVerses(new Set())}
                className="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title="Limpar seleção"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading Modal for AI Explanation */}
      {isExplaining && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl border border-yellow-200 dark:border-slate-700 flex flex-col items-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 animate-bounce">
              <Brain className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
              Consultando o Teólogo...
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-5 leading-relaxed">
              Analisando contexto histórico, original hebraico/grego e aplicações para sua vida hoje.
            </p>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 text-xs font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Gerando reflexão devocional...</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. Paywall Modal (Free Users) */}
      {showPaywallModal && (
        <div className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-yellow-200 dark:border-slate-700 relative overflow-hidden">
            {/* Ambient gold glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
            
            <button
              onClick={() => setShowPaywallModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-white flex items-center justify-center shadow-lg shadow-amber-500/25 mb-4">
                <Crown className="w-7 h-7 fill-current" />
              </div>

              <span className="text-[11px] font-bold tracking-wider uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-3 py-1 rounded-full mb-2.5">
                Recurso Premium VIP
              </span>

              <h3 className="text-xl font-bold font-serif text-gray-900 dark:text-white mb-2 leading-tight">
                Descubra os tesouros escondidos na Palavra! ✨
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                Assine o Premium e tenha um <b>teólogo particular com Inteligência Artificial</b> para explicar qualquer versículo na hora.
              </p>

              <div className="w-full space-y-3 mb-6 text-left">
                <div className="flex items-start gap-3 bg-amber-50/60 dark:bg-slate-700/40 p-3 rounded-xl border border-amber-100 dark:border-slate-700/60">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-950/80 rounded-lg text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">Contexto Histórico & Teológico</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Entenda os costumes, a época e a intenção dos autores originais.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-amber-50/60 dark:bg-slate-700/40 p-3 rounded-xl border border-amber-100 dark:border-slate-700/60">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-950/80 rounded-lg text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                    <Lightbulb className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">Aplicação Prática no Dia a Dia</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Respostas práticas sobre como viver essa palavra nas suas decisões diárias.</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 bg-amber-50/60 dark:bg-slate-700/40 p-3 rounded-xl border border-amber-100 dark:border-slate-700/60">
                  <div className="p-1.5 bg-amber-100 dark:bg-amber-950/80 rounded-lg text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-gray-900 dark:text-white">Áudio Narração Ilimitada</h4>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">Ouça capítulos inteiros e devocionais narrados a qualquer hora.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowPaywallModal(false);
                  onShowPremium();
                }}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/25 active:scale-98 transition-all flex items-center justify-center gap-2 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                <span>Quero meu Teólogo Particular (Assinar)</span>
              </button>

              <button
                onClick={() => setShowPaywallModal(false)}
                className="mt-3 text-xs font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Talvez mais tarde
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. AI Theological Explanation Modal / Bottom Sheet */}
      {explanationResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[88vh] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-yellow-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-amber-50/70 to-yellow-50/50 dark:from-slate-800 dark:to-slate-800/80">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <Brain className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-white">
                      Teólogo Particular
                    </h3>
                    <span className="text-[10px] font-bold uppercase bg-amber-200 text-amber-900 dark:bg-amber-900/60 dark:text-amber-300 px-2 py-0.5 rounded-full">
                      Lupa de IA
                    </span>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-400 font-serif font-semibold">
                    {explanationResult.reference}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {/* Botão de Ouvir Explicação com Áudio / IA */}
                <button
                  onClick={handleToggleExplanationAudio}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95",
                    isPlayingExplanation
                      ? "bg-amber-600 text-white shadow-sm ring-2 ring-amber-300 dark:ring-amber-800 animate-pulse"
                      : "bg-amber-100 hover:bg-amber-200 text-amber-900 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-amber-300"
                  )}
                  title={isPlayingExplanation ? "Parar leitura da explicação" : "Ouvir explicação em áudio"}
                >
                  {isPlayingExplanation ? (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Parar</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Ouvir</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleShareExplanation}
                  className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  title="Compartilhar Explicação"
                >
                  <Share2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    stopExplanationAudio();
                    setExplanationResult(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm text-gray-700 dark:text-gray-200 leading-relaxed">
              {/* Scripture Quote */}
              <div className="bg-amber-50/60 dark:bg-slate-800/60 p-4 rounded-2xl border-l-4 border-amber-500">
                <p className="font-serif italic text-gray-800 dark:text-gray-200 text-sm sm:text-base leading-relaxed">
                  "{explanationResult.text}"
                </p>
                <span className="block mt-1.5 text-xs font-bold text-amber-700 dark:text-amber-400 font-sans">
                  — {explanationResult.reference}
                </span>
              </div>

              {/* 1. Contexto */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <BookOpen className="w-4 h-4" />
                  <span>Contexto Histórico & Teológico</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm pl-6 leading-relaxed">
                  {explanationResult.context}
                </p>
              </div>

              {/* 2. Significado */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <Lightbulb className="w-4 h-4" />
                  <span>Significado Profundo da Mensagem</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm pl-6 leading-relaxed">
                  {explanationResult.meaning}
                </p>
              </div>

              {/* 3. Aplicação Prática */}
              <div className="space-y-1.5 pt-2 border-t border-gray-100 dark:border-slate-800">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <HeartHandshake className="w-4 h-4" />
                  <span>Como Aplicar na Sua Vida Hoje</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-xs sm:text-sm pl-6 leading-relaxed">
                  {explanationResult.practicalApplication}
                </p>
              </div>

              {/* 4. Oração */}
              {explanationResult.shortPrayer && (
                <div className="bg-gradient-to-br from-amber-50 to-yellow-50/80 dark:from-slate-800 dark:to-slate-800/60 p-4 rounded-2xl border border-amber-200/70 dark:border-slate-700 mt-2">
                  <span className="text-xs font-bold text-amber-800 dark:text-amber-300 block mb-1">
                    🙏 Oração Inspirada:
                  </span>
                  <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 italic font-serif">
                    {explanationResult.shortPrayer}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 sm:px-6 py-3.5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/80 dark:bg-slate-800/80 flex items-center justify-between gap-3">
              <button
                onClick={handleCopyExplanation}
                className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:text-amber-600 dark:hover:text-amber-400 transition-colors py-2 px-3 rounded-xl hover:bg-gray-200/60 dark:hover:bg-slate-700"
              >
                {copiedExplanation ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span className="text-emerald-600 font-bold">Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Explicação</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  stopExplanationAudio();
                  setExplanationResult(null);
                }}
                className="px-4 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold rounded-xl transition-all active:scale-95"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


