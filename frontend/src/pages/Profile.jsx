import { useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { profileAPI } from '../api';

export default function Profile() {
  const { user, token, setUser } = useAuth();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState(null);

  async function handleSaveProfile(e) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const updated = await profileAPI.update(token, user.id, { name: name.trim(), email: email.trim() });
      setUser(updated);
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: err?.errorDescription || 'Update failed.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    if (newPwd !== confirmPwd) {
      setPwdMsg({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    setSavingPwd(true);
    setPwdMsg(null);
    try {
      await profileAPI.changePassword(token, user.id, { currentPassword: currentPwd, newPassword: newPwd });
      setPwdMsg({ type: 'success', text: 'Password changed successfully.' });
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
    } catch (err) {
      setPwdMsg({ type: 'error', text: err?.errorDescription || 'Password change failed.' });
    } finally {
      setSavingPwd(false);
    }
  }

  return (
    <DashboardLayout breadcrumb="Home > Profile">
      <h1>Profile</h1>

      {/* ── Informations personnelles ── */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Personal Information</h3>
        <form onSubmit={handleSaveProfile}>
          <div className="form-group">
            <label className="form-label">User ID</label>
            <input className="form-input" value={user?.id || ''} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <input className="form-input" value={user?.role || ''} disabled />
          </div>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input
              className="form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {msg && (
            <div className={`alert alert-${msg.type}`} style={{ marginBottom: '1rem' }}>
              {msg.text}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </div>

      {/* ── Changement de mot de passe ── */}
      <div className="card">
        <h3 style={{ marginBottom: '1rem' }}>Change Password</h3>
        <form onSubmit={handleChangePassword}>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <input
              className="form-input"
              type="password"
              value={currentPwd}
              onChange={(e) => setCurrentPwd(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <input
              className="form-input"
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              className="form-input"
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              required
            />
          </div>

          {pwdMsg && (
            <div className={`alert alert-${pwdMsg.type}`} style={{ marginBottom: '1rem' }}>
              {pwdMsg.text}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={savingPwd}
          >
            {savingPwd ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
