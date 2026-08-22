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

export async function fetchVerseText(reference: string): Promise<string | null> {
  try {
    const parsed = parseVerseReference(reference);
    if (!parsed) return null;

    let query = `${parsed.bookId}%20${parsed.chapter}:${parsed.verse}`;
    if (parsed.endVerse && parsed.endVerse > parsed.verse) {
      query += `-${parsed.endVerse}`;
    }

    let response = await fetch(`https://bible-api.com/${query}?translation=almeida`);
    if (!response.ok) {
      response = await fetch(`https://bible-api.com/${query}`);
    }

    if (!response.ok) return null;

    const data = await response.json();
    if (data.text) {
      // Clean up whitespace and linebreaks
      const cleaned = data.text
        .replace(/[\r\n]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return cleaned;
    }
    return null;
  } catch (e) {
    return null;
  }
}

