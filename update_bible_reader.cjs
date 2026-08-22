const fs = require('fs');
let content = fs.readFileSync('src/components/bible/BibleReader.tsx', 'utf8');

content = content.replace(
  "`Salvar (${selectedVerses.size})`",
  "`❤️ Guardar no Coração (${selectedVerses.size})`"
);

content = content.replace(
  "'Versículo(s) salvo(s) com sucesso!'",
  "'Mensagem guardada com segurança! ✅'"
);

fs.writeFileSync('src/components/bible/BibleReader.tsx', content);
