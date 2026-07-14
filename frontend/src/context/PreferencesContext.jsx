import { createContext, useContext, useState, useEffect } from 'react';

const PreferencesContext = createContext(null);

export function PreferencesProvider({ children }) {
  const [theme, setTheme] = useState('light');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [compact, setCompact] = useState(false);
  const [showNotifications, setShowNotifications] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }

  function toggleCompact() {
    setCompact((prev) => !prev);
  }

  function toggleNotifications() {
    setShowNotifications((prev) => !prev);
  }

  return (
    <PreferencesContext.Provider value={{
      theme, toggleTheme,
      rowsPerPage, setRowsPerPage,
      compact, toggleCompact,
      showNotifications, toggleNotifications,
    }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
