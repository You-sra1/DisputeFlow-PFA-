// ============================================================================
// Login.jsx — Page de connexion. Appelle POST /login via le contexte
// d'authentification, puis redirige vers le bon dashboard selon le rôle
// renvoyé par le backend (CLIENT -> /dashboard, OPERATOR -> /operator/dashboard).
// ============================================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ErrorBanner } from '../components/Feedback';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password);
      navigate(user.role === 'OPERATOR' ? '/operator/dashboard' : '/dashboard', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="sidebar-logo auth-logo">🛡️</div>
          <div>
            <div className="auth-title">SecureBank</div>
            <div className="auth-subtitle">Dispute Portal</div>
          </div>
        </div>

        <h1 className="auth-heading">Sign in to your account</h1>

        <ErrorBanner message={error} />

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client001@example.com"
              required
            />
          </label>

          <label className="form-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          <button type="submit" className="btn-primary btn-block" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p className="auth-hint">
          Demo accounts — Client: client001@example.com · Operator: operator@example.com
          (password: Password123)
        </p>
      </div>
    </div>
  );
}
