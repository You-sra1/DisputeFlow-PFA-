import { useAuth } from '../context/AuthContext';

export default function Topbar({ breadcrumb = 'Home > Dashboard', notifCount = 0, showMenuIcon = false }) {
  const { user } = useAuth();
  const initials = (user?.name || '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="topbar">
      <div className="breadcrumb">
        {showMenuIcon && <span className="menu-icon">☰</span>}
        {breadcrumb}
      </div>
      <div className="topbar-right">
        <div className="notif-bell">
          🔔
          {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
        </div>
        <div className="user-menu">
          <div className="avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-role">{user?.role === 'OPERATOR' ? 'Operator' : 'Client'}</div>
          </div>
          <span className="chevron">▾</span>
        </div>
      </div>
    </header>
  );
}
