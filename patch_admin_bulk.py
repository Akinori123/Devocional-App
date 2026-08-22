import sys

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    content = f.read()

old_bulk = """      // 1. Checa se já existe um módulo com esse tema usando Normalização Semântica (agora verificando todos os módulos, incluindo os padrões)
      let existingDaysCount = 0;
      
      const normalizedInput = normalizeThemeName(bulkTheme);
      let originalThemeName = bulkTheme.trim();
      
      platformDevotionals.forEach(dev => {
        const docTheme = dev.theme || '';
        if (!docTheme) return;
        
        const normalizedDocTheme = normalizeThemeName(docTheme);
        if (normalizedDocTheme === normalizedInput) {
          existingDaysCount++;
          originalThemeName = docTheme; // Usa o nome exato já salvo no banco
        }
      });"""

new_bulk = """      // 1. Checa se já existe um módulo com esse tema usando Normalização Semântica (pesquisa no banco de dados completo)
      let existingDaysCount = 0;
      
      const normalizedInput = normalizeThemeName(bulkTheme);
      let originalThemeName = bulkTheme.trim();
      
      const q = query(collection(db, 'devotionals'));
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (!data.deleted && data.theme) {
          if (normalizeThemeName(data.theme) === normalizedInput) {
            existingDaysCount++;
            originalThemeName = data.theme; // Usa o nome exato já salvo no banco
          }
        }
      });
      
      mockDevotionals.forEach(m => {
        if (m.theme && normalizeThemeName(m.theme) === normalizedInput) {
           existingDaysCount++;
           originalThemeName = m.theme;
        }
      });"""

if old_bulk in content:
    content = content.replace(old_bulk, new_bulk)
    with open('src/components/profile/AdminTab.tsx', 'w') as f:
        f.write(content)
    print("Success replacing bulk")
else:
    print("Failed to replace bulk")
