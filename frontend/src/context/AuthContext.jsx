// ============================================================================
// AuthContext.jsx — Contexte React qui garde en mémoire l'utilisateur connecté
// et son token JWT, pour toute la durée de vie de l'application.
//
// Rôle :
//   - Exposer login()/logout() et l'utilisateur courant à tous les composants
//     via le hook useAuth().
//   - Persister le token en sessionStorage pour survivre à un rechargement
//     de page (F5) sans forcer une reconnexion, tout en restant propre à
//     l'onglet du navigateur (sessionStorage, pas localStorage).
//   - Servir de source de vérité unique pour le rôle (CLIENT / OPERATOR),
//     utilisé par ProtectedRoute pour restreindre l'accès aux pages.
// ============================================================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../api';

const AuthContext = createContext(null);

const STORAGE_KEY = 'securebank_auth';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Au premier montage, on tente de restaurer une session depuis sessionStorage.
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { token: savedToken, user: savedUser } = JSON.parse(saved);
        setToken(savedToken);
        setUser(savedUser);
      } catch {
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
    setInitializing(false);
  }, []);

  const persist = (newToken, newUser) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: newUser }));
  };

  /** Appelle POST /login et stocke le token + l'utilisateur si succès. */
  const login = useCallback(async (email, password) => {
    const data = await api.login(email, password);
    setToken(data.token);
    setUser(data.user);
    persist(data.token, data.user);
    return data.user;
  }, []);

  /** Met à jour l'utilisateur en mémoire (après une modification de profil réussie). */
  const updateUser = useCallback(
    (patch) => {
      setUser((prev) => {
        const updated = { ...prev, ...patch };
        persist(token, updated);
        return updated;
      });
    },
    [token]
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = {
    token,
    user,
    isAuthenticated: Boolean(token && user),
    initializing,
    login,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook d'accès au contexte d'authentification depuis n'importe quel composant. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth doit être utilisé à l\'intérieur d\'un <AuthProvider>.');
  }
  return ctx;
}
