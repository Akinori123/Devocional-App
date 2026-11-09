import { bibleBooks } from "../data/bibleBooks";

export interface ParsedVerseRef {
  bookId: string;
  bookName: string;
  chapter: number;
  verse: number;
  endVerse?: number;
}

export function parseVerseReference(
  reference: string,
): ParsedVerseRef | null {
  try {
    const cleanRef = reference
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const match = cleanRef.match(
      /^((?:\d\s*)?[A-Za-zÀ-ÿ\s]+?)\s+(\d+)\s*[:.]\s*(\d+)(?:\s*[-–—]\s*(\d+))?/,
    );
    if (!match) return null;

    let [, bookName, chapterStr, verseStr, endVerseStr] = match;
    bookName = bookName.trim().toLowerCase();

    const book = bibleBooks.find((b) => b.name.toLowerCase() === bookName);
    if (!book) {
      const partialBook = bibleBooks.find(
        (b) =>
          b.name.toLowerCase().startsWith(bookName) ||
          bookName.startsWith(b.name.toLowerCase()),
      );
      if (!partialBook) return null;
      return {
        bookId: partialBook.id,
        bookName: partialBook.name,
        chapter: parseInt(chapterStr, 10),
        verse: parseInt(verseStr, 10),
        endVerse: endVerseStr ? parseInt(endVerseStr, 10) : undefined,
      };
    }
    return {
      bookId: book.id,
      bookName: book.name,
      chapter: parseInt(chapterStr, 10),
      verse: parseInt(verseStr, 10),
      endVerse: endVerseStr ? parseInt(endVerseStr, 10) : undefined,
    };
  } catch (e) {
    return null;
  }
}

import { getVerseTextByRef } from '../services/bibleService';

export async function fetchVerseText(reference: string): Promise<string | null> {
  try {
    const parsed = parseVerseReference(reference);
    if (!parsed) return null;

    // 1. Try local offline-first high-speed Bible service
    const localText = await getVerseTextByRef(parsed.bookId, parsed.chapter, parsed.verse, parsed.endVerse);
    if (localText) {
      return localText;
    }

    // 2. Fallback to API if ever needed
    let query = `${parsed.bookId}%20${parsed.chapter}:${parsed.verse}`;
    if (parsed.endVerse && parsed.endVerse > parsed.verse) {
      query += `-${parsed.endVerse}`;
    }

    const res = await fetch(`/api/bible?book=${parsed.bookId}&chapter=${parsed.chapter}&verse=${parsed.verse}${parsed.endVerse ? `&endVerse=${parsed.endVerse}` : ''}`).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      if (data.text) return data.text.trim();
    }

    return null;
  } catch (e) {
    console.error('[bibleParser] Error fetching verse text:', e);
    return null;
  }
}

