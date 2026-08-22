import fs from 'fs';
const booksContent = fs.readFileSync('./src/data/bibleBooks.ts', 'utf-8');
const booksMatch = booksContent.match(/export const bibleBooks: BibleBook\[\] = (\[[\s\S]*?\]);/);
const books = eval(booksMatch[1]);

async function run() {
  const versesMap = {
    'oba': 21,
    'phm': 25,
    '2jn': 13,
    '3jn': 15,
    'jud': 25
  };
  for (const book of books) {
    let query = `${book.id}%201`;
    if (book.chapters === 1 && versesMap[book.id]) {
      query = `${book.id}%201:1-${versesMap[book.id]}`;
    }
    const res = await fetch(`https://bible-api.com/${query}?translation=almeida`);
    if (!res.ok) {
      console.log(`Failed for ${book.name} (${book.id})`);
    } else {
      const data = await res.json();
      if (!data.verses || data.verses.length === 0) {
         console.log(`No verses for ${book.name} (${book.id})`);
      } else if (book.chapters === 1 && data.verses.length === 1) {
         console.log(`Only 1 verse for ${book.name} (${book.id})`);
      }
    }
  }
  console.log("Done checking first chapters.");
}
run();
