// ============================================================================
// Sidebar.jsx — Barre de navigation latérale, commune aux interfaces
// CLIENT et OPERATOR. La liste de liens affichée dépend du rôle de
// l'utilisateur connecté (passée en prop par le layout parent).
// ============================================================================

import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ links }) {
  const { logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">🛡️</div>
        <div>
          <div className="sidebar-title">SecureBank</div>
          <div className="sidebar-subtitle">Dispute Portal</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-icon" aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="sidebar-link sidebar-logout" onClick={logout}>
          <span className="sidebar-icon" aria-hidden="true">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
