import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  onSnapshot, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export type HighlightColor = 'yellow' | 'orange' | 'red' | 'pink' | 'purple' | 'blue' | 'teal' | 'green';

export interface BibleHighlight {
  id: string; // `${bookId}_c${chapter}_v${verse}`
  book: string;
  bookName?: string;
  chapter: number;
  verse: number;
  color: HighlightColor;
  text?: string;
  updatedAt?: any;
  createdAt?: any;
}

export const HIGHLIGHT_COLORS: {
  id: HighlightColor;
  label: string;
  bgHex: string;
  colorClass: string;
  textClass: string;
  dotClass: string;
  badgeClass: string;
  borderClass: string;
}[] = [
  {
    id: 'yellow',
    label: 'Amarelo',
    bgHex: '#FEF08A',
    colorClass: 'bg-yellow-200/60 dark:bg-yellow-500/25',
    textClass: 'text-yellow-950 dark:text-yellow-100',
    dotClass: 'bg-yellow-400 ring-yellow-400/50',
    badgeClass: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/60 dark:text-yellow-300',
    borderClass: 'border-yellow-400 dark:border-yellow-500'
  },
  {
    id: 'orange',
    label: 'Laranja',
    bgHex: '#FED7AA',
    colorClass: 'bg-orange-200/60 dark:bg-orange-500/25',
    textClass: 'text-orange-950 dark:text-orange-100',
    dotClass: 'bg-orange-400 ring-orange-400/50',
    badgeClass: 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300',
    borderClass: 'border-orange-400 dark:border-orange-500'
  },
  {
    id: 'red',
    label: 'Vermelho',
    bgHex: '#FECDD3',
    colorClass: 'bg-rose-200/60 dark:bg-rose-500/25',
    textClass: 'text-rose-950 dark:text-rose-100',
    dotClass: 'bg-rose-400 ring-rose-400/50',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300',
    borderClass: 'border-rose-400 dark:border-rose-500'
  },
  {
    id: 'pink',
    label: 'Rosa',
    bgHex: '#FBCFE8',
    colorClass: 'bg-pink-200/60 dark:bg-pink-500/25',
    textClass: 'text-pink-950 dark:text-pink-100',
    dotClass: 'bg-pink-400 ring-pink-400/50',
    badgeClass: 'bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-300',
    borderClass: 'border-pink-400 dark:border-pink-500'
  },
  {
    id: 'purple',
    label: 'Roxo',
    bgHex: '#E9D5FF',
    colorClass: 'bg-purple-200/60 dark:bg-purple-500/25',
    textClass: 'text-purple-950 dark:text-purple-100',
    dotClass: 'bg-purple-400 ring-purple-400/50',
    badgeClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300',
    borderClass: 'border-purple-400 dark:border-purple-500'
  },
  {
    id: 'blue',
    label: 'Azul',
    bgHex: '#BAE6FD',
    colorClass: 'bg-sky-200/60 dark:bg-sky-500/25',
    textClass: 'text-sky-950 dark:text-sky-100',
    dotClass: 'bg-sky-400 ring-sky-400/50',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300',
    borderClass: 'border-sky-400 dark:border-sky-500'
  },
  {
    id: 'teal',
    label: 'Turquesa',
    bgHex: '#99F6E4',
    colorClass: 'bg-teal-200/60 dark:bg-teal-500/25',
    textClass: 'text-teal-950 dark:text-teal-100',
    dotClass: 'bg-teal-400 ring-teal-400/50',
    badgeClass: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300',
    borderClass: 'border-teal-400 dark:border-teal-500'
  },
  {
    id: 'green',
    label: 'Verde',
    bgHex: '#A7F3D0',
    colorClass: 'bg-emerald-200/60 dark:bg-emerald-500/25',
    textClass: 'text-emerald-950 dark:text-emerald-100',
    dotClass: 'bg-emerald-400 ring-emerald-400/50',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
    borderClass: 'border-emerald-400 dark:border-emerald-500'
  }
];

export function getHighlightDocId(bookId: string, chapter: number, verse: number): string {
  const cleanBook = (bookId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${cleanBook}_c${chapter}_v${verse}`;
}

/**
 * Escuta os destaques do capítulo atual do usuário em tempo real
 */
export function subscribeToChapterHighlights(
  userId: string,
  bookId: string,
  chapter: number,
  onUpdate: (highlights: Record<number, BibleHighlight>) => void
): () => void {
  if (!userId) return () => {};

  try {
    const highlightsRef = collection(db, 'users', userId, 'highlights');
    const cleanBook = (bookId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const q = query(
      highlightsRef, 
      where('book', '==', cleanBook), 
      where('chapter', '==', chapter)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const highlightsMap: Record<number, BibleHighlight> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as BibleHighlight;
        if (data && data.verse) {
          highlightsMap[data.verse] = {
            ...data,
            id: docSnap.id
          };
        }
      });
      onUpdate(highlightsMap);
    }, (error) => {
      console.warn('Highlights subscription error:', error);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to highlights:', err);
    return () => {};
  }
}

/**
 * Salva ou atualiza a cor de destaque de um versículo no Firestore
 */
export async function saveHighlight(
  userId: string,
  bookId: string,
  bookName: string,
  chapter: number,
  verse: number,
  color: HighlightColor,
  text: string
): Promise<void> {
  if (!userId) return;

  const cleanBook = (bookId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const docId = getHighlightDocId(cleanBook, chapter, verse);
  const highlightRef = doc(db, 'users', userId, 'highlights', docId);

  await setDoc(highlightRef, {
    id: docId,
    book: cleanBook,
    bookName: bookName || cleanBook,
    chapter,
    verse,
    color,
    text: text ? text.trim() : '',
    updatedAt: serverTimestamp(),
    createdAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Remove o destaque de um versículo
 */
export async function removeHighlight(
  userId: string,
  bookId: string,
  chapter: number,
  verse: number
): Promise<void> {
  if (!userId) return;

  const cleanBook = (bookId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const docId = getHighlightDocId(cleanBook, chapter, verse);
  const highlightRef = doc(db, 'users', userId, 'highlights', docId);

  await deleteDoc(highlightRef);
}

/**
 * Escuta todos os destaques do usuário em tempo real
 */
export function subscribeAllUserHighlights(
  userId: string,
  onUpdate: (highlights: BibleHighlight[]) => void
): () => void {
  if (!userId) return () => {};

  try {
    const highlightsRef = collection(db, 'users', userId, 'highlights');

    const unsubscribe = onSnapshot(highlightsRef, (snapshot) => {
      const list: BibleHighlight[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as BibleHighlight;
        if (data) {
          list.push({
            ...data,
            id: docSnap.id
          });
        }
      });

      // Ordena pelos mais recentes
      list.sort((a, b) => {
        const timeA = a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
        const timeB = b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });

      onUpdate(list);
    }, (error) => {
      console.warn('All highlights subscription error:', error);
    });

    return unsubscribe;
  } catch (err) {
    console.warn('Failed to subscribe to all highlights:', err);
    return () => {};
  }
}
