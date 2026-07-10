import DashboardLayout from '../components/DashboardLayout';

export default function Settings() {
  return (
    <DashboardLayout breadcrumb="Home / Settings" showMenuIcon>
      <h1>Settings</h1>
      <div className="card">
        <p>Cette page reste à définir selon vos besoins (préférences de notification, sécurité, etc.).</p>
      </div>
    </DashboardLayout>
  );
}
