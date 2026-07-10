import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, registerUnauthorizedHandler } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();

  // Branché une seule fois : si une requête API renvoie 401 n'importe où
  // dans l'app, on déconnecte et on redirige vers /login.
  useEffect(() => {
    registerUnauthorizedHandler(() => {
      setUser(null);
      setToken(null);
      navigate('/login');
    });
  }, [navigate]);

  async function login(email, password) {
    const data = await authAPI.login(email, password);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    setUser(null);
    setToken(null);
    navigate('/login');
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
