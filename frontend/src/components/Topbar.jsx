import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferencesContext';

const MOCK_NOTIFICATIONS = [
  { id: 1, text: 'New dispute DSP001 submitted by Alice Martin', time: '2 min ago', read: false },
  { id: 2, text: 'DSP003 is waiting for information', time: '15 min ago', read: false },
  { id: 3, text: 'DSP005 has been rejected', time: '1 hour ago', read: false },
  { id: 4, text: 'DSP008 refund completed', time: '3 hours ago', read: true },
  { id: 5, text: 'New dispute DSP006 submitted', time: '5 hours ago', read: true },
];

export default function Topbar({ breadcrumb = 'Home > Dashboard', showMenuIcon = false }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, showNotifications } = usePreferences();
  const navigate = useNavigate();

  const [profileOpen, setProfileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const profileRef = useRef(null);
  const notifRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const initials = (user?.name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function markAllRead() {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleLogout() {
    setProfileOpen(false);
    logout();
  }

  return (
    <header className="topbar">
      <div className="breadcrumb">
        {showMenuIcon && <span className="menu-icon">☰</span>}
        {breadcrumb}
      </div>
      <div className="topbar-right">
        {/* ── Theme toggle ── */}
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* ── Notification bell ── */}
        {showNotifications && (
          <div className="notif-menu" ref={notifRef}>
            <button
              className="notif-bell-btn"
              onClick={() => setNotifOpen((v) => !v)}
              aria-label="Notifications"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
            </button>
            {notifOpen && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span>Notifications</span>
                  {unreadCount > 0 && (
                    <button className="notif-mark-read" onClick={markAllRead}>Mark all read</button>
                  )}
                </div>
                <div className="notif-list">
                  {notifications.map((n) => (
                    <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                      <div className="notif-text">{n.text}</div>
                      <div className="notif-time">{n.time}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── User profile menu ── */}
        <div className="user-menu" ref={profileRef}>
          <button
            className="user-menu-btn"
            onClick={() => setProfileOpen((v) => !v)}
            aria-label="User menu"
          >
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role === 'OPERATOR' ? 'Operator' : 'Client'}</div>
            </div>
            <span className="chevron">▾</span>
          </button>
          {profileOpen && (
            <div className="profile-dropdown">
              <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/profile'); }}>
                Profile
              </button>
              {user?.role === 'OPERATOR' && (
                <button className="profile-dropdown-item" onClick={() => { setProfileOpen(false); navigate('/settings'); }}>
                  Settings
                </button>
              )}
              <div className="profile-dropdown-divider" />
              <button className="profile-dropdown-item profile-dropdown-logout" onClick={handleLogout}>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
