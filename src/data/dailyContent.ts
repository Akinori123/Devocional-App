import { differenceInCalendarDays, startOfYear } from 'date-fns';

export const dailyVerses = [

  { text: "Confia no Senhor de todo o teu coração e não te estribes no teu próprio entendimento. Reconhece-o em todos os teus caminhos, e ele endireitará as tuas veredas.", reference: "Provérbios 3:5-6" },
  { text: "O Senhor é o meu pastor, nada me faltará.", reference: "Salmos 23:1" },
  { text: "Tudo posso naquele que me fortalece.", reference: "Filipenses 4:13" },
  { text: "Porque Deus amou o mundo de tal maneira que deu o seu Filho unigênito, para que todo aquele que nele crê não pereça, mas tenha a vida eterna.", reference: "João 3:16" },
  { text: "Não fui eu que ordenei a você? Seja forte e corajoso! Não se apavore nem desanime, pois o Senhor, o seu Deus, estará com você por onde você andar.", reference: "Josué 1:9" },
  { text: "O Senhor é a minha luz e a minha salvação; de quem terei temor? O Senhor é o meu forte refúgio; de quem terei medo?", reference: "Salmos 27:1" },
  { text: "Busquem, pois, em primeiro lugar o Reino de Deus e a sua justiça, e todas essas coisas lhes serão acrescentadas.", reference: "Mateus 6:33" },
  { text: "Sabemos que Deus age em todas as coisas para o bem daqueles que o amam, dos que foram chamados de acordo com o seu propósito.", reference: "Romanos 8:28" },
  { text: "Entregue o seu caminho ao Senhor; confie nele, e ele o fará.", reference: "Salmos 37:5" },
  { text: "Deixo-lhes a paz; a minha paz lhes dou. Não a dou como o mundo a dá. Não se perturbem os seus corações, nem tenham medo.", reference: "João 14:27" },
  { text: "Consagre ao Senhor tudo o que você faz, e os seus planos serão bem-sucedidos.", reference: "Provérbios 16:3" },
  { text: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei.", reference: "Mateus 11:28" },
  { text: "Peçam, e lhes será dado; busquem, e encontrarão; batam, e a porta lhes será aberta.", reference: "Mateus 7:7" },
  { text: "Mas os que esperam no Senhor renovarão as forças, subirão com asas como águias; correrão, e não se cansarão; caminharão, e não se fatigarão.", reference: "Isaías 40:31" },
  { text: "O choro pode durar uma noite, mas a alegria vem pela manhã.", reference: "Salmos 30:5" },
  { text: "Deem graças em todas as circunstâncias, pois esta é a vontade de Deus para vocês em Cristo Jesus.", reference: "1 Tessalonicenses 5:18" },
  { text: "Mil poderão cair ao seu lado; dez mil, à sua direita, mas nada o atingirá.", reference: "Salmos 91:7" },
  { text: "Alegrem-se na esperança, sejam pacientes na tribulação, perseverem na oração.", reference: "Romanos 12:12" },
  { text: "Ensina a criança no caminho em que deve andar, e, ainda quando for velho, não se desviará dele.", reference: "Provérbios 22:6" },
  { text: "O Senhor te abençoe e te guarde; o Senhor faça resplandecer o seu rosto sobre ti e te conceda graça.", reference: "Números 6:24-25" },
  { text: "Não andem ansiosos por coisa alguma, mas em tudo, pela oração e súplicas, e com ação de graças, apresentem seus pedidos a Deus.", reference: "Filipenses 4:6" },
  { text: "Seja a paz de Cristo o árbitro em vosso coração, à qual, também, fostes chamados em um só corpo; e sede agradecidos.", reference: "Colossenses 3:15" },
  { text: "O amor é paciente, o amor é bondoso. Não inveja, não se vangloria, não se orgulha.", reference: "1 Coríntios 13:4" },
  { text: "Cheguemo-nos, pois, com confiança ao trono da graça, para que possamos alcançar misericórdia e achar graça, a fim de sermos ajudados em tempo oportuno.", reference: "Hebreus 4:16" },
  { text: "O temor do Senhor é o princípio da sabedoria, e o conhecimento do Santo a prudência.", reference: "Provérbios 9:10" },
  { text: "Suportem-se uns aos outros e perdoem as queixas que tiverem uns contra os outros. Perdoem como o Senhor lhes perdoou.", reference: "Colossenses 3:13" },
  { text: "O seu amor dura para sempre!", reference: "Salmos 136:1" },
  { text: "Em paz me deito e logo adormeço, pois só tu, Senhor, me fazes viver em segurança.", reference: "Salmos 4:8" },
  { text: "Respondeu Jesus: 'Eu sou o caminho, a verdade e a vida. Ninguém vem ao Pai, a não ser por mim.'", reference: "João 14:6" },
  { text: "Se confessarmos os nossos pecados, ele é fiel e justo para perdoar os nossos pecados e nos purificar de toda injustiça.", reference: "1 João 1:9" },
  { text: "Guarda o teu coração, pois dele procedem as fontes da vida.", reference: "Provérbios 4:23" }
];

export const dailyVideos = [
  "a_uP36wZ_eA", // Day 1
  "9YqG7Bw02hU",
  "dO4iX9g5f3Q",
  "1yq6g9A7-3w",
  "3aO3Q9S1L_I",
  // In a real app, you would have more or fetch from a database. 
  // We'll just loop these if we run out.
];

export function getDailyContent() {
  // Use the day of the year to cycle through
  const now = new Date();
  const start = startOfYear(now);
  const dayOfYear = differenceInCalendarDays(now, start);
  
  

  const verseIndex = dayOfYear % dailyVerses.length;

  return {
    verse: dailyVerses[verseIndex],
    videoId: "" // No default video, only from admin
  };
}
