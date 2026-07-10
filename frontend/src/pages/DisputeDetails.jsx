import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../components/DashboardLayout';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { disputesAPI } from '../api';

// Actions disponibles pour l'opérateur selon le statut courant du litige
const OPERATOR_ACTIONS = {
  SUBMITTED: [{ label: 'Start Review', action: 'review' }],
  UNDER_REVIEW: [
    { label: 'Request Info', action: 'requestInfo' },
    { label: 'Approve', action: 'approve' },
    { label: 'Reject', action: 'reject' },
  ],
  WAITING_FOR_INFORMATION: [
    { label: 'Approve', action: 'approve' },
    { label: 'Reject', action: 'reject' },
  ],
  APPROVED: [{ label: 'Initiate Chargeback', action: 'chargeback' }],
  CHARGEBACK_INITIATED: [{ label: 'Complete Refund', action: 'refund' }],
  REJECTED: [{ label: 'Close', action: 'close' }],
  REFUND_COMPLETED: [{ label: 'Close', action: 'close' }],
};

const CLOSURE_REASONS = ['CASE_RESOLVED', 'REJECTED_FINAL', 'REFUND_ISSUED', 'OTHER'];
const NETWORKS = ['Visa', 'Mastercard'];
const REFUND_METHODS = ['CARD_CREDIT', 'BANK_TRANSFER'];

export default function DisputeDetails() {
  const { disputeId } = useParams();
  const { user, token } = useAuth();
  const [dispute, setDispute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [comment, setComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Champs spécifiques à certaines actions
  const [action, setAction] = useState(null); // action en cours de saisie
  const [rejectReason, setRejectReason] = useState('');
  const [cbReasonCode, setCbReasonCode] = useState('');
  const [network, setNetwork] = useState('Visa');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundCurrency, setRefundCurrency] = useState('USD');
  const [refundMethod, setRefundMethod] = useState('CARD_CREDIT');
  const [closureReason, setClosureReason] = useState('CASE_RESOLVED');

  useEffect(() => { load(); }, [disputeId]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const list = await disputesAPI.list(token, user.id, { status: 'ALL' });
      setDispute((list || []).find((d) => d.disputeId === disputeId) || null);
    } catch (err) {
      setError(err.errorDescription || 'Unable to load dispute.');
    } finally {
      setLoading(false);
    }
  }

  async function runAction(actionType) {
    setActionLoading(true);
    setError('');

    let body;
    switch (actionType) {
      case 'reject':
        body = { disputeId, reason: rejectReason || comment, comment };
        break;
      case 'chargeback':
        body = { disputeId, chargebackReasonCode: cbReasonCode, network, comment };
        break;
      case 'refund':
        body = { disputeId, refundAmount: parseFloat(refundAmount), currency: refundCurrency, refundMethod };
        break;
      case 'close':
        body = { disputeId, closureReason, comment };
        break;
      default:
        body = { disputeId, comment };
    }

    try {
      await disputesAPI[actionType](token, user.id, ...Object.values(body));
      await load();
      setComment('');
      setAction(null);
      resetActionFields();
    } catch (err) {
      setError(err.errorDescription || 'Action failed.');
    } finally {
      setActionLoading(false);
    }
  }

  function resetActionFields() {
    setRejectReason('');
    setCbReasonCode('');
    setNetwork('Visa');
    setRefundAmount('');
    setRefundCurrency('USD');
    setRefundMethod('CARD_CREDIT');
    setClosureReason('CASE_RESOLVED');
  }

  function selectAction(actionType) {
    setAction(actionType);
    setError('');
    resetActionFields();
  }

  function cancelAction() {
    setAction(null);
    setError('');
    resetActionFields();
  }

  function renderActionForm() {
    if (!action) return null;

    const extraFields = [];

    if (action === 'reject') {
      extraFields.push(
        <div key="reject-reason">
          <label>Reason for rejection *</label>
          <input
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. FRAUD, INCORRECT_AMOUNT..."
          />
        </div>
      );
    }

    if (action === 'chargeback') {
      extraFields.push(
        <div key="cb-code">
          <label>Chargeback Reason Code *</label>
          <input
            value={cbReasonCode}
            onChange={(e) => setCbReasonCode(e.target.value)}
            placeholder="e.g. 4837"
          />
        </div>,
        <div key="cb-network">
          <label>Network *</label>
          <select value={network} onChange={(e) => setNetwork(e.target.value)}>
            {NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
      );
    }

    if (action === 'refund') {
      extraFields.push(
        <div key="ref-amount">
          <label>Refund Amount *</label>
          <input
            type="number"
            step="0.01"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
          />
        </div>,
        <div key="ref-currency">
          <label>Currency *</label>
          <select value={refundCurrency} onChange={(e) => setRefundCurrency(e.target.value)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="MAD">MAD</option>
          </select>
        </div>,
        <div key="ref-method">
          <label>Refund Method *</label>
          <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
            {REFUND_METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      );
    }

    if (action === 'close') {
      extraFields.push(
        <div key="close-reason">
          <label>Closure Reason *</label>
          <select value={closureReason} onChange={(e) => setClosureReason(e.target.value)}>
            {CLOSURE_REASONS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      );
    }

    return (
      <div className="card action-form">
        <h4>{OPERATOR_ACTIONS[dispute.status]?.find((a) => a.action === action)?.label || action}</h4>
        {extraFields}
        <div>
          <label>Comment</label>
          <textarea
            placeholder="Optional comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
          />
        </div>
        <div className="action-buttons">
          <button className="btn-primary" disabled={actionLoading} onClick={() => runAction(action)}>
            {actionLoading ? 'Processing...' : 'Confirm'}
          </button>
          <button className="btn-secondary" disabled={actionLoading} onClick={cancelAction}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <DashboardLayout breadcrumb="Home > Disputes > Detail"><p>Loading...</p></DashboardLayout>;
  }

  if (!dispute) {
    return (
      <DashboardLayout breadcrumb="Home > Disputes > Detail">
        <p className="error-text">Dispute not found.</p>
      </DashboardLayout>
    );
  }

  const actions = user.role === 'OPERATOR' ? (OPERATOR_ACTIONS[dispute.status] || []) : [];

  return (
    <DashboardLayout breadcrumb={`Home > Disputes > ${disputeId}`}>
      <h1>Dispute {dispute.disputeId}</h1>

      <div className="card">
        <p><strong>Transaction:</strong> {dispute.transactionId}</p>
        <p><strong>Reason:</strong> {(dispute.reason || '').replace(/_/g, ' ')}</p>
        <p><strong>Amount:</strong> {dispute.claimAmount} {dispute.currency}</p>
        <p><strong>Status:</strong> <StatusBadge status={dispute.status} /></p>
        {dispute.description && <p><strong>Description:</strong> {dispute.description}</p>}
        {dispute.createdAt && <p><strong>Created:</strong> {new Date(dispute.createdAt).toLocaleString()}</p>}
      </div>

      {error && <p className="error-text">{error}</p>}

      {action ? renderActionForm() : (
        actions.length > 0 && (
          <div className="card">
            <h3>Operator Actions</h3>
            <div className="action-buttons">
              {actions.map((a) => (
                <button
                  key={a.action}
                  className="btn-primary"
                  onClick={() => selectAction(a.action)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )
      )}
    </DashboardLayout>
  );
}
