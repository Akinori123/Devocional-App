import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, collection, serverTimestamp, getDocs, query, orderBy, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Loader2, Save, Video, Book, PlusCircle, Trash2, Edit2, X, Search, Download, Check, Sparkles, ChevronDown, ChevronRight, RefreshCw, Star, HelpCircle } from 'lucide-react';
import { useDevotionals } from '../../context/DevotionalContext';
import { useToast } from '../../context/ToastContext';
import { DevotionalItem, mockDevotionals } from '../../data/devotionals';
import { cn } from '../../lib/utils';

const normalizeThemeName = (theme: string) => {
  let normalized = theme.toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .trim();
    
  const stopWords = ["sobre ", "o ", "a ", "os ", "as ", "de ", "do ", "da ", "um ", "uma "];
  let changed = true;
  while(changed) {
    changed = false;
    for (const word of stopWords) {
      if (normalized.startsWith(word)) {
        normalized = normalized.substring(word.length).trim();
        changed = true;
      }
    }
  }
  return normalized;
};

export function AdminTab() {
  const toast = useToast();
  const { globalDevotionals, deleteGlobalDevotional, updateGlobalDevotional, hasMoreGlobal, loadMoreGlobalDevotionals } = useDevotionals();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Daily content
  const [videoId, setVideoId] = useState('');
  const [verseText, setVerseText] = useState('');
  const [verseRef, setVerseRef] = useState('');
  const [isVideoExclusive, setIsVideoExclusive] = useState(false);

  // Global devotional
  const [devTheme, setDevTheme] = useState('');
  const [devTitle, setDevTitle] = useState('');
  const [devDescription, setDevDescription] = useState('');
  const [devWord, setDevWord] = useState('');
  const [devContent, setDevContent] = useState('');
  const [savingDev, setSavingDev] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingModuleTheme, setDeletingModuleTheme] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteModuleTheme, setConfirmDeleteModuleTheme] = useState<string | null>(null);
  
  // Bulk generation
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTheme, setBulkTheme] = useState('');
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [bulkProgress, setBulkProgress] = useState('');
  const [expandedThemes, setExpandedThemes] = useState<Record<string, boolean>>({});

  const [activeTab, setActiveTab] = useState<'daily' | 'library' | 'videos'>('daily');
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualCreationType, setManualCreationType] = useState<'single' | 'existing_module' | 'new_module'>('single');
  const [allThemes, setAllThemes] = useState<string[]>([]);
  const [moduleFilterQuery, setModuleFilterQuery] = useState('');
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const moduleDropdownRef = useRef<HTMLDivElement>(null);
  
  // Video History states
  const [videoHistory, setVideoHistory] = useState<any[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editHistVideoId, setEditHistVideoId] = useState('');
  const [editHistVerseText, setEditHistVerseText] = useState('');
  const [editHistVerseRef, setEditHistVerseRef] = useState('');
  const [editHistIsExclusive, setEditHistIsExclusive] = useState(false);
  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [settingDailyVideoId, setSettingDailyVideoId] = useState<string | null>(null);
  const [videoSearchQuery, setVideoSearchQuery] = useState('');
  const [confirmClearDaily, setConfirmClearDaily] = useState(false);


  useEffect(() => {
    const fetchAllThemes = async () => {
      try {
        const q = query(collection(db, 'devotionals'));
        const snapshot = await getDocs(q);
        const themes = new Set<string>();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!data.deleted && data.theme && data.theme !== 'Dia Avulso') {
            themes.add(data.theme);
          }
        });
        mockDevotionals.forEach(m => {
          if (m.theme && m.theme !== 'Dia Avulso') {
            themes.add(m.theme);
          }
        });
        setAllThemes(Array.from(themes).sort());
      } catch (err) {
        console.error('Error fetching themes:', err);
      }
    };
    fetchAllThemes();
  }, [showManualModal, activeTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(event.target as Node)) {
        setIsModuleDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const platformDevotionals = [
    ...globalDevotionals.filter((g: any) => !g.deleted),
    ...mockDevotionals.filter(m => !globalDevotionals.some(g => g.id === m.id))
  ];

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const docRef = doc(db, 'settings', 'daily_content');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setVideoId(data.videoId || '');
          setVerseText(data.verseText || '');
          setVerseRef(data.verseRef || '');
          setIsVideoExclusive(data.isPremium ?? data.isExclusive ?? false);
        }
      } catch (error) {
        console.error("Error fetching admin config", error);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleSaveDaily = async () => {
    setSaving(true);
    try {
      let parsedVideoId = videoId.trim();
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = parsedVideoId.match(regExp);
      if (match && match[2].length === 11) {
        parsedVideoId = match[2];
      }

      const timestamp = new Date().toISOString();

      await setDoc(doc(db, 'settings', 'daily_content'), {
        videoId: parsedVideoId,
        verseText,
        verseRef,
        isExclusive: isVideoExclusive,
        isPremium: isVideoExclusive,
        updatedAt: timestamp
      }, { merge: true });

      if (parsedVideoId || verseText || verseRef) {
        const newVideoRef = doc(collection(db, 'videos'));
        await setDoc(newVideoRef, {
          id: newVideoRef.id,
          videoId: parsedVideoId,
          verseText,
          verseRef,
          isExclusive: isVideoExclusive,
          isPremium: isVideoExclusive,
          createdAt: timestamp
        });
      }

      toast.success("Conteúdo diário atualizado com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClearDaily = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'daily_content'), {
        videoId: '',
        verseText: '',
        verseRef: '',
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setVideoId('');
      setVerseText('');
      setVerseRef('');
      setConfirmClearDaily(false);
      
      toast.success("Conteúdo limpo! O app agora mostrará a Palavra automática e nenhum vídeo.");
    } catch (error: any) {
      toast.error("Erro ao limpar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmSetAsDaily = async (video: any) => {
    setSaving(true);
    try {
      const isExclusive = video.isPremium ?? video.isExclusive ?? false;
      
      await setDoc(doc(db, 'settings', 'daily_content'), {
        videoId: video.videoId || '',
        verseText: video.verseText || '',
        verseRef: video.verseRef || '',
        isExclusive: isExclusive,
        isPremium: isExclusive,
        updatedAt: new Date().toISOString()
      });

      // Update local state so it reflects immediately in the daily tab too
      setVideoId(video.videoId || '');
      setVerseText(video.verseText || '');
      setVerseRef(video.verseRef || '');
      setIsVideoExclusive(isExclusive);

      toast.success("Vídeo do Dia atualizado com sucesso!");
      setSettingDailyVideoId(null);
    } catch (error) {
      console.error("Error setting video as daily:", error);
      toast.error("Erro ao definir como vídeo do dia.");
    } finally {
      setSaving(false);
    }
  };

  const loadVideos = async () => {
    setLoadingVideos(true);
    try {
      const q = query(collection(db, 'videos'), orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      setVideoHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Erro ao carregar vídeos", error);
      toast.error("Erro ao carregar histórico de vídeos.");
    } finally {
      setLoadingVideos(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'videos') {
      loadVideos();
    }
  }, [activeTab]);

  const handleEditVideo = (video: any) => {
    setEditingVideoId(video.id);
    setEditHistVideoId(video.videoId || '');
    setEditHistVerseText(video.verseText || '');
    setEditHistVerseRef(video.verseRef || '');
    setEditHistIsExclusive(video.isPremium ?? video.isExclusive ?? false);
  };

  const handleCancelEditVideo = () => {
    setEditingVideoId(null);
  };

  const handleUpdateVideo = async (id: string) => {
    try {
      let parsedVideoId = editHistVideoId.trim();
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
      const match = parsedVideoId.match(regExp);
      if (match && match[2].length === 11) {
        parsedVideoId = match[2];
      }

      await updateDoc(doc(db, 'videos', id), {
        videoId: parsedVideoId,
        verseText: editHistVerseText,
        verseRef: editHistVerseRef,
        isExclusive: editHistIsExclusive,
        isPremium: editHistIsExclusive
      });
      toast.success("Vídeo atualizado com sucesso!");
      setEditingVideoId(null);
      loadVideos();
    } catch (error: any) {
      toast.error("Erro ao atualizar vídeo: " + error.message);
    }
  };

  const handleDeleteVideo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'videos', id));
      toast.success("Vídeo excluído com sucesso!");
      setDeletingVideoId(null);
      loadVideos();
    } catch (error: any) {
      toast.error("Erro ao excluir vídeo: " + error.message);
    }
  };

  const handleSaveDevotional = async () => {
    if (!devTitle || !devContent) {
      toast.error("Título e Reflexão são obrigatórios.");
      return;
    }

    let finalTheme = devTheme.trim();
    if (!editingId) {
      if (manualCreationType === 'single') {
        finalTheme = 'Dia Avulso';
      } else if (manualCreationType === 'existing_module') {
        if (!finalTheme) {
          toast.error("Por favor, selecione um módulo existente.");
          return;
        }
      } else if (manualCreationType === 'new_module') {
        if (!finalTheme) {
          toast.error("Por favor, digite o nome do novo módulo.");
          return;
        }
      }
    } else {
        if (!finalTheme) {
            finalTheme = 'Dia Avulso';
        }
    }

    // Checar duplicata no banco de dados completo (para não falhar com a paginação)
    let isDuplicate = false;
    const qDup = query(collection(db, 'devotionals'));
    const snapshotDup = await getDocs(qDup);
    
    snapshotDup.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.deleted && data.id !== editingId) {
        if ((data.theme || '').toLowerCase() === finalTheme.toLowerCase() && 
            (data.title || '').toLowerCase() === devTitle.toLowerCase()) {
          isDuplicate = true;
        }
      }
    });

    if (!isDuplicate) {
      isDuplicate = mockDevotionals.some(
        m => m.theme.toLowerCase() === finalTheme.toLowerCase() && 
             m.title.toLowerCase() === devTitle.toLowerCase() && 
             m.id !== editingId
      );
    }

    if (isDuplicate) {
      toast.error("Já existe um devocional com este exato Título e Tema.");
      return;
    }

    setSavingDev(true);
    try {
      if (editingId) {
        await updateGlobalDevotional(editingId, {
          theme: finalTheme,
          title: devTitle,
          description: devDescription || devTitle,
          beautifulWord: devWord,
          content: devContent,
        });
      } else {
        const devRef = doc(collection(db, 'devotionals'));
        await setDoc(devRef, {
          id: devRef.id,
          theme: finalTheme,
          title: devTitle,
          description: devDescription || devTitle,
          beautifulWord: devWord,
          content: devContent,
          createdAt: serverTimestamp()
        });
      }
      // Reload themes to ensure the new one is available in dropdown
      setAllThemes(prev => {
        if (finalTheme !== 'Dia Avulso' && !prev.includes(finalTheme)) {
          return [...prev, finalTheme].sort();
        }
        return prev;
      });
      resetForm();
    } catch (error: any) {
      console.error("Erro ao salvar devocional: " + error.message);
      toast.error("Ocorreu um erro ao salvar.");
    } finally {
      setSavingDev(false);
    }
  };

  const handleEdit = (dev: DevotionalItem) => {
    setEditingId(dev.id);
    setDevTheme(dev.theme);
    setDevTitle(dev.title);
    setDevDescription(dev.description);
    setDevWord(dev.beautifulWord);
    setDevContent(dev.content);
    setShowManualModal(true);
  };

  const toggleTheme = (theme: string) => {
    setExpandedThemes(prev => ({
      ...prev,
      [theme]: !prev[theme]
    }));
  };

  const handleDelete = async (dev: DevotionalItem) => {
    setDeletingId(dev.id);
    try {
      await deleteGlobalDevotional(dev.id);
      if (editingId === dev.id) resetForm();
      setConfirmDeleteId(null);
    } catch (error) {
      console.error("Erro ao deletar", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteModule = async (theme: string, moduleDevs: DevotionalItem[], e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingModuleTheme(theme);
    try {
      for (const d of moduleDevs) {
        await deleteGlobalDevotional(d.id);
      }
      if (moduleDevs.some(d => d.id === editingId)) resetForm();
      setConfirmDeleteModuleTheme(null);
    } catch (error) {
      console.error("Erro ao deletar módulo", error);
    } finally {
      setDeletingModuleTheme(null);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setDevTheme('');
    setModuleFilterQuery('');
    setIsModuleDropdownOpen(false);
    setDevTitle('');
    setDevDescription('');
    setDevWord('');
    setDevContent('');
    setShowManualModal(false);
  };

  const handleBulkGenerate = async () => {
    if (!bulkTheme.trim()) {
      toast.error("Por favor, digite o nome do tema.");
      return;
    }
    
    setGeneratingBulk(true);
    setBulkProgress("Verificando se o módulo já existe...");
    try {
      // 1. Checa se já existe um módulo com esse tema usando Normalização Semântica (pesquisa no banco de dados completo)
      let existingDaysCount = 0;
      
      const normalizedInput = normalizeThemeName(bulkTheme);
      let originalThemeName = bulkTheme.trim();
      
      const q = query(collection(db, 'devotionals'));
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.deleted && data.theme) {
          if (normalizeThemeName(data.theme) === normalizedInput) {
            existingDaysCount++;
            originalThemeName = data.theme; // Usa o nome exato já salvo no banco
          }
        }
      });
      
      mockDevotionals.forEach(m => {
        if (m.theme && normalizeThemeName(m.theme) === normalizedInput) {
           existingDaysCount++;
           originalThemeName = m.theme;
        }
      });

      const nextPart = Math.floor(existingDaysCount / 7) + 1;
      const finalThemeName = originalThemeName;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      let generatedDays: any[] = [];
      let bulkServerError = '';

      // Tenta a chamada única em lote primeiro (1 única requisição à IA que consome apenas 1 cota de RPM)
      try {
        setBulkProgress("Gerando os 7 dias com IA (isso pode levar 20 a 30 segundos)...");
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 50000);

        const response = await fetch('/api/gemini/generate-bulk-devotionals', {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            theme: finalThemeName,
            partNumber: nextPart
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data) && data.length === 7) {
            generatedDays = data;
          }
        } else {
          const errorData = await response.json().catch(() => null);
          bulkServerError = errorData?.error || `Erro (${response.status})`;
          console.warn("generateBulk falhou no servidor:", bulkServerError);
        }
      } catch (err: any) {
        console.warn("generateBulk timeout ou rede:", err);
      }

      // Se a geração em lote de 1 clique falhou, gera os 7 dias sequencialmente respeitando o limite da cota gratuita
      if (generatedDays.length !== 7) {
        setBulkProgress("Geração sequencial dos 7 dias em andamento...");
        generatedDays = [];

        for (let i = 1; i <= 7; i++) {
          setBulkProgress(`Gerando Dia ${i} de 7 com IA...`);
          const res = await fetch('/api/gemini/generate-devotional', {
            method: 'POST',
            headers,
            body: JSON.stringify({ 
              theme: `${finalThemeName} - Dia ${i} de 7`,
              currentNeed: `Módulo de 7 dias sobre ${finalThemeName}. Volume ${nextPart}. Foque no aspecto do dia ${i}.`
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            throw new Error(errorData?.error || bulkServerError || `Erro ao gerar Dia ${i}`);
          }

          const dayData = await res.json();
          generatedDays.push(dayData);

          // Pausa leve para evitar 429 Rate Limit (Free Tier) entre requisições
          if (i < 7) {
            await new Promise(r => setTimeout(r, 1200));
          }
        }
      }
      
      // Salva os 7 dias no Firestore em lote atômico (writeBatch)
      setBulkProgress("Salvando os 7 dias no banco de dados...");
      const dayOffset = existingDaysCount;
      const batch = writeBatch(db);

      for (let i = 0; i < generatedDays.length; i++) {
        const dayNumber = dayOffset + i + 1;
        const day = generatedDays[i];
        const devRef = doc(collection(db, 'devotionals'));
        
        let title = day.title || `Dia ${dayNumber}: ${finalThemeName}`;
        if (!title.toLowerCase().includes('dia ')) {
          title = `Dia ${dayNumber} - ${title}`;
        }
        
        batch.set(devRef, {
          id: devRef.id,
          theme: finalThemeName,
          title: title,
          description: day.description || `Dia ${dayNumber} do módulo ${finalThemeName}`,
          beautifulWord: day.beautifulWord || '',
          content: day.content || '',
          createdAt: serverTimestamp()
        });
      }

      await batch.commit();
      
      toast.success(`Módulo "${finalThemeName}" com 7 dias gerado e salvo com sucesso!`);
      setShowBulkModal(false);
      setBulkTheme('');
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao gerar módulo em lote. Verifique sua conexão e tente novamente.");
    } finally {
      setGeneratingBulk(false);
      setBulkProgress('');
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
      </div>
    );
  }

  const groupedDevotionals = platformDevotionals
    .filter(d => 
      d.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      d.theme.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .reduce((acc, dev) => {
      const theme = dev.theme || 'Outros';
      if (!acc[theme]) acc[theme] = [];
      acc[theme].push(dev);
      return acc;
    }, {} as Record<string, import('../../data/devotionals').DevotionalItem[]>);

  const totalModules = Object.keys(groupedDevotionals).length;
  const totalDevotionals = platformDevotionals.length;

  const filteredVideos = videoHistory.filter(video => 
    (video.verseText || '').toLowerCase().includes(videoSearchQuery.toLowerCase()) || 
    (video.verseRef || '').toLowerCase().includes(videoSearchQuery.toLowerCase()) ||
    (video.videoId || '').toLowerCase().includes(videoSearchQuery.toLowerCase())
  );

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex bg-gray-100/80 dark:bg-slate-800/80 p-1.5 rounded-2xl mb-8 border border-gray-200/50 dark:border-slate-700/50 backdrop-blur-sm">
        <button
          onClick={() => setActiveTab('daily')}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'daily' 
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          📺 Destaque de Hoje
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'library' 
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          📚 Acervo & Jornada
        </button>
        <button
          onClick={() => setActiveTab('videos')}
          className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'videos' 
              ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-md ring-1 ring-black/5 dark:ring-white/10' 
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          📹 Vídeos Antigos
        </button>
      </div>

      {activeTab === 'daily' && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white dark:bg-slate-800/80 rounded-3xl shadow-sm p-8 mb-8 border border-gray-100 dark:border-slate-700/50 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Gerenciar Conteúdo Diário</h3>
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Video className="w-4 h-4 text-purple-500" />
                  Link do Vídeo no YouTube
                </label>
                <input 
                  type="text" 
                  value={videoId}
                  onChange={(e) => setVideoId(e.target.value)}
                  placeholder="Ex: https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                  className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"
                />
                <label className="flex items-center gap-2 cursor-pointer mb-2 mt-3 w-max">
                  <input 
                    type="checkbox"
                    checked={isVideoExclusive}
                    onChange={(e) => setIsVideoExclusive(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Vídeo Exclusivo para Premium</span>
                </label>
                <p className="text-xs text-gray-500 mt-1">Cole o link completo do YouTube. Deixe em branco para não exibir nenhum vídeo hoje.</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Book className="w-4 h-4 text-purple-500" />
                  Versículo do Dia (Texto)
                </label>
                <textarea 
                  value={verseText}
                  onChange={(e) => setVerseText(e.target.value)}
                  placeholder="O Senhor é meu pastor e nada me faltará."
                  rows={3}
                  className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 resize-none shadow-sm"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  <Book className="w-4 h-4 text-purple-500" />
                  Referência do Versículo
                </label>
                <input 
                  type="text" 
                  value={verseRef}
                  onChange={(e) => setVerseRef(e.target.value)}
                  placeholder="Salmos 23:1"
                  className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"
                />
              </div>

              <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-slate-800">
                <button 
                  onClick={handleSaveDaily}
                  disabled={saving}
                  className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold py-3.5 px-4 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Salvar Conteúdo de Hoje
                </button>
                
                {confirmClearDaily ? (
                  <div className="flex gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
                    <button 
                      onClick={handleClearDaily}
                      disabled={saving}
                      className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-3.5 px-4 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Confirmar Limpeza"}
                    </button>
                    <button 
                      onClick={() => setConfirmClearDaily(false)}
                      disabled={saving}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 font-medium py-3.5 px-4 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => setConfirmClearDaily(true)}
                    disabled={saving}
                    className="w-full bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-medium py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 border border-gray-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
                  >
                    Limpar e Usar Palavra Automática
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'library' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Book className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Módulos</p>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">{totalModules}</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-slate-800 flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Devocionais</p>
              </div>
              <p className="text-3xl font-black text-gray-900 dark:text-white">{totalDevotionals}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Acervo & Jornada</h3>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowManualModal(true)}
                  className="bg-gray-100 hover:bg-gray-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-gray-700 dark:text-gray-300 font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-colors text-sm border border-transparent dark:border-slate-700"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span className="hidden sm:inline">Adicionar Manual</span>
                  <span className="sm:hidden">Manual</span>
                </button>
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl flex items-center gap-2 transition-all shadow-md text-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span className="hidden sm:inline">Gerar Módulo com IA</span>
                  <span className="sm:hidden">Gerar com IA</span>
                </button>
              </div>
            </div>

            <div className="relative mb-6">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar tema ou título no acervo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3.5 pl-11 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"
              />
            </div>

            {Object.keys(groupedDevotionals).length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-gray-200 dark:border-slate-700">
                <Book className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Nenhum devocional encontrado.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedDevotionals)
                  .sort(([themeA], [themeB]) => themeA.localeCompare(themeB))
                  .map(([theme, devs]) => {
                    const isExpanded = expandedThemes[theme];
                    const sortedDevs = devs.sort((a, b) => {
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

                      const isDiaAvulso = theme.toLowerCase() === 'dia avulso' || theme.toLowerCase().includes('avulso');
                      const displayHeaderTheme = isDiaAvulso && devs.length === 1 ? (devs[0].title || theme) : theme;

                      return (
                        <div key={theme} className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                          <div 
                            onClick={() => toggleTheme(theme)}
                            className="flex items-center justify-between p-5 cursor-pointer bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <h4 className="font-bold text-gray-900 dark:text-white text-base">{displayHeaderTheme}</h4>
                              <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
                                {isDiaAvulso && devs.length === 1 ? 'Dia Avulso' : `${devs.length} ${devs.length === 1 ? 'dia' : 'dias'}`}
                              </span>
                            </div>
                          <div className="flex items-center gap-2">
                            {confirmDeleteModuleTheme === theme ? (
                              <div className="flex items-center bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm p-1 gap-1 border border-red-100 dark:border-red-800" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={(e) => handleDeleteModule(theme, devs, e)}
                                  disabled={deletingModuleTheme === theme}
                                  className="p-1.5 text-red-600 hover:bg-red-200 dark:hover:bg-red-800 rounded-md transition-colors disabled:opacity-50"
                                  title="Confirmar exclusão"
                                >
                                  {deletingModuleTheme === theme ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteModuleTheme(null); }}
                                  disabled={deletingModuleTheme === theme}
                                  className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50"
                                  title="Cancelar"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={(e) => { e.stopPropagation(); setConfirmDeleteModuleTheme(theme); }}
                                className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                title="Excluir Módulo Inteiro"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                            <div className="p-1 text-gray-400 ml-2">
                              {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-5 border-t border-gray-100 dark:border-slate-700 space-y-4 bg-gray-50/50 dark:bg-slate-800/30">
                            {sortedDevs.map(dev => (
                              <div key={dev.id} className="bg-white dark:bg-slate-800/80 border border-gray-200 dark:border-slate-700 rounded-xl p-5 flex flex-col gap-3 shadow-sm hover:border-purple-200 transition-colors">
                                <div className="flex justify-between items-start gap-3">
                                  <div className="flex-1">
                                    <h5 className="font-bold text-gray-900 dark:text-white leading-snug">{dev.title}</h5>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0 relative">
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEdit(dev); }}
                                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    {confirmDeleteId === dev.id ? (
                                      <div className="flex items-center bg-red-50 dark:bg-red-900/20 rounded-lg shadow-sm p-1 gap-1 border border-red-100 dark:border-red-800" onClick={(e) => e.stopPropagation()}>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleDelete(dev); }}
                                          disabled={deletingId === dev.id}
                                          className="p-1.5 text-red-600 hover:bg-red-200 dark:hover:bg-red-800 rounded-md transition-colors disabled:opacity-50"
                                          title="Confirmar exclusão"
                                        >
                                          {deletingId === dev.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                        </button>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                                          disabled={deletingId === dev.id}
                                          className="p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-md transition-colors disabled:opacity-50"
                                          title="Cancelar"
                                        >
                                          <X className="w-4 h-4" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(dev.id); }}
                                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Excluir Apenas Este Dia"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">{dev.description}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                })}
              </div>
            )}
            {hasMoreGlobal && (
              <div className="mt-8 flex justify-center">
                <button 
                  onClick={loadMoreGlobalDevotionals}
                  className="text-sm font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-6 py-3 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors border border-purple-100 dark:border-purple-800/50 shadow-sm"
                >
                  Carregar mais devocionais do servidor
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Creation/Edition Modal */}
      {showManualModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex justify-center p-4 sm:p-6 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-xl shadow-2xl animate-in zoom-in-95 duration-200 my-auto flex flex-col max-h-full">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50 sticky top-0 z-10 shrink-0">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                  {editingId ? "Editar Devocional" : "Adicionar Devocional Manual"}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Preencha os dados para adicionar à Jornada
                </p>
              </div>
              <button 
                onClick={resetForm}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              {!editingId && (
                <div className="mb-2">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">O que você deseja criar?</label>
                  <div className="flex flex-col gap-3">
                    {/* Option 1: Dia Avulso */}
                    <div className="relative">
                      <label className="flex items-start justify-between gap-3 cursor-pointer p-3.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-start gap-3">
                          <input 
                            type="radio" 
                            name="creationType" 
                            checked={manualCreationType === 'single'} 
                            onChange={() => { setManualCreationType('single'); setDevTheme('Dia Avulso'); }} 
                            className="text-purple-600 focus:ring-purple-500 w-4 h-4 mt-0.5" 
                          />
                          <div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white block">Dia Avulso / Único</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">Mensagem independente sem sequência ou trilha de dias</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveTooltip(activeTooltip === 'single' ? null : 'single');
                          }}
                          onMouseEnter={() => setActiveTooltip('single')}
                          onMouseLeave={() => setActiveTooltip(null)}
                          className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 shrink-0"
                          title="Como funciona esta opção?"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </label>
                      {activeTooltip === 'single' && (
                        <div className="absolute right-2 top-full mt-1 z-30 w-72 p-3 bg-gray-900 dark:bg-slate-800 text-white text-xs rounded-xl shadow-xl border border-gray-700 dark:border-slate-600 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                          <p className="font-semibold text-purple-300 mb-1">📌 O que é Dia Avulso?</p>
                          <p className="leading-relaxed text-gray-300">
                            Cria uma mensagem independente (ex: palavra do dia, reflexão especial) que não faz parte de nenhuma sequência de dias (sem Dia 1, Dia 2, etc.).
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Option 2: Adicionar a Módulo Existente */}
                    <div className="relative">
                      <label className="flex items-start justify-between gap-3 cursor-pointer p-3.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-start gap-3">
                          <input 
                            type="radio" 
                            name="creationType" 
                            checked={manualCreationType === 'existing_module'} 
                            onChange={() => { setManualCreationType('existing_module'); setDevTheme(''); }} 
                            className="text-purple-600 focus:ring-purple-500 w-4 h-4 mt-0.5" 
                          />
                          <div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white block">Adicionar dia a um Módulo Existente</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">Adiciona mais um dia (ex: Dia 8) a uma jornada já cadastrada</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveTooltip(activeTooltip === 'existing' ? null : 'existing');
                          }}
                          onMouseEnter={() => setActiveTooltip('existing')}
                          onMouseLeave={() => setActiveTooltip(null)}
                          className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 shrink-0"
                          title="Como funciona esta opção?"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </label>
                      {activeTooltip === 'existing' && (
                        <div className="absolute right-2 top-full mt-1 z-30 w-72 p-3 bg-gray-900 dark:bg-slate-800 text-white text-xs rounded-xl shadow-xl border border-gray-700 dark:border-slate-600 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                          <p className="font-semibold text-purple-300 mb-1">📌 Como funciona?</p>
                          <p className="leading-relaxed text-gray-300">
                            Seleciona um módulo que já existe e acrescenta mais um dia nele. O sistema atualiza a contagem dos dias automaticamente (ex: de 7 dias para 8 dias).
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Option 3: Criar Novo Módulo Manualmente */}
                    <div className="relative">
                      <label className="flex items-start justify-between gap-3 cursor-pointer p-3.5 rounded-xl border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors">
                        <div className="flex items-start gap-3">
                          <input 
                            type="radio" 
                            name="creationType" 
                            checked={manualCreationType === 'new_module'} 
                            onChange={() => { setManualCreationType('new_module'); setDevTheme(''); }} 
                            className="text-purple-600 focus:ring-purple-500 w-4 h-4 mt-0.5" 
                          />
                          <div>
                            <span className="text-sm font-semibold text-gray-900 dark:text-white block">Criar um Novo Módulo Manualmente</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400 block mt-0.5">Inicia uma nova jornada temática começando do Dia 1 (1/1)</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setActiveTooltip(activeTooltip === 'new' ? null : 'new');
                          }}
                          onMouseEnter={() => setActiveTooltip('new')}
                          onMouseLeave={() => setActiveTooltip(null)}
                          className="p-1 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 shrink-0"
                          title="Como funciona esta opção?"
                        >
                          <HelpCircle className="w-4 h-4" />
                        </button>
                      </label>
                      {activeTooltip === 'new' && (
                        <div className="absolute right-2 top-full mt-1 z-30 w-72 p-3 bg-gray-900 dark:bg-slate-800 text-white text-xs rounded-xl shadow-xl border border-gray-700 dark:border-slate-600 animate-in fade-in zoom-in-95 duration-150 pointer-events-none">
                          <p className="font-semibold text-purple-300 mb-1">📌 Como funciona?</p>
                          <p className="leading-relaxed text-gray-300">
                            Cria um card/trilha nova com o nome que você der. Este devocional será o Dia 1 (1/1) e depois você poderá adicionar mais dias nele.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {manualCreationType === 'existing_module' && !editingId && (
                <div className="space-y-2" ref={moduleDropdownRef}>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Selecione ou Pesquise o Módulo
                  </label>
                  
                  {/* Single Searchable Combobox */}
                  <div className="relative">
                    <div className="relative flex items-center">
                      <Search className="w-4 h-4 absolute left-3.5 text-gray-400 pointer-events-none" />
                      <input
                        type="text"
                        value={isModuleDropdownOpen ? moduleFilterQuery : (devTheme || moduleFilterQuery)}
                        onFocus={() => {
                          setIsModuleDropdownOpen(true);
                          setModuleFilterQuery(devTheme);
                        }}
                        onClick={() => {
                          setIsModuleDropdownOpen(true);
                        }}
                        onChange={(e) => {
                          setModuleFilterQuery(e.target.value);
                          if (!isModuleDropdownOpen) setIsModuleDropdownOpen(true);
                          if (devTheme && e.target.value !== devTheme) {
                            setDevTheme('');
                          }
                        }}
                        placeholder="Clique para ver a lista ou digite para filtrar..."
                        className="w-full pl-10 pr-16 py-3 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-xs cursor-pointer"
                      />
                      
                      <div className="absolute right-3 flex items-center gap-1.5">
                        {(devTheme || moduleFilterQuery) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDevTheme('');
                              setModuleFilterQuery('');
                              setIsModuleDropdownOpen(true);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            title="Limpar seleção"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsModuleDropdownOpen(prev => !prev)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        >
                          <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isModuleDropdownOpen && "rotate-180")} />
                        </button>
                      </div>
                    </div>

                    {/* Floating Dropdown List */}
                    {isModuleDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto py-1 divide-y divide-gray-50 dark:divide-slate-800 animate-in fade-in zoom-in-95 duration-150">
                        {allThemes.filter((t: string) => t.toLowerCase().includes((moduleFilterQuery || '').toLowerCase())).length === 0 ? (
                          <div className="px-4 py-4 text-xs text-gray-500 dark:text-gray-400 text-center">
                            Nenhum módulo encontrado com "{moduleFilterQuery}"
                          </div>
                        ) : (
                          allThemes
                            .filter((t: string) => t.toLowerCase().includes((moduleFilterQuery || '').toLowerCase()))
                            .map((t: string) => {
                              const isSelected = devTheme === t;
                              return (
                                <button
                                  key={t}
                                  type="button"
                                  onClick={() => {
                                    setDevTheme(t);
                                    setModuleFilterQuery(t);
                                    setIsModuleDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors",
                                    isSelected 
                                      ? "bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 font-semibold"
                                      : "text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-800"
                                  )}
                                >
                                  <span className="truncate">{t}</span>
                                  {isSelected && <Check className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0 ml-2" />}
                                </button>
                              );
                            })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(manualCreationType === 'new_module' || editingId) && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tema / Nome do Módulo</label>
                  <input 
                    type="text" 
                    value={devTheme}
                    onChange={(e) => setDevTheme(e.target.value)}
                    placeholder="Ex: Gratidão"
                    className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Título do Dia *</label>
                <input 
                  type="text" 
                  value={devTitle}
                  onChange={(e) => setDevTitle(e.target.value)}
                  placeholder="Ex: A verdadeira paz"
                  className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Descrição Curta</label>
                <input 
                  type="text" 
                  value={devDescription}
                  onChange={(e) => setDevDescription(e.target.value)}
                  placeholder="Ex: Uma breve reflexão sobre a paz"
                  className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Versículo Âncora / Palavra</label>
                <input 
                  type="text" 
                  value={devWord}
                  onChange={(e) => setDevWord(e.target.value)}
                  placeholder="Ex: 'Deixo-vos a paz...'"
                  className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Reflexão (Conteúdo Completo) *</label>
                <textarea 
                  value={devContent}
                  onChange={(e) => setDevContent(e.target.value)}
                  placeholder="Digite o texto do devocional aqui..."
                  rows={5}
                  className="w-full px-4 py-3.5 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 resize-none shadow-sm"
                />
              </div>
            </div>
            
            <div className="p-5 border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-800/50 sticky bottom-0 shrink-0 flex gap-3">
              <button 
                onClick={resetForm}
                className="flex-1 px-4 py-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-gray-700 dark:text-gray-300 font-semibold hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveDevotional}
                disabled={savingDev || !devTitle || !devContent}
                className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {savingDev ? <Loader2 className="w-5 h-5 animate-spin" /> : (editingId ? <Save className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />)}
                {editingId ? "Salvar Alterações" : "Criar Devocional"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Videos History Tab */}
      {activeTab === 'videos' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Vídeos Históricos</h3>
              <button 
                onClick={loadVideos}
                className="p-2 text-gray-500 hover:text-purple-600 bg-gray-100 hover:bg-purple-50 dark:bg-slate-800 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                title="Recarregar vídeos"
              >
                <RefreshCw className={`w-5 h-5 ${loadingVideos ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="relative mb-6">
              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por ID, versículo ou referência..."
                value={videoSearchQuery}
                onChange={(e) => setVideoSearchQuery(e.target.value)}
                className="w-full px-4 py-3.5 pl-11 bg-white dark:bg-slate-900/80 border border-gray-200 dark:border-slate-700/80 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-gray-900 dark:text-white placeholder:text-gray-400 shadow-sm"
              />
            </div>

            {loadingVideos && videoHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Carregando histórico...</p>
              </div>
            ) : videoHistory.length === 0 ? (
              <div className="text-center py-12">
                <Video className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">Nenhum vídeo salvo no histórico ainda.</p>
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/30 rounded-xl border border-gray-200 dark:border-slate-700 border-dashed">
                <p className="text-gray-500 dark:text-gray-400">Nenhum vídeo encontrado para "{videoSearchQuery}"</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredVideos.map(video => (
                  <div key={video.id} className="border border-gray-200 dark:border-slate-700 rounded-xl p-4 bg-gray-50 dark:bg-slate-800/50">
                    {editingVideoId === video.id ? (
                      <div className="space-y-4">
                        <input
                          type="text"
                          value={editHistVideoId}
                          onChange={(e) => setEditHistVideoId(e.target.value)}
                          placeholder="ID do Vídeo no YouTube (ex: dQw4w9WgXcQ)"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                        <textarea
                          value={editHistVerseText}
                          onChange={(e) => setEditHistVerseText(e.target.value)}
                          placeholder="Versículo"
                          rows={2}
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                        <input
                          type="text"
                          value={editHistVerseRef}
                          onChange={(e) => setEditHistVerseRef(e.target.value)}
                          placeholder="Referência (ex: João 3:16)"
                          className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                        />
                        <label className="flex items-center gap-2 cursor-pointer mt-2 w-max">
                          <input 
                            type="checkbox"
                            checked={editHistIsExclusive}
                            onChange={(e) => setEditHistIsExclusive(e.target.checked)}
                            className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">Exclusivo Premium</span>
                        </label>
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => handleUpdateVideo(video.id)}
                            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                          >
                            <Save className="w-4 h-4" /> Salvar
                          </button>
                          <button
                            onClick={handleCancelEditVideo}
                            className="flex-1 bg-gray-200 hover:bg-gray-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-gray-800 dark:text-white py-2 rounded-lg text-sm font-bold flex items-center justify-center gap-1"
                          >
                            <X className="w-4 h-4" /> Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-start mb-2 flex-wrap gap-2">
                          <div className="flex items-center flex-wrap gap-2">
                            {videoId && video.videoId === videoId && (
                              <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1 border border-emerald-200 dark:border-emerald-800/50">
                                <Star className="w-3 h-3 fill-current" /> Destaque de Hoje
                              </span>
                            )}
                            <span className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold px-2 py-1 rounded">
                              YT: {video.videoId || 'Sem Vídeo'}
                            </span>
                            {(video.isPremium || video.isExclusive) && (
                              <span className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-bold px-2 py-1 rounded flex items-center gap-1">
                                Premium
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {videoId && video.videoId === videoId ? (
                              <button
                                onClick={handleClearDaily}
                                disabled={saving}
                                className="p-2 text-emerald-600 hover:text-white bg-emerald-50 hover:bg-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white rounded-lg transition-colors border border-emerald-200 dark:border-emerald-800/50"
                                title="Remover Destaque da Home"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            ) : (
                              <button
                                onClick={() => setSettingDailyVideoId(video.id)}
                                disabled={saving}
                                className="p-2 text-gray-500 hover:text-emerald-600 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg transition-colors border border-gray-200 dark:border-slate-700"
                                title="Definir como Destaque de Hoje"
                              >
                                <Star className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleEditVideo(video)}
                              className="p-2 text-gray-500 hover:text-purple-600 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors border border-gray-200 dark:border-slate-700"
                              title="Editar"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingVideoId(video.id)}
                              className="p-2 text-gray-500 hover:text-red-600 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors border border-gray-200 dark:border-slate-700"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {video.verseText && (
                          <div className="mt-3">
                            <p className="text-sm text-gray-700 dark:text-gray-300 italic">"{video.verseText}"</p>
                            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mt-1">- {video.verseRef}</p>
                          </div>
                        )}
                        <div className="mt-3 text-xs text-gray-400 dark:text-gray-500">
                          Data: {video.createdAt ? new Date(video.createdAt).toLocaleString('pt-BR') : 'Desconhecida'}
                        </div>

                        {settingDailyVideoId === video.id && (
                          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex flex-col gap-2">
                            <span className="text-sm text-emerald-800 dark:text-emerald-200 font-medium text-center">Deseja definir como Destaque do Dia? A Home será atualizada!</span>
                            <div className="flex gap-2 w-full">
                              <button
                                onClick={() => setSettingDailyVideoId(null)}
                                className="flex-1 py-2 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded-lg text-xs font-bold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleConfirmSetAsDaily(video)}
                                disabled={saving}
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 flex justify-center items-center gap-1 disabled:opacity-50"
                              >
                                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Star className="w-3 h-3" />} Confirmar
                              </button>
                            </div>
                          </div>
                        )}

                        {deletingVideoId === video.id && (
                          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center justify-between">
                            <span className="text-sm text-red-800 dark:text-red-200 font-medium">Excluir este vídeo?</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setDeletingVideoId(null)}
                                className="px-3 py-1 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 rounded text-xs font-bold border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700"
                              >
                                Não
                              </button>
                              <button
                                onClick={() => handleDeleteVideo(video.id)}
                                className="px-3 py-1 bg-red-600 text-white rounded text-xs font-bold hover:bg-red-700"
                              >
                                Sim
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Bulk Modal */}
      {showBulkModal && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex justify-between items-center bg-gray-50/50 dark:bg-slate-800/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white">Fábrica de IA (7 Dias)</h3>
              </div>
              <button 
                onClick={() => !generatingBulk && setShowBulkModal(false)}
                disabled={generatingBulk}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-5">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                Digite um tema e a Inteligência Artificial estruturará e escreverá uma jornada completa de 7 dias automaticamente para você.
              </p>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Qual será o Tema?
                </label>
                <input 
                  type="text" 
                  value={bulkTheme}
                  onChange={(e) => setBulkTheme(e.target.value)}
                  disabled={generatingBulk}
                  placeholder="Ex: Superando o Luto, Finanças Bíblicas..."
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all text-gray-900 dark:text-white placeholder:text-gray-400 disabled:opacity-50"
                  autoFocus
                />
              </div>

              <button
                onClick={handleBulkGenerate}
                disabled={generatingBulk || !bulkTheme.trim()}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:from-purple-400 disabled:to-indigo-400 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md mt-2"
              >
                {generatingBulk ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{bulkProgress || "Gerando os 7 dias..."}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Iniciar Geração Mágica
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
