// ============================================================================
// App.jsx — Déclare toutes les routes de l'application et protège l'accès
// selon le rôle (CLIENT / OPERATOR) via ProtectedRoute.
// ============================================================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';

import Login from './pages/Login';
import ClientDashboard from './pages/ClientDashboard';
import ClientTransactions from './pages/ClientTransactions';
import ClientDisputes from './pages/ClientDisputes';
import CreateDispute from './pages/CreateDispute';
import DisputeDetail from './pages/DisputeDetail';
import OperatorDashboard from './pages/OperatorDashboard';
import OperatorDisputes from './pages/OperatorDisputes';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Settings from './pages/Settings';

import './App.css';

/** Redirige "/" vers le bon dashboard selon le rôle, ou vers /login si non connecté. */
function RootRedirect() {
  const { isAuthenticated, user, initializing } = useAuth();
  if (initializing) return <div className="loading-state">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Navigate to={user.role === 'OPERATOR' ? '/operator/dashboard' : '/dashboard'} replace />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />

            {/* Espace CLIENT */}
            <Route path="/dashboard" element={
              <ProtectedRoute allowedRoles={['CLIENT']}><ClientDashboard /></ProtectedRoute>
            } />
            <Route path="/transactions" element={
              <ProtectedRoute allowedRoles={['CLIENT']}><ClientTransactions /></ProtectedRoute>
            } />
            <Route path="/disputes" element={
              <ProtectedRoute allowedRoles={['CLIENT']}><ClientDisputes /></ProtectedRoute>
            } />
            <Route path="/disputes/new" element={
              <ProtectedRoute allowedRoles={['CLIENT']}><CreateDispute /></ProtectedRoute>
            } />
            <Route path="/disputes/:id" element={
              <ProtectedRoute allowedRoles={['CLIENT']}><DisputeDetail /></ProtectedRoute>
            } />

            {/* Espace OPERATOR */}
            <Route path="/operator/dashboard" element={
              <ProtectedRoute allowedRoles={['OPERATOR']}><OperatorDashboard /></ProtectedRoute>
            } />
            <Route path="/operator/disputes" element={
              <ProtectedRoute allowedRoles={['OPERATOR']}><OperatorDisputes /></ProtectedRoute>
            } />
            <Route path="/operator/disputes/:id" element={
              <ProtectedRoute allowedRoles={['OPERATOR']}><DisputeDetail /></ProtectedRoute>
            } />
            <Route path="/operator/analytics" element={
              <ProtectedRoute allowedRoles={['OPERATOR']}><Analytics /></ProtectedRoute>
            } />

            {/* Pages communes aux deux rôles */}
            <Route path="/profile" element={
              <ProtectedRoute allowedRoles={['CLIENT', 'OPERATOR']}><Profile /></ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute allowedRoles={['OPERATOR']}><Settings /></ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
