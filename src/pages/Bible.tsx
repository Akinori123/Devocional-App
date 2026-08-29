import { useState, useEffect, useRef } from 'react';
import { BibleBook, bibleBooks } from '../data/bibleBooks';
import { BibleBookList } from '../components/bible/BibleBookList';
import { BibleChapterSelector } from '../components/bible/BibleChapterSelector';
import { BibleReader } from '../components/bible/BibleReader';
import { TabType } from '../types';
import { Crown, X } from 'lucide-react';

type BibleView = 'bookList' | 'chapterList' | 'reader';

interface BibleProps {
  initialSelection?: { bookId: string; chapter: number; verse: number } | null;
  clearInitialSelection?: () => void;
  onChangeTab?: (tab: TabType, subTab?: 'diary' | 'verses' | 'subscription' | 'settings' | 'admin') => void;
}

export function Bible({ initialSelection, clearInitialSelection, onChangeTab }: BibleProps) {
  const [view, setView] = useState<BibleView>('bookList');
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [selectedVerse, setSelectedVerse] = useState<number | undefined>();
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  const handledSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialSelection) {
      const key = `${initialSelection.bookId}-${initialSelection.chapter}-${initialSelection.verse}`;
      if (handledSelectionRef.current === key) return;
      handledSelectionRef.current = key;

      const book = bibleBooks.find(b => b.id === initialSelection.bookId);
      if (book) {
        setSelectedBook(book);
        setSelectedChapter(initialSelection.chapter);
        setSelectedVerse(initialSelection.verse);
        setView('reader');
      }
      if (clearInitialSelection) {
        clearInitialSelection();
      }
    }
  }, [initialSelection, clearInitialSelection]);

  const handleSelectBook = (book: BibleBook) => {
    setSelectedBook(book);
    setView('chapterList');
  };

  const handleSelectDirectChapter = (book: BibleBook, chapter: number) => {
    setSelectedBook(book);
    setSelectedChapter(chapter);
    setSelectedVerse(undefined);
    setView('reader');
  };

  const handleSelectChapter = (chapter: number) => {
    setSelectedChapter(chapter);
    setSelectedVerse(undefined);
    setView('reader');
  };

  const handleBackToBooks = () => {
    setView('bookList');
  };

  const handleBackToChapters = () => {
    setView('chapterList');
  };

  return (
    <div className="flex-1 w-full bg-gray-50 dark:bg-slate-900 h-full transition-colors duration-200 relative">
      {view === 'bookList' && (
        <BibleBookList 
          onSelectBook={handleSelectBook} 
          onSelectDirectChapter={handleSelectDirectChapter}
          onChangeTab={onChangeTab} 
        />
      )}
      
      {view === 'chapterList' && selectedBook && (
        <BibleChapterSelector 
          book={selectedBook} 
          onSelectChapter={handleSelectChapter}
          onBack={handleBackToBooks}
        />
      )}

      {view === 'reader' && selectedBook && (
        <BibleReader
          book={selectedBook}
          chapter={selectedChapter}
          initialVerse={selectedVerse}
          onBack={handleBackToChapters}
          onShowPremium={() => setShowPremiumModal(true)}
          onSelectChapter={handleSelectChapter}
        />
      )}

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
                A narração em áudio é exclusiva para assinantes do Florescer Premium.
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
    </div>
  );
}
