const fs = require('fs');
let content = fs.readFileSync('src/components/profile/DiaryTab.tsx', 'utf8');

content = content.replace(
  "Nova Anotação",
  "✍️ Escrever para Deus..."
);

content = content.replace(
  "Nova Anotação",
  "✍️ Escrever para Deus..."
);

content = content.replace(
  "Você ainda não tem anotações.",
  "Seu diário está em branco. Feche os olhos, respire fundo e escreva o que Deus ministrou ao seu coração hoje."
);

fs.writeFileSync('src/components/profile/DiaryTab.tsx', content);
