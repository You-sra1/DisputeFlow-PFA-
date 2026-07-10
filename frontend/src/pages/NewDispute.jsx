import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../context/AuthContext';
import { disputesAPI } from '../api';
import { DISPUTE_REASONS } from '../constants/statusConfig';

export default function NewDispute() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    transactionId: '',
    reason: DISPUTE_REASONS[0],
    description: '',
    claimAmount: '',
    currency: 'USD',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload = { ...form, claimAmount: parseFloat(form.claimAmount) };
      const dispute = await disputesAPI.create(token, user.id, payload);
      navigate(`/disputes/${dispute.disputeId}`);
    } catch (err) {
      setError(err.errorDescription || 'Unable to create dispute.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout breadcrumb="Home > My Disputes > New Dispute">
      <h1>New Dispute</h1>
      <form className="card form-card" onSubmit={handleSubmit}>
        <label>Transaction ID</label>
        <input
          value={form.transactionId}
          onChange={(e) => update('transactionId', e.target.value)}
          placeholder="TXN001"
          required
        />

        <label>Reason</label>
        <select value={form.reason} onChange={(e) => update('reason', e.target.value)}>
          {DISPUTE_REASONS.map((r) => (
            <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <label>Description</label>
        <textarea
          value={form.description}
          onChange={(e) => update('description', e.target.value)}
          rows={4}
          placeholder="Explain what happened..."
          required
        />

        <div className="form-row">
          <div>
            <label>Claim Amount</label>
            <input
              type="number"
              step="0.01"
              value={form.claimAmount}
              onChange={(e) => update('claimAmount', e.target.value)}
              required
            />
          </div>
          <div>
            <label>Currency</label>
            <select value={form.currency} onChange={(e) => update('currency', e.target.value)}>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="MAD">MAD</option>
            </select>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Dispute'}
        </button>
      </form>
    </DashboardLayout>
  );
}
