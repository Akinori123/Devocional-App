import sys

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    content = f.read()

old_save = """  const handleSaveDevotional = async () => {
    if (!devTitle || !devContent) {
      console.error("Título e Reflexão são obrigatórios.");
      return;
    }

    const isDuplicate = platformDevotionals.some(
      d => d.theme.toLowerCase() === (devTheme || 'Geral').toLowerCase() && 
           d.title.toLowerCase() === devTitle.toLowerCase() && 
           d.id !== editingId
    );

    if (isDuplicate) {
      toast.error("Já existe um devocional com este exato Título e Tema.");
      return;
    }

    setSavingDev(true);
    try {
      if (editingId) {
        await updateGlobalDevotional(editingId, {
          theme: devTheme || 'Geral',
          title: devTitle,
          description: devDescription || devTitle,
          beautifulWord: devWord,
          content: devContent,
        });
        resetForm();
      } else {
        const devRef = doc(collection(db, 'devotionals'));
        await setDoc(devRef, {
          id: devRef.id,
          theme: devTheme || 'Geral',
          title: devTitle,
          description: devDescription || devTitle,
          beautifulWord: devWord,
          content: devContent,
          createdAt: serverTimestamp()
        });
      }
      resetForm();
    } catch (error: any) {
      console.error("Erro ao salvar devocional: " + error.message);
    } finally {
      setSavingDev(false);
    }
  };"""

new_save = """  const handleSaveDevotional = async () => {
    if (!devTitle || !devContent) {
      toast.error("Título e Reflexão são obrigatórios.");
      return;
    }

    let finalTheme = devTheme.trim();
    if (!editingId) {
      if (manualCreationType === 'single') {
        finalTheme = 'Dia Avulso';
      } else if (manualCreationType === 'existing_module') {
        if (!finalTheme) {
          toast.error("Por favor, selecione um módulo existente.");
          return;
        }
      } else if (manualCreationType === 'new_module') {
        if (!finalTheme) {
          toast.error("Por favor, digite o nome do novo módulo.");
          return;
        }
      }
    } else {
        if (!finalTheme) {
            finalTheme = 'Dia Avulso';
        }
    }

    const isDuplicate = platformDevotionals.some(
      d => d.theme.toLowerCase() === finalTheme.toLowerCase() && 
           d.title.toLowerCase() === devTitle.toLowerCase() && 
           d.id !== editingId
    );

    if (isDuplicate) {
      toast.error("Já existe um devocional com este exato Título e Tema.");
      return;
    }

    setSavingDev(true);
    try {
      if (editingId) {
        await updateGlobalDevotional(editingId, {
          theme: finalTheme,
          title: devTitle,
          description: devDescription || devTitle,
          beautifulWord: devWord,
          content: devContent,
        });
      } else {
        const devRef = doc(collection(db, 'devotionals'));
        await setDoc(devRef, {
          id: devRef.id,
          theme: finalTheme,
          title: devTitle,
          description: devDescription || devTitle,
          beautifulWord: devWord,
          content: devContent,
          createdAt: serverTimestamp()
        });
      }
      // Reload themes to ensure the new one is available in dropdown
      setAllThemes(prev => {
        if (finalTheme !== 'Dia Avulso' && !prev.includes(finalTheme)) {
          return [...prev, finalTheme].sort();
        }
        return prev;
      });
      resetForm();
    } catch (error: any) {
      console.error("Erro ao salvar devocional: " + error.message);
      toast.error("Ocorreu um erro ao salvar.");
    } finally {
      setSavingDev(false);
    }
  };"""

if old_save in content:
    content = content.replace(old_save, new_save)
    with open('src/components/profile/AdminTab.tsx', 'w') as f:
        f.write(content)
    print("Success")
else:
    print("Old save not found")
