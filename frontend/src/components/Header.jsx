// ============================================================================
// Header.jsx — Bandeau supérieur commun : fil d'Ariane, bouton de thème,
// et menu déroulant du profil utilisateur (nom, rôle, lien profil, logout).
// ============================================================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Header({ breadcrumb }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Ferme le menu déroulant si on clique en dehors de sa zone.
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const initials = user?.nom
    ? user.nom.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
    : '??';

  return (
    <header className="topbar">
      <div className="breadcrumb">
        {breadcrumb.map((crumb, idx) => (
          <span key={idx}>
            {idx > 0 && <span className="breadcrumb-sep"> &gt; </span>}
            {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : <span>{crumb.label}</span>}
          </span>
        ))}
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="theme-toggle"
          onClick={toggleTheme}
          title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          aria-label="Toggle dark mode"
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>

        <div className="profile-menu" ref={menuRef}>
          <button
            type="button"
            className="profile-trigger"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="avatar">{initials}</span>
            <span className="profile-info">
              <span className="profile-name">{user?.nom || 'Unknown'}</span>
              <span className="profile-role">{user?.role === 'OPERATOR' ? 'Operator' : 'Client'}</span>
            </span>
            <span className="chevron">▾</span>
          </button>

          {menuOpen && (
            <div className="profile-dropdown">
              <Link to="/profile" onClick={() => setMenuOpen(false)}>Profile</Link>
              {user?.role === 'OPERATOR' && (
                <Link to="/settings" onClick={() => setMenuOpen(false)}>Settings</Link>
              )}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                  navigate('/login');
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
