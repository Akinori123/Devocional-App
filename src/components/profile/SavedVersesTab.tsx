import React, { useState, useEffect, useMemo } from 'react';
import { 
  Highlighter, 
  Trash2, 
  BookOpen, 
  Copy, 
  Search, 
  X, 
  Loader2, 
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { BibleHighlight, HighlightColor } from '../../types';
import { 
  HIGHLIGHT_COLORS, 
  removeHighlight, 
  subscribeAllUserHighlights 
} from '../../services/bibleHighlightService';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { cn } from '../../lib/utils';
import { bibleBooks } from '../../data/bibleBooks';

interface SavedVersesTabProps {
  onNavigateToBible?: (selection: { bookId: string; chapter: number; verse: number }) => void;
}

interface UnifiedSavedItem {
  id: string;
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  color: HighlightColor;
  text: string;
  isLegacy?: boolean;
}

export function SavedVersesTab({ onNavigateToBible }: SavedVersesTabProps = {}) {
  const toast = useToast();
  const { user } = useAuth();

  const [highlights, setHighlights] = useState<BibleHighlight[]>([]);
  const [legacyVerses, setLegacyVerses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedColor, setSelectedColor] = useState<HighlightColor | 'all'>('all');
  const [selectedBook, setSelectedBook] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Helper para resolver o nome em português do livro
  const getBookDisplayName = (bookIdOrName: string) => {
    if (!bookIdOrName) return '';
    const clean = bookIdOrName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = bibleBooks.find(b => 
      b.id.toLowerCase() === clean || 
      b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean ||
      b.englishName.toLowerCase().replace(/[^a-z0-9]/g, '') === clean
    );
    return found ? found.name : bookIdOrName;
  };

  // Helper para resolver o ID padronizado do livro
  const getStandardBookId = (bookIdOrName: string) => {
    if (!bookIdOrName) return '';
    const clean = bookIdOrName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const found = bibleBooks.find(b => 
      b.id.toLowerCase() === clean || 
      b.name.toLowerCase().replace(/[^a-z0-9]/g, '') === clean ||
      b.englishName.toLowerCase().replace(/[^a-z0-9]/g, '') === clean
    );
    return found ? found.id : bookIdOrName;
  };

  // 1. Escuta todos os destaques do Firestore em tempo real
  useEffect(() => {
    if (!user) {
      setHighlights([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubHighlights = subscribeAllUserHighlights(user.uid, (data) => {
      setHighlights(data);
      setLoading(false);
    });

    // 2. Escuta favoritos legados para retrocompatibilidade (mapeando para amarelo se houver)
    const legacyRef = collection(db, 'users', user.uid, 'savedVerses');
    const legacyQuery = query(legacyRef, orderBy('createdAt', 'desc'));
    const unsubLegacy = onSnapshot(legacyQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLegacyVerses(list);
    }, () => {});

    return () => {
      unsubHighlights();
      unsubLegacy();
    };
  }, [user]);

  // Unifica os itens para exibição limpa em lista única
  const unifiedItems: UnifiedSavedItem[] = useMemo(() => {
    const list: UnifiedSavedItem[] = [];
    const seenRefs = new Set<string>();

    // Primeiro os destaques oficiais com suas cores
    highlights.forEach(h => {
      const bookName = getBookDisplayName(h.bookName || h.book);
      const bookId = getStandardBookId(h.book || h.bookName || '');
      const refKey = `${bookId}_${h.chapter}_${h.verse}`.toLowerCase();
      seenRefs.add(refKey);

      list.push({
        id: h.id,
        bookId,
        bookName,
        chapter: h.chapter,
        verse: h.verse,
        color: h.color || 'yellow',
        text: h.text || '',
        isLegacy: false
      });
    });

    // Se houver favoritos antigos na subcoleção savedVerses que ainda não estão nos destaques, mapeia para amarelo
    legacyVerses.forEach(leg => {
      const ref = leg.reference || '';
      // Ex: "João 3:16" ou "Gênesis 1:1"
      const match = ref.match(/^(.+?)\s+(\d+):(\d+)/);
      if (match) {
        const rawBook = match[1].trim();
        const chap = parseInt(match[2], 10);
        const vNum = parseInt(match[3], 10);
        const bookId = getStandardBookId(rawBook);
        const refKey = `${bookId}_${chap}_${vNum}`.toLowerCase();

        if (!seenRefs.has(refKey)) {
          seenRefs.add(refKey);
          list.push({
            id: leg.id,
            bookId,
            bookName: getBookDisplayName(rawBook),
            chapter: chap,
            verse: vNum,
            color: 'yellow',
            text: leg.text || '',
            isLegacy: true
          });
        }
      }
    });

    return list;
  }, [highlights, legacyVerses]);

  // Lista de livros disponíveis entre os versículos salvos
  const availableBooks = useMemo(() => {
    const map = new Map<string, { bookId: string; bookName: string; count: number }>();
    unifiedItems.forEach(item => {
      const existing = map.get(item.bookId);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(item.bookId, {
          bookId: item.bookId,
          bookName: item.bookName,
          count: 1
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.bookName.localeCompare(b.bookName));
  }, [unifiedItems]);

  // Filtragem unificada por cor, livro e busca
  const filteredItems = useMemo(() => {
    return unifiedItems.filter(item => {
      if (selectedColor !== 'all' && item.color !== selectedColor) {
        return false;
      }

      if (selectedBook !== 'all' && item.bookId !== selectedBook) {
        return false;
      }

      if (searchQuery.trim()) {
        const term = searchQuery.toLowerCase().trim();
        const bookName = item.bookName.toLowerCase();
        const text = item.text.toLowerCase();
        const ref = `${bookName} ${item.chapter}:${item.verse}`.toLowerCase();
        return bookName.includes(term) || text.includes(term) || ref.includes(term);
      }

      return true;
    });
  }, [unifiedItems, selectedColor, selectedBook, searchQuery]);

  const handleDelete = async (item: UnifiedSavedItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    try {
      setDeletingId(item.id);
      if (item.isLegacy) {
        await deleteDoc(doc(db, 'users', user.uid, 'savedVerses', item.id));
      } else {
        await removeHighlight(user.uid, item.bookId, item.chapter, item.verse);
      }
      toast.success('Versículo removido dos salvos.');
    } catch (error) {
      console.error('Error removing verse:', error);
      toast.error('Não foi possível remover o versículo.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCopy = async (item: UnifiedSavedItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const reference = `${item.bookName} ${item.chapter}:${item.verse}`;
    const textToCopy = `"${item.text}" — ${reference} (Florescer Devocional)`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success('Versículo copiado para a área de transferência! 📋');
    } catch (err) {
      toast.error('Não foi possível copiar o texto.');
    }
  };

  const handleCardClick = (item: UnifiedSavedItem) => {
    if (onNavigateToBible) {
      onNavigateToBible({
        bookId: item.bookId,
        chapter: item.chapter,
        verse: item.verse
      });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Loader2 className="w-8 h-8 text-yellow-500 animate-spin mb-3" />
        <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">Carregando versículos salvos...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-5 space-y-4">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Highlighter className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <span>Versos Salvos</span>
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Todos os seus versículos destacados no leitor da Bíblia
          </p>
        </div>

        {unifiedItems.length > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 bg-yellow-100 dark:bg-yellow-950/60 text-yellow-800 dark:text-yellow-300 rounded-full border border-yellow-200 dark:border-yellow-800/60 shrink-0">
            {unifiedItems.length} {unifiedItems.length === 1 ? 'versículo' : 'versículos'}
          </span>
        )}
      </div>

      {/* Barra de Busca */}
      {unifiedItems.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por livro, capítulo ou palavras..."
            className="w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Filtros de Cores - 8 Cores com Scroll Horizontal Suave e sem corte de texto */}
      {unifiedItems.length > 0 && (
        <div 
          className="flex items-center gap-2 overflow-x-auto scrollbar-none w-full pb-1 pt-0.5 select-none touch-pan-x"
          onMouseDown={(e) => {
            const container = e.currentTarget;
            let startX = e.pageX - container.offsetLeft;
            let scrollLeft = container.scrollLeft;
            let isDown = true;

            const onMouseMove = (moveEvent: MouseEvent) => {
              if (!isDown) return;
              moveEvent.preventDefault();
              const x = moveEvent.pageX - container.offsetLeft;
              const walk = (x - startX) * 1.5;
              container.scrollLeft = scrollLeft - walk;
            };

            const onMouseUp = () => {
              isDown = false;
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        >
          {/* Botão Todas as Cores */}
          <button
            onClick={() => setSelectedColor('all')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 whitespace-nowrap cursor-pointer",
              selectedColor === 'all'
                ? "bg-yellow-500 text-white shadow-xs"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
            )}
            title="Mostrar todas as cores"
          >
            <div className="w-2.5 h-2.5 rounded-full bg-linear-to-tr from-yellow-400 via-rose-400 via-purple-400 to-emerald-400 shrink-0" />
            <span>Todas</span>
            <span className="text-[10px] opacity-75 font-semibold">({unifiedItems.length})</span>
          </button>
          
          {/* Botões Individuais das 8 Cores do Marca-Texto */}
          {HIGHLIGHT_COLORS.map((colorItem) => {
            const count = unifiedItems.filter((h) => h.color === colorItem.id).length;
            const isSelected = selectedColor === colorItem.id;
            return (
              <button
                key={colorItem.id}
                onClick={() => setSelectedColor(selectedColor === colorItem.id ? 'all' : colorItem.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 whitespace-nowrap cursor-pointer",
                  isSelected
                    ? "bg-gray-900 text-white dark:bg-white dark:text-slate-900 shadow-xs ring-2 ring-yellow-500/80 dark:ring-yellow-400 font-bold"
                    : count === 0
                      ? "bg-gray-100/70 dark:bg-slate-800/60 text-gray-400 dark:text-gray-500 opacity-60 hover:opacity-100"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                )}
                title={`Filtrar por ${colorItem.label} (${count})`}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full shrink-0 shadow-xs ring-1 ring-black/10", colorItem.dotClass)} />
                <span>{colorItem.label}</span>
                <span className="text-[10px] opacity-75 font-semibold">({count})</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Filtros de Livros (se houver mais de 1 livro salvo) */}
      {availableBooks.length > 1 && (
        <div 
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none select-none touch-pan-x"
          onMouseDown={(e) => {
            const container = e.currentTarget;
            let startX = e.pageX - container.offsetLeft;
            let scrollLeft = container.scrollLeft;
            let isDown = true;

            const onMouseMove = (moveEvent: MouseEvent) => {
              if (!isDown) return;
              moveEvent.preventDefault();
              const x = moveEvent.pageX - container.offsetLeft;
              const walk = (x - startX) * 1.5;
              container.scrollLeft = scrollLeft - walk;
            };

            const onMouseUp = () => {
              isDown = false;
              window.removeEventListener('mousemove', onMouseMove);
              window.removeEventListener('mouseup', onMouseUp);
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
          }}
        >
          <span className="text-[11px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider pl-1 shrink-0">
            Livros:
          </span>
          <button
            onClick={() => setSelectedBook('all')}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer",
              selectedBook === 'all'
                ? "bg-yellow-500 text-white shadow-2xs"
                : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
            )}
          >
            Todos
          </button>
          {availableBooks.map(b => (
            <button
              key={b.bookId}
              onClick={() => setSelectedBook(selectedBook === b.bookId ? 'all' : b.bookId)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1",
                selectedBook === b.bookId
                  ? "bg-yellow-500 text-white shadow-2xs"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-700"
              )}
            >
              <span>{b.bookName}</span>
              <span className="text-[10px] opacity-75">({b.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Lista de Versículos Salvos */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 px-4 bg-white dark:bg-slate-800/40 rounded-3xl border border-dashed border-gray-200 dark:border-slate-700 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-yellow-100/80 dark:bg-yellow-950/40 text-yellow-600 dark:text-yellow-400 flex items-center justify-center mx-auto mb-3">
            <Highlighter className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-gray-900 dark:text-white">
            {unifiedItems.length === 0 
              ? 'Nenhum versículo salvo ainda' 
              : 'Nenhum versículo encontrado'}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-xs mx-auto leading-relaxed">
            {unifiedItems.length === 0 
              ? 'Ao ler a Bíblia, toque em qualquer versículo e escolha uma cor de marca-texto para salvar automaticamente.' 
              : 'Tente alterar os filtros de cor ou o termo pesquisado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const colorConfig = HIGHLIGHT_COLORS.find((c) => c.id === item.color) || HIGHLIGHT_COLORS[0];
            const reference = `${item.bookName} ${item.chapter}:${item.verse}`;

            return (
              <div
                key={item.id}
                onClick={() => handleCardClick(item)}
                className={cn(
                  "p-4 sm:p-5 rounded-2xl shadow-xs border relative overflow-hidden transition-all duration-200 hover:shadow-md cursor-pointer group active:scale-[0.99]",
                  colorConfig.colorClass,
                  colorConfig.borderClass
                )}
              >
                {/* Borda lateral indicando a cor do marca-texto */}
                <div 
                  className={cn(
                    "absolute top-0 left-0 w-1.5 h-full", 
                    colorConfig.borderClass.replace('border-', 'bg-')
                  )} 
                />

                {/* Topo do Card: Referência, Tag de Cor e Ações */}
                <div className="flex items-center justify-between gap-2 mb-2 pl-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", colorConfig.dotClass)} />
                    <h4 className="font-bold text-gray-900 dark:text-white text-sm sm:text-base truncate">
                      {reference}
                    </h4>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {/* Botão de Copiar */}
                    <button
                      onClick={(e) => handleCopy(item, e)}
                      className="p-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                      title="Copiar texto"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Botão de Excluir */}
                    <button
                      onClick={(e) => handleDelete(item, e)}
                      disabled={deletingId === item.id}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-100/50 dark:hover:bg-red-950/40 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                      title="Remover versículo"
                    >
                      {deletingId === item.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Texto do Versículo em Destaque */}
                <p className="text-gray-900 dark:text-gray-100 font-serif font-bold text-sm sm:text-[15px] leading-relaxed pl-2 mb-3">
                  "{item.text}"
                </p>

                {/* Rodapé: Link direto para ler na Bíblia */}
                <div className="pt-2 border-t border-black/5 dark:border-white/10 pl-2 flex items-center justify-between text-xs font-semibold text-yellow-800 dark:text-yellow-300 group-hover:text-yellow-950 dark:group-hover:text-yellow-100 transition-colors">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Capítulo {item.chapter}</span>
                  </span>
                  
                  <div className="flex items-center gap-1 text-[11px] opacity-80 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all">
                    <span>Ir para o versículo</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
