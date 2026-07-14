import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PreferencesProvider } from './context/PreferencesContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import ClientDashboard from './pages/ClientDashboard';
import OperatorDashboard from './pages/OperatorDashboard';
import ClientTransactions from './pages/ClientTransactions';
import ClientDisputes from './pages/ClientDisputes';
import OperatorDisputes from './pages/OperatorDisputes';
import NewDispute from './pages/NewDispute';
import DisputeDetails from './pages/DisputeDetails';
import Profile from './pages/Profile';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import './App.css';

// Ces deux composants choisissent la bonne page selon le rôle connecté,
// pour garder une seule route /dashboard et /disputes dans le menu.
function RoleDashboard() {
  const { user } = useAuth();
  return user?.role === 'OPERATOR' ? <OperatorDashboard /> : <ClientDashboard />;
}

function RoleDisputes() {
  const { user } = useAuth();
  return user?.role === 'OPERATOR' ? <OperatorDisputes /> : <ClientDisputes />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route path="/dashboard" element={<ProtectedRoute><RoleDashboard /></ProtectedRoute>} />
      <Route path="/disputes" element={<ProtectedRoute><RoleDisputes /></ProtectedRoute>} />
      <Route path="/disputes/new" element={<ProtectedRoute allowedRoles={['CLIENT']}><NewDispute /></ProtectedRoute>} />
      <Route path="/disputes/:disputeId" element={<ProtectedRoute><DisputeDetails /></ProtectedRoute>} />

      <Route path="/transactions" element={<ProtectedRoute allowedRoles={['CLIENT']}><ClientTransactions /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

      <Route path="/analytics" element={<ProtectedRoute allowedRoles={['OPERATOR']}><Analytics /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={['OPERATOR']}><Settings /></ProtectedRoute>} />

      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <PreferencesProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </PreferencesProvider>
    </BrowserRouter>
  );
}
