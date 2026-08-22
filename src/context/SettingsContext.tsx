import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type FontSize = 'sm' | 'base' | 'lg' | 'xl';
type Theme = 'light' | 'dark';

interface SettingsContextData {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cycleFontSize: () => void;
}

const SettingsContext = createContext<SettingsContextData>({} as SettingsContextData);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>('base');
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    const savedFont = localStorage.getItem('app_font_size') as FontSize;
    if (savedFont) setFontSizeState(savedFont);

    const savedTheme = localStorage.getItem('app_theme') as Theme;
    if (savedTheme) {
      setThemeState(savedTheme);
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem('app_font_size', size);
  };

  const cycleFontSize = () => {
    const sizes: FontSize[] = ['sm', 'base', 'lg', 'xl'];
    const currentIndex = sizes.indexOf(fontSize);
    const nextIndex = (currentIndex + 1) % sizes.length;
    setFontSize(sizes[nextIndex]);
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem('app_theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <SettingsContext.Provider value={{ fontSize, setFontSize, theme, setTheme, cycleFontSize }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);