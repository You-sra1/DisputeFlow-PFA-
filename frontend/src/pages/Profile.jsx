import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <DashboardLayout breadcrumb="Home > Profile">
      <h1>Profile</h1>
      <div className="card">
        <p><strong>Name:</strong> {user?.name}</p>
        <p><strong>Email:</strong> {user?.email}</p>
        <p><strong>Role:</strong> {user?.role}</p>
        <p><strong>User ID:</strong> {user?.id}</p>
      </div>
    </DashboardLayout>
  );
}
