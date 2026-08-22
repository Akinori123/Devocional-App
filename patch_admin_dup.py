import sys

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    content = f.read()

old_dup = """    const isDuplicate = platformDevotionals.some(
      d => d.theme.toLowerCase() === finalTheme.toLowerCase() && 
           d.title.toLowerCase() === devTitle.toLowerCase() && 
           d.id !== editingId
    );"""

new_dup = """    // Checar duplicata no banco de dados completo (para não falhar com a paginação)
    let isDuplicate = false;
    const qDup = query(collection(db, 'devotionals'));
    const snapshotDup = await getDocs(qDup);
    
    snapshotDup.docs.forEach(docSnap => {
      const data = docSnap.data();
      if (!data.deleted && data.id !== editingId) {
        if ((data.theme || '').toLowerCase() === finalTheme.toLowerCase() && 
            (data.title || '').toLowerCase() === devTitle.toLowerCase()) {
          isDuplicate = true;
        }
      }
    });

    if (!isDuplicate) {
      isDuplicate = mockDevotionals.some(
        m => m.theme.toLowerCase() === finalTheme.toLowerCase() && 
             m.title.toLowerCase() === devTitle.toLowerCase() && 
             m.id !== editingId
      );
    }"""

if old_dup in content:
    content = content.replace(old_dup, new_dup)
    with open('src/components/profile/AdminTab.tsx', 'w') as f:
        f.write(content)
    print("Success replacing dup check")
else:
    print("Failed to replace dup check")
