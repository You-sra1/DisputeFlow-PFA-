// ============================================================================
// ThemeContext.jsx — Gère la bascule Light Mode / Dark Mode de l'application.
//
// Le thème choisi est appliqué en ajoutant/retirant la classe "dark" sur la
// balise <html>, ce qui active les variables CSS sombres définies dans
// App.css. Le choix est mémorisé dans localStorage (préférence d'affichage,
// pas une donnée sensible) pour persister entre les sessions.
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext(null);
const STORAGE_KEY = 'securebank_theme';

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || 'light');

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé à l\'intérieur d\'un <ThemeProvider>.');
  return ctx;
}
