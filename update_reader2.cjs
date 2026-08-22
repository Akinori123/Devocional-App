const fs = require('fs');
let content = fs.readFileSync('src/components/journey/DevotionalReader.tsx', 'utf8');

content = content.replace(
  "Gerar Devocional Inédito",
  "✨ Receber a Palavra de Hoje"
);

fs.writeFileSync('src/components/journey/DevotionalReader.tsx', content);
