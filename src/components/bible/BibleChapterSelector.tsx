import { useState } from 'react';
import { BibleBook } from '../../data/bibleBooks';
import { ArrowLeft, Search, Check, Crown, BookOpen } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface BibleChapterSelectorProps {
  book: BibleBook;
  onSelectChapter: (chapter: number) => void;
  onBack: () => void;
}

export function BibleChapterSelector({ book, onSelectChapter, onBack }: BibleChapterSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const { profile } = useAuth();
  
  const completedChapters = profile?.bibleProgress?.[book.id] || [];
  const completedCount = completedChapters.length;
  const isMastered = completedCount >= book.chapters;
  const progressPercent = Math.min(100, Math.round((completedCount / book.chapters) * 100));

  const allChapters = Array.from({ length: book.chapters }, (_, i) => i + 1);
  const filteredChapters = allChapters.filter(chapter => 
    chapter.toString().includes(searchQuery)
  );

  return (
    <div className="pb-24 bg-[#FAFAFA] dark:bg-slate-900 min-h-screen transition-colors duration-200">
      {/* Sticky Top Header */}
      <div className="sticky top-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-gray-200 dark:border-slate-800 z-10 transition-colors duration-200">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={onBack}
              className="p-2 -ml-2 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-lg font-bold font-serif text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {book.name}
                {isMastered && <Crown className="w-4 h-4 text-amber-500 fill-amber-500/20 inline" />}
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {completedCount} de {book.chapters} capítulos lidos ({progressPercent}%)
              </p>
            </div>
          </div>

          {isMastered && (
            <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700/60 flex items-center gap-1 shadow-xs">
              <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
              100%
            </span>
          )}
        </div>

        {/* Progress Bar Header */}
        <div className="w-full h-1 bg-gray-100 dark:bg-slate-800">
          <div 
            className={`h-full transition-all duration-500 ${isMastered ? 'bg-amber-500' : 'bg-yellow-500'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        
        {book.chapters > 1 && (
          <div className="px-4 py-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Buscar número do capítulo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        )}
      </div>

      <div className="p-5 max-w-lg mx-auto">
        {/* Book Completion Banner if mastered */}
        {isMastered && (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-amber-500/10 border border-amber-300 dark:border-amber-700/60 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Crown className="w-5 h-5 fill-amber-500/20" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-900 dark:text-white">Livro Concluído! 👑</h4>
              <p className="text-xs text-gray-600 dark:text-gray-300">Você leu todos os capítulos deste livro. Glória a Deus!</p>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Capítulos ({filteredChapters.length})
          </h3>
          <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" />
              Lido
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 dark:bg-slate-700 inline-block" />
              Não lido
            </span>
          </div>
        </div>

        {/* Chapter Grid */}
        <div className="grid grid-cols-5 gap-2.5 sm:gap-3">
          {filteredChapters.map((chapter) => {
            const isCompleted = completedChapters.includes(chapter);

            return (
              <button
                key={chapter}
                onClick={() => onSelectChapter(chapter)}
                className={`aspect-square relative flex flex-col items-center justify-center rounded-2xl font-bold text-base transition-all duration-150 active:scale-95 shadow-xs ${
                  isCompleted
                    ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-yellow-950 border-2 border-yellow-300 dark:border-yellow-600/80 shadow-yellow-500/20'
                    : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-slate-700 hover:bg-yellow-50 dark:hover:bg-slate-700 hover:text-yellow-700 dark:hover:text-yellow-400'
                }`}
              >
                <span>{chapter}</span>
                {isCompleted && (
                  <div className="absolute top-1.5 right-1.5 w-3.5 h-3.5 rounded-full bg-yellow-950/20 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-yellow-950 stroke-[3]" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        
        {filteredChapters.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 text-sm">Nenhum capítulo encontrado para "{searchQuery}".</p>
          </div>
        )}
      </div>
    </div>
  );
}
