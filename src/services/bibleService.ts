import { BibleBook, bibleBooks } from '../data/bibleBooks';

export interface BibleVerse {
  book_id: string;
  book_name: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface BibleChapterResponse {
  reference: string;
  book_id: string;
  book_name: string;
  chapter: number;
  verses: BibleVerse[];
  text: string;
  translation_id: string;
  translation_name: string;
  translation_note: string;
}

interface StoredBookData {
  id: string;
  name: string;
  abbrev: string;
  chapters: string[][];
}

// In-memory cache of loaded books for instantaneous chapter navigation (0ms)
const memoryCache = new Map<string, StoredBookData>();

/**
 * Finds a BibleBook by ID, name or abbreviation.
 */
export function findBook(identifier: string): BibleBook | undefined {
  const clean = identifier.trim().toLowerCase();
  return bibleBooks.find(b => 
    b.id.toLowerCase() === clean || 
    b.name.toLowerCase() === clean ||
    b.englishName.toLowerCase() === clean
  );
}

/**
 * Loads the complete book data from local static assets or fallback API.
 */
export async function loadBookData(bookId: string): Promise<StoredBookData | null> {
  const normalizedId = bookId.trim().toLowerCase();

  // 1. Check in-memory cache
  if (memoryCache.has(normalizedId)) {
    return memoryCache.get(normalizedId)!;
  }

  // 2. Fetch from static local JSON asset (/bible/{bookId}.json)
  try {
    const res = await fetch(`/bible/${normalizedId}.json`);
    if (res.ok) {
      const data: StoredBookData = await res.json();
      memoryCache.set(normalizedId, data);
      return data;
    }
  } catch (err) {
    console.warn(`[BibleService] Failed to load /bible/${normalizedId}.json from static assets:`, err);
  }

  // 3. Fallback: query backend API route (/api/bible?book={bookId})
  try {
    const res = await fetch(`/api/bible?book=${normalizedId}`);
    if (res.ok) {
      const data: StoredBookData = await res.json();
      memoryCache.set(normalizedId, data);
      return data;
    }
  } catch (err) {
    console.warn(`[BibleService] Failed to load /api/bible?book=${normalizedId}:`, err);
  }

  return null;
}

/**
 * Fetches all verses of a given book and chapter.
 */
export async function fetchChapterVerses(book: BibleBook, chapter: number): Promise<BibleChapterResponse> {
  const bookData = await loadBookData(book.id);

  if (bookData && bookData.chapters) {
    const chapterIndex = chapter - 1;
    const rawVerses = bookData.chapters[chapterIndex];

    if (rawVerses && Array.isArray(rawVerses)) {
      const verses: BibleVerse[] = rawVerses.map((verseText, idx) => ({
        book_id: book.id,
        book_name: book.name,
        chapter,
        verse: idx + 1,
        text: verseText
      }));

      return {
        reference: `${book.name} ${chapter}`,
        book_id: book.id,
        book_name: book.name,
        chapter,
        verses,
        text: rawVerses.join(' '),
        translation_id: 'almeida',
        translation_name: 'João Ferreira de Almeida',
        translation_note: 'Domínio Público'
      };
    }
  }

  // Fallback to backend API if static loading didn't find the chapter
  try {
    const apiRes = await fetch(`/api/bible?book=${encodeURIComponent(book.id)}&chapter=${chapter}`);
    if (apiRes.ok) {
      const data = await apiRes.json();
      if (data && data.verses) {
        return data;
      }
    }
  } catch (apiErr) {
    console.error('[BibleService] Error fetching from /api/bible:', apiErr);
  }

  throw new Error(`Não foi possível carregar o capítulo ${chapter} de ${book.name}.`);
}

/**
 * Fetches text of specific verse or verse range (e.g., "João 3:16" or "Salmos 23:1-6")
 */
export async function getVerseTextByRef(bookId: string, chapter: number, startVerse: number, endVerse?: number): Promise<string | null> {
  try {
    const bookData = await loadBookData(bookId);
    if (!bookData || !bookData.chapters) return null;

    const chapterIndex = chapter - 1;
    const rawVerses = bookData.chapters[chapterIndex];
    if (!rawVerses) return null;

    const startIndex = startVerse - 1;
    const endIndex = endVerse && endVerse >= startVerse ? endVerse - 1 : startIndex;

    const selected = rawVerses.slice(startIndex, endIndex + 1);
    if (selected.length === 0) return null;

    return selected
      .map((t) => t.trim())
      .join(' ')
      .replace(/\s+/g, ' ');
  } catch (err) {
    console.error('[BibleService] Error in getVerseTextByRef:', err);
    return null;
  }
}
