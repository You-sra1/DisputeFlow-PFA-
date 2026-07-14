import { useState, useEffect } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';
import { decodeToken } from '../utils/jwt';

function SessionCountdown({ token }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    function calc() {
      const payload = decodeToken(token);
      if (!payload || !payload.exp) { setRemaining('Unknown'); return; }
      const diff = payload.exp * 1000 - Date.now();
      if (diff <= 0) { setRemaining('Expired'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setRemaining(`${h}h ${m}min`);
    }
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [token]);

  return <span>{remaining}</span>;
}

export default function Settings() {
  const { user, token } = useAuth();
  const {
    theme, toggleTheme,
    rowsPerPage, setRowsPerPage,
    compact, toggleCompact,
    showNotifications, toggleNotifications,
  } = usePreferences();

  return (
    <DashboardLayout breadcrumb="Home / Settings" showMenuIcon>
      <h1>Settings</h1>

      {/* ── Section 1: Theme ── */}
      <div className="card">
        <h3>Theme</h3>
        <div className="settings-row">
          <span>Dark mode</span>
          <button className={`toggle-btn ${theme === 'dark' ? 'on' : ''}`} onClick={toggleTheme}>
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      {/* ── Section 2: Session ── */}
      <div className="card">
        <h3>Session</h3>
        <div className="settings-grid">
          <div className="settings-item">
            <span className="settings-label">Name</span>
            <span className="settings-value">{user?.name}</span>
          </div>
          <div className="settings-item">
            <span className="settings-label">Email</span>
            <span className="settings-value">{user?.email}</span>
          </div>
          <div className="settings-item">
            <span className="settings-label">Role</span>
            <span className="settings-value">{user?.role}</span>
          </div>
          <div className="settings-item">
            <span className="settings-label">User ID</span>
            <span className="settings-value">{user?.id}</span>
          </div>
          <div className="settings-item">
            <span className="settings-label">Session expires in</span>
            <span className="settings-value"><SessionCountdown token={token} /></span>
          </div>
        </div>
      </div>

      {/* ── Section 3: Display Preferences ── */}
      <div className="card">
        <h3>Display Preferences</h3>
        <div className="settings-row">
          <span>Rows per page</span>
          <select
            className="settings-select"
            value={rowsPerPage}
            onChange={(e) => setRowsPerPage(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
        </div>
        <div className="settings-row">
          <span>Compact table view</span>
          <button className={`toggle-btn ${compact ? 'on' : ''}`} onClick={toggleCompact}>
            <span className="toggle-knob" />
          </button>
        </div>
      </div>

      {/* ── Section 4: Notifications ── */}
      <div className="card">
        <h3>Notifications</h3>
        <div className="settings-row">
          <span>Show notification badge</span>
          <button className={`toggle-btn ${showNotifications ? 'on' : ''}`} onClick={toggleNotifications}>
            <span className="toggle-knob" />
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
