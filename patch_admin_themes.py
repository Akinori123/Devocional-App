import sys

with open('src/components/profile/AdminTab.tsx', 'r') as f:
    content = f.read()

# Add allThemes state
content = content.replace(
    "const [manualCreationType, setManualCreationType] = useState<'single' | 'existing_module' | 'new_module'>('single');",
    "const [manualCreationType, setManualCreationType] = useState<'single' | 'existing_module' | 'new_module'>('single');\n  const [allThemes, setAllThemes] = useState<string[]>([]);"
)

# Fetch all themes
fetch_themes_code = """
  useEffect(() => {
    const fetchAllThemes = async () => {
      try {
        const q = query(collection(db, 'devotionals'));
        const snapshot = await getDocs(q);
        const themes = new Set<string>();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!data.deleted && data.theme && data.theme !== 'Dia Avulso') {
            themes.add(data.theme);
          }
        });
        mockDevotionals.forEach(m => {
          if (m.theme && m.theme !== 'Dia Avulso') {
            themes.add(m.theme);
          }
        });
        setAllThemes(Array.from(themes).sort());
      } catch (err) {
        console.error('Error fetching themes:', err);
      }
    };
    fetchAllThemes();
  }, [showManualModal, activeTab]);
"""

content = content.replace(
    "  const platformDevotionals =",
    fetch_themes_code + "\n  const platformDevotionals ="
)

# Update dropdown to use allThemes
content = content.replace(
    "{Array.from(new Set(globalDevotionals.map((d: any) => d.theme).filter((t: string) => t && t !== 'Dia Avulso'))).map((t: any) => (",
    "{allThemes.map((t: string) => ("
)

with open('src/components/profile/AdminTab.tsx', 'w') as f:
    f.write(content)
