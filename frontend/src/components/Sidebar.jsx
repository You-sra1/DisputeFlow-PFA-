import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const CLIENT_LINKS = [
  { to: '/dashboard', label: 'Home', icon: '🏠' },
  { to: '/transactions', label: 'Transactions', icon: '💳' },
  { to: '/disputes', label: 'My Disputes', icon: '📁' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

const OPERATOR_LINKS = [
  { to: '/dashboard', label: 'Home', icon: '🏠' },
  { to: '/disputes', label: 'Disputes', icon: '📄' },
  { to: '/analytics', label: 'Analytics', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const isOperator = user?.role === 'OPERATOR';
  const links = isOperator ? OPERATOR_LINKS : CLIENT_LINKS;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-logo">🛡️</div>
        <div>
          <div className="sidebar-title">SecureBank</div>
          {!isOperator && <div className="sidebar-subtitle">Dispute Portal</div>}
        </div>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
          >
            <span className="sidebar-icon">{link.icon}</span>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="sidebar-logout" onClick={logout}>
          <span className="sidebar-icon">🚪</span> Logout
        </button>
      </div>
    </aside>
  );
}
