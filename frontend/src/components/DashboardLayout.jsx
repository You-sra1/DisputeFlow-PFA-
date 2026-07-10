import Sidebar from './Sidebar';
import Topbar from './Topbar';

export default function DashboardLayout({ breadcrumb, notifCount = 0, showMenuIcon = false, children }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="main-area">
        <Topbar breadcrumb={breadcrumb} notifCount={notifCount} showMenuIcon={showMenuIcon} />
        <div className="page-content">{children}</div>
        <footer className="app-footer">
          © {new Date().getFullYear()} SecureBank. <a href="#!">Privacy Policy</a> · <a href="#!">Terms of Service</a>
        </footer>
      </div>
    </div>
  );
}
