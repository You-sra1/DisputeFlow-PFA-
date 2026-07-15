// ============================================================================
// ProtectedRoute.jsx — Garde d'accès aux routes de l'application.
//
// Règles appliquées :
//   - Si aucun utilisateur n'est authentifié -> redirection vers /login.
//   - Si la route exige un rôle précis (allowedRoles) et que le rôle de
//     l'utilisateur ne correspond pas -> redirection vers son propre
//     dashboard (jamais un simple blocage silencieux : on le ramène à un
//     endroit cohérent avec son rôle).
// ============================================================================

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { isAuthenticated, user, initializing } = useAuth();

  if (initializing) {
    return <div className="loading-state">Loading session...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const fallback = user.role === 'OPERATOR' ? '/operator/dashboard' : '/dashboard';
    return <Navigate to={fallback} replace />;
  }

  return children;
}
