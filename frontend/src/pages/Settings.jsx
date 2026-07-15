// ============================================================================
// Settings.jsx — Page basique de préférences opérateur (placeholder
// fonctionnel : thème réutilisé depuis ThemeContext).
// ============================================================================

import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <Layout role={user.role} breadcrumb={[{ label: 'Home', to: user.role === 'OPERATOR' ? '/operator/dashboard' : '/dashboard' }, { label: 'Settings' }]}>
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="content-card">
        <div className="detail-row">
          <span className="detail-label">Appearance:</span>
          <button type="button" className="btn-secondary" onClick={toggleTheme}>
            Switch to {theme === 'light' ? 'Dark' : 'Light'} Mode
          </button>
        </div>
      </div>
    </Layout>
  );
}
