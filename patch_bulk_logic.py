import sys

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    content = f.read()

old_logic = """      // 1. Checa se já existe um módulo com esse tema usando Normalização Semântica (agora verificando todos os módulos, incluindo os padrões)
      let maxPart = 0;
      
      const normalizedInput = normalizeThemeName(bulkTheme);
      let originalThemeName = bulkTheme.trim();
      
      platformDevotionals.forEach(dev => {
        const docTheme = dev.theme || '';
        if (!docTheme) return;
        
        let baseDocTheme = docTheme;
        let docPart = 1;
        
        // Verifica se o tema atual já é uma "Parte X"
        const partMatch = docTheme.match(/ - [pP]arte (\\d+)$/);
        if (partMatch) {
          baseDocTheme = docTheme.substring(0, partMatch.index).trim();
          docPart = parseInt(partMatch[1], 10);
        }
        
        const normalizedDocTheme = normalizeThemeName(baseDocTheme);
        
        if (normalizedDocTheme === normalizedInput) {
          maxPart = Math.max(maxPart, docPart);
          originalThemeName = baseDocTheme; // Usa o nome exato já salvo no banco
        }
      });

      const nextPart = maxPart > 0 ? maxPart + 1 : 1;
      const finalThemeName = nextPart > 1 ? `${originalThemeName} - Parte ${nextPart}` : originalThemeName;"""

new_logic = """      // 1. Checa se já existe um módulo com esse tema usando Normalização Semântica (agora verificando todos os módulos, incluindo os padrões)
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
      });

      const nextPart = Math.floor(existingDaysCount / 7) + 1;
      const finalThemeName = originalThemeName;"""

content = content.replace(old_logic, new_logic)

save_old = """      // Salva os 7 dias no Firestore
      setBulkProgress("Salvando módulo no banco de dados...");
      for (let i = 0; i < generatedDays.length; i++) {
        const day = generatedDays[i];
        const devRef = doc(collection(db, 'devotionals'));
        await setDoc(devRef, {
          id: devRef.id,
          theme: finalThemeName,
          title: day.title || `Dia ${i + 1}: ${finalThemeName}`,
          description: day.title || `Dia ${i + 1} do módulo ${finalThemeName}`,
          beautifulWord: day.beautifulWord || '',
          content: day.content || '',
          createdAt: serverTimestamp()
        });
      }"""

save_new = """      // Salva os 7 dias no Firestore
      setBulkProgress("Salvando módulo no banco de dados...");
      const dayOffset = existingDaysCount;
      for (let i = 0; i < generatedDays.length; i++) {
        const dayNumber = dayOffset + i + 1;
        const day = generatedDays[i];
        const devRef = doc(collection(db, 'devotionals'));
        
        let title = day.title || `Dia ${dayNumber}: ${finalThemeName}`;
        if (!title.toLowerCase().includes('dia ')) {
          title = `Dia ${dayNumber} - ${title}`;
        }
        
        await setDoc(devRef, {
          id: devRef.id,
          theme: finalThemeName,
          title: title,
          description: day.description || `Dia ${dayNumber} do módulo ${finalThemeName}`,
          beautifulWord: day.beautifulWord || '',
          content: day.content || '',
          createdAt: serverTimestamp()
        });
      }"""

content = content.replace(save_old, save_new)

with open('src/components/profile/AdminTab.tsx', 'w') as f:
    f.write(content)
