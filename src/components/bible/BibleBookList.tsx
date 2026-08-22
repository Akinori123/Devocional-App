import { useState, useEffect, useMemo } from 'react';
import { BibleBook, bibleBooks } from '../../data/bibleBooks';
import { BookOpen, Search, X, Play, Crown, CheckCircle2, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TabType } from '../../types';
import Fuse from 'fuse.js';

interface BibleBookListProps {
  onSelectBook: (book: BibleBook) => void;
  onSelectDirectChapter?: (book: BibleBook, chapter: number) => void;
  onChangeTab?: (tab: TabType) => void;
}

const normalizeText = (text: string) => 
  text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : '';

export function BibleBookList({ onSelectBook, onSelectDirectChapter, onChangeTab }: BibleBookListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const { user, profile } = useAuth();
  const userName = profile?.name ? profile.name.split(' ')[0] : 'Irmã(o)';

  // Debounce search query with 300ms delay
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Prepared normalized books dataset
  const searchableBooks = useMemo(() => {
    return bibleBooks.map(book => ({
      ...book,
      normalizedName: normalizeText(book.name),
      normalizedEnglishName: normalizeText(book.englishName),
      testamentSearch: book.testament === 'OT' ? 'antigo velho testamento ot' : 'novo testamento nt'
    }));
  }, []);

  // Configure Fuse.js instance
  const fuse = useMemo(() => {
    return new Fuse(searchableBooks, {
      keys: ['normalizedName', 'normalizedEnglishName', 'testamentSearch', 'id'],
      threshold: 0.4,
      distance: 100,
      ignoreLocation: true,
      minMatchCharLength: 1
    });
  }, [searchableBooks]);

  // Smart filtering logic (Substring matches + Fuzzy Fuse matches)
  const filteredBooks = useMemo(() => {
    const query = normalizeText(debouncedQuery).trim();
    if (!query) return bibleBooks;

    // 1. Direct substring matches (gives exact priority to partial sequence like "mom" -> Filemon)
    const substringMatches = searchableBooks.filter(book => 
      book.normalizedName.includes(query) ||
      book.normalizedEnglishName.includes(query) ||
      book.testamentSearch.includes(query)
    );

    // 2. Fuzzy Fuse.js matches for typos or broader search
    const fuseResults = fuse.search(query).map(result => result.item);

    // Merge without duplicates preserving order (substring matches first)
    const matchedBookIds = new Set(substringMatches.map(b => b.id));
    const mergedResults = [...substringMatches];

    for (const item of fuseResults) {
      if (!matchedBookIds.has(item.id)) {
        matchedBookIds.add(item.id);
        mergedResults.push(item);
      }
    }

    // Strip out auxiliary normalization properties before returning
    return mergedResults.map(({ normalizedName, normalizedEnglishName, testamentSearch, ...book }) => book);
  }, [debouncedQuery, searchableBooks, fuse]);

  const otBooks = filteredBooks.filter(b => b.testament === 'OT');
  const ntBooks = filteredBooks.filter(b => b.testament === 'NT');

  // Bible Progress Calculations
  const bibleProgress = profile?.bibleProgress || {};

  const totalCompletedChapters = useMemo(() => {
    return Object.values(bibleProgress).reduce((acc, chapters) => {
      return acc + (Array.isArray(chapters) ? chapters.length : 0);
    }, 0);
  }, [bibleProgress]);

  const totalCompletedBooks = useMemo(() => {
    return bibleBooks.filter(book => {
      const readChapters = bibleProgress[book.id] || [];
      return readChapters.length >= book.chapters;
    }).length;
  }, [bibleProgress]);

  const totalBibleChapters = 1189;
  const overallPercentage = Math.min(100, Math.round((totalCompletedChapters / totalBibleChapters) * 100));

  // Determine last read / continue reading target
  const continueReadingInfo = useMemo(() => {
    if (profile?.lastReadReference) {
      const targetBook = bibleBooks.find(b => b.id === profile.lastReadReference?.bookId) || bibleBooks[0];
      const targetChapter = profile.lastReadReference.chapter || 1;
      const isChapterRead = (bibleProgress[targetBook.id] || []).includes(targetChapter);
      return {
        book: targetBook,
        chapter: targetChapter,
        isRead: isChapterRead,
        isDefault: false
      };
    }
    // Default fallback
    return {
      book: bibleBooks[0], // Genesis
      chapter: 1,
      isRead: (bibleProgress['gen'] || []).includes(1),
      isDefault: true
    };
  }, [profile?.lastReadReference, bibleProgress]);

  const handleResumeReading = () => {
    if (onSelectDirectChapter) {
      onSelectDirectChapter(continueReadingInfo.book, continueReadingInfo.chapter);
    } else {
      onSelectBook(continueReadingInfo.book);
    }
  };

  const renderBookGroup = (title: string, books: BibleBook[]) => {
    if (books.length === 0) return null;
    
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between px-5 mb-3">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {title} ({books.length})
          </h3>
        </div>

        <div className="bg-white dark:bg-slate-800 border-y border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700/60 transition-colors duration-200">
          {books.map((book) => {
            const completedList = bibleProgress[book.id] || [];
            const completedCount = completedList.length;
            const isMastered = completedCount >= book.chapters;
            const progressPercent = Math.min(100, Math.round((completedCount / book.chapters) * 100));

            return (
              <button
                key={book.id}
                onClick={() => onSelectBook(book)}
                className={`w-full text-left px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/60 active:bg-gray-100 dark:active:bg-slate-700 transition-all ${
                  isMastered ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1 mr-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform ${
                    isMastered 
                      ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 shadow-sm ring-1 ring-amber-300 dark:ring-amber-600'
                      : completedCount > 0
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400'
                        : 'bg-gray-100 dark:bg-slate-700/70 text-gray-500 dark:text-gray-400'
                  }`}>
                    {isMastered ? (
                      <Crown className="w-5 h-5 fill-amber-500/20" />
                    ) : (
                      <BookOpen className="w-5 h-5" />
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                        {book.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5">
                      {isMastered ? (
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                          Todos os {book.chapters} capítulos lidos
                        </span>
                      ) : completedCount > 0 ? (
                        <span className="text-xs font-medium text-yellow-600 dark:text-yellow-400">
                          {completedCount} de {book.chapters} capítulos ({progressPercent}%)
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          {book.chapters} {book.chapters === 1 ? 'capítulo' : 'capítulos'}
                        </span>
                      )}
                    </div>

                    {/* Progress Bar for in-progress & mastered books */}
                    {completedCount > 0 && (
                      <div className="w-full max-w-xs h-1.5 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1.5">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            isMastered ? 'bg-amber-500' : 'bg-yellow-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isMastered ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60 shadow-xs">
                      <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Concluído
                    </span>
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="pb-24">
      {/* Header with search */}
      <div className="sticky top-0 z-50 bg-yellow-400/95 dark:bg-yellow-500/95 backdrop-blur-md pt-10 pb-6 px-6 text-yellow-950 shadow-sm rounded-b-3xl transition-colors duration-200">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-white/40 p-1.5 rounded-2xl backdrop-blur-md shadow-sm overflow-hidden flex items-center justify-center w-14 h-14 shrink-0">
              <img src="/rosa.png" alt="Florescer" className="w-full h-full object-cover" />
            </div>
            <span className="font-serif font-bold text-yellow-950 text-2xl tracking-tight">Florescer</span>
          </div>
          
          <button 
            onClick={() => onChangeTab?.('profile')} 
            className="w-14 h-14 rounded-full border-2 border-white/60 overflow-hidden shadow-sm flex items-center justify-center bg-yellow-100 hover:scale-105 transition-transform shrink-0"
          >
            {profile?.photoURL || user?.photoURL ? (
              <img src={profile?.photoURL || user?.photoURL || ''} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-yellow-900 font-bold text-lg">{userName.charAt(0).toUpperCase()}</span>
            )}
          </button>
        </div>

        <h1 className="text-2xl font-bold font-serif mb-1">Bíblia Sagrada</h1>
        <p className="text-yellow-900 dark:text-yellow-950 text-sm mb-4">Acompanhe seu progresso e mergulhe nas Escrituras.</p>
        
        <div className="relative shadow-sm rounded-xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Buscar livro (ex: Mateus, Filemon, Salmos)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white dark:bg-slate-800 border-transparent text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 transition-all text-sm shadow-xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Main Content */}
      <div className="pt-5">
        {/* Continue Reading Card (Netflix-style quick resume) */}
        {!debouncedQuery && (
          <div className="px-5 mb-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-yellow-500 to-amber-600 text-white p-5 shadow-lg shadow-amber-500/20 border border-yellow-300/40">
              {/* Background decorative element */}
              <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
              <div className="absolute right-4 top-4 opacity-15">
                <BookOpen className="w-20 h-20 text-white" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold uppercase tracking-wider bg-black/20 text-white backdrop-blur-xs">
                    <BookOpen className="w-3 h-3 text-yellow-200" />
                    {continueReadingInfo.isDefault ? 'Comece Agora' : 'Continue Lendo'}
                  </span>
                  {continueReadingInfo.isRead && (
                    <span className="text-[11px] font-semibold text-amber-100 bg-white/15 px-2 py-0.5 rounded-full">
                      ✓ Capítulo lido
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-bold font-serif text-white tracking-tight mb-1">
                  {continueReadingInfo.book.name}, Capítulo {continueReadingInfo.chapter}
                </h2>
                
                <p className="text-amber-100 text-xs mb-4 max-w-[80%] line-clamp-1">
                  {continueReadingInfo.isDefault 
                    ? 'Inicie sua jornada pelas Sagradas Escrituras hoje mesmo.' 
                    : `Retome exatamente onde parou no livro de ${continueReadingInfo.book.name}.`}
                </p>

                <button
                  onClick={handleResumeReading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-yellow-900 font-bold text-sm shadow-md hover:bg-yellow-50 active:scale-98 transition-all"
                >
                  <Play className="w-4 h-4 fill-current text-yellow-600" />
                  <span>{continueReadingInfo.isDefault ? 'Iniciar Leitura' : 'Retomar Leitura'}</span>
                </button>
              </div>
            </div>

            {/* Gamification Stats Overview */}
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xs flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Capítulos Lidos</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {totalCompletedChapters} <span className="text-xs font-normal text-gray-400">/ {totalBibleChapters}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-gray-200 dark:border-slate-700 shadow-xs flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Crown className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Livros Concluídos</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">
                    {totalCompletedBooks} <span className="text-xs font-normal text-gray-400">/ 66</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Book lists */}
        {renderBookGroup('Antigo Testamento', otBooks)}
        {renderBookGroup('Novo Testamento', ntBooks)}
        
        {filteredBooks.length === 0 && (
          <div className="text-center py-12 px-6">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum livro encontrado para "{debouncedQuery || searchQuery}".</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 text-xs text-yellow-600 dark:text-yellow-400 font-semibold hover:underline"
            >
              Limpar busca
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
