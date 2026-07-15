// ============================================================================
// Profile.jsx — Affiche les informations du compte connecté, avec un
// véritable bouton d'édition : les modifications sont envoyées à PUT /me,
// persistées en base, et reflétées immédiatement dans le header (AuthContext).
// ============================================================================

import { useState } from 'react';
import Layout from '../components/Layout';
import { ErrorBanner, SuccessBanner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';

export default function Profile() {
  const { token, user, updateUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.nom);
  const [email, setEmail] = useState(user.email);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setName(user.nom);
    setEmail(user.email);
    setError('');
    setSuccess('');
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setError('');
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const updated = await api.updateMe(token, user.id, { name, email });
      updateUser(updated);
      setSuccess('Profile updated successfully.');
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Layout role={user.role} breadcrumb={[{ label: 'Home', to: user.role === 'OPERATOR' ? '/operator/dashboard' : '/dashboard' }, { label: 'Profile' }]}>
      <div className="page-header">
        <h1>Profile</h1>
        {!editing && (
          <button type="button" className="btn-secondary" onClick={startEditing}>Edit</button>
        )}
      </div>

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="content-card">
        {editing ? (
          <div className="dispute-form">
            <label className="form-field">
              <span>Name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="form-field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <div className="action-buttons">
              <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button type="button" className="btn-secondary" onClick={cancelEditing} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="detail-grid">
            <div className="detail-row"><span className="detail-label">Name:</span><span className="detail-value">{user.nom}</span></div>
            <div className="detail-row"><span className="detail-label">Email:</span><span className="detail-value">{user.email}</span></div>
            <div className="detail-row"><span className="detail-label">Role:</span><span className="detail-value">{user.role}</span></div>
            <div className="detail-row"><span className="detail-label">User ID:</span><span className="detail-value">{user.id}</span></div>
          </div>
        )}
      </div>
    </Layout>
  );
}
