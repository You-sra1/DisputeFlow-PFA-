// ============================================================================
// Layout.jsx — Structure commune à toutes les pages protégées :
// Sidebar à gauche + Header en haut + contenu de la page à droite.
// ============================================================================

import Sidebar from './Sidebar';
import Header from './Header';

const CLIENT_LINKS = [
  { to: '/dashboard', label: 'Home', icon: '🏠' },
  { to: '/transactions', label: 'Transactions', icon: '💳' },
  { to: '/disputes', label: 'My Disputes', icon: '📁' },
  { to: '/profile', label: 'Profile', icon: '👤' },
];

const OPERATOR_LINKS = [
  { to: '/operator/dashboard', label: 'Home', icon: '🏠' },
  { to: '/operator/disputes', label: 'Disputes', icon: '📄' },
  { to: '/operator/analytics', label: 'Analytics', icon: '📊' },
  { to: '/settings', label: 'Settings', icon: '⚙️' },
];

export default function Layout({ role, breadcrumb, children }) {
  const links = role === 'OPERATOR' ? OPERATOR_LINKS : CLIENT_LINKS;

  return (
    <div className="app-shell">
      <Sidebar links={links} />
      <div className="app-main">
        <Header breadcrumb={breadcrumb} />
        <main className="app-content">{children}</main>
        <footer className="app-footer">
          © 2026 SecureBank. <a href="#privacy">Privacy Policy</a> · <a href="#terms">Terms of Service</a>
        </footer>
      </div>
    </div>
  );
}
