import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <DashboardLayout breadcrumb="Home > Profile">
      <h1>Profile</h1>

      <div className="card">
        <div className="profile-field">
          <label className="profile-label">Name</label>
          <p className="profile-value">{user?.name}</p>
        </div>

        <div className="profile-field">
          <label className="profile-label">Email</label>
          <p className="profile-value">{user?.email}</p>
        </div>

        <div className="profile-field">
          <label className="profile-label">Role</label>
          <p className="profile-value">{user?.role}</p>
        </div>

        <div className="profile-field">
          <label className="profile-label">User ID</label>
          <p className="profile-value">{user?.id}</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
