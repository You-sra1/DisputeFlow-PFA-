// ============================================================================
// DisputeDetail.jsx — Détail complet d'un litige.
//
// Affiche : les informations de base, l'historique des statuts
// (dispute_status_history), les commentaires (dispute_comments), les
// pièces justificatives (dispute_documents, cliquables pour être ouvertes),
// et selon le rôle :
//   - OPERATOR : les boutons d'action disponibles pour le statut courant
//     (review, request-info, approve, reject, chargeback, refund, close)
//   - CLIENT : lecture seule, sauf un champ de réponse si le statut est
//     EN_ATTENTE_D_INFORMATIONS
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { Loading, ErrorBanner, SuccessBanner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { REASON_LABELS } from '../constants';

export default function DisputeDetail() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const isOperator = user.role === 'OPERATOR';

  const [dispute, setDispute] = useState(null);
  const [history, setHistory] = useState([]);
  const [comments, setComments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Toutes les listes de litiges accessibles au rôle courant, on retrouve
      // celui qui nous intéresse pour disposer de ses champs (montant, reason...).
      const all = await api.getDisputes(token, user.id, { status: 'ALL' });
      const found = all.find((d) => d.dispute_id === id);
      setDispute(found || { dispute_id: id });

      const [h, c, docs] = await Promise.all([
        api.getDisputeHistory(token, id),
        api.getDisputeComments(token, id),
        api.getDisputeDocuments(token, id),
      ]);
      setHistory(h);
      setComments(c);
      setDocuments(docs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id, token, user.id]);

  useEffect(() => { load(); }, [load]);

  async function handleOpenDocument(documentId) {
    try {
      const doc = await api.getDocumentContent(token, documentId);
      const byteChars = atob(doc.file_content);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const blob = new Blob([new Uint8Array(byteNumbers)], { type: doc.file_type });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      setError(err.message);
    }
  }

  async function runAction(actionFn) {
    setActionLoading(true);
    setError('');
    setSuccess('');
    try {
      await actionFn();
      setSuccess('Action completed successfully.');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <Layout role={user.role} breadcrumb={breadcrumbFor(isOperator, id)}>
        <Loading />
      </Layout>
    );
  }

  return (
    <Layout role={user.role} breadcrumb={breadcrumbFor(isOperator, id)}>
      <div className="page-header">
        <h1>Dispute {id}</h1>
      </div>

      <ErrorBanner message={error} />
      <SuccessBanner message={success} />

      <div className="content-card">
        <div className="detail-grid">
          <DetailRow label="Transaction" value={dispute?.transaction_id} />
          <DetailRow label="Reason" value={REASON_LABELS[dispute?.reason] || dispute?.reason} />
          <DetailRow label="Amount" value={dispute ? `${dispute.amount} ${dispute.currency}` : '—'} />
          <DetailRow label="Status" value={<StatusBadge status={dispute?.status} />} />
          <DetailRow label="Description" value={dispute?.description} />
          <DetailRow label="Created" value={dispute?.created_at} />
        </div>
      </div>

      <div className="content-card">
        <h2>Status History</h2>
        {history.length === 0 ? (
          <p className="empty-state">No history yet.</p>
        ) : (
          <ul className="history-list">
            {history.map((h) => (
              <li key={h.id}>
                <strong>{h.old_status || 'Created'} → {h.new_status}</strong>
                <span className="history-meta"> · {h.changed_by} · {h.created_at}</span>
                {h.reason && <div className="history-comment">{h.reason}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="content-card">
        <h2>Comments</h2>
        {comments.length === 0 ? (
          <p className="empty-state">No comments yet.</p>
        ) : (
          <ul className="comment-list">
            {comments.map((c) => (
              <li key={c.id}>
                <strong>{c.client_id}</strong>
                <span className="history-meta"> · {c.created_at}</span>
                <div>{c.comment}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="content-card">
        <h2>Supporting Documents</h2>
        {documents.length === 0 ? (
          <p className="empty-state">No documents attached.</p>
        ) : (
          <ul className="document-list">
            {documents.map((d) => (
              <li key={d.id}>
                <button type="button" className="document-item" onClick={() => handleOpenDocument(d.id)}>
                  <span className="document-icon">📄</span>
                  <span>
                    <div className="document-name">{d.file_name}</div>
                    <div className="document-meta">{d.file_type} · {d.file_size ? `${(d.file_size / 1024).toFixed(1)} KB` : ''}</div>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!isOperator && dispute?.status === 'EN_ATTENTE_D_INFORMATIONS' && (
        <ClientResponseForm
          disabled={actionLoading}
          onSubmit={(message) => runAction(() => api.respondToDispute(token, user.id, id, message))}
        />
      )}

      {isOperator && (
        <OperatorActions
          status={dispute?.status}
          disabled={actionLoading}
          onReview={(comment) => runAction(() => api.reviewDispute(token, user.id, id, comment))}
          onRequestInfo={(message) => runAction(() => api.requestDisputeInfo(token, user.id, id, message))}
          onApprove={(comment) => runAction(() => api.approveDispute(token, user.id, id, comment))}
          onReject={(reason, comment) => runAction(() => api.rejectDispute(token, user.id, id, reason, comment))}
          onChargeback={(payload) => runAction(() => api.initiateChargeback(token, user.id, id, payload))}
          onRefund={(payload) => runAction(() => api.processRefund(token, user.id, id, payload))}
          onClose={(payload) => runAction(() => api.closeDispute(token, user.id, id, payload))}
        />
      )}
    </Layout>
  );
}

function breadcrumbFor(isOperator, id) {
  return isOperator
    ? [{ label: 'Home', to: '/operator/dashboard' }, { label: 'Disputes', to: '/operator/disputes' }, { label: id }]
    : [{ label: 'Home', to: '/dashboard' }, { label: 'Disputes', to: '/disputes' }, { label: id }];
}

function DetailRow({ label, value }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}:</span>
      <span className="detail-value">{value ?? '—'}</span>
    </div>
  );
}

/** Formulaire de réponse du client à une demande d'informations. */
function ClientResponseForm({ onSubmit, disabled }) {
  const [message, setMessage] = useState('');
  return (
    <div className="content-card">
      <h2>Respond to Information Request</h2>
      <textarea
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Write your response to the operator's request..."
      />
      <button
        type="button"
        className="btn-primary"
        disabled={disabled || !message.trim()}
        onClick={() => { onSubmit(message); setMessage(''); }}
      >
        Submit Response
      </button>
    </div>
  );
}

/** Panneau d'actions opérateur, dont le contenu dépend du statut courant. */
function OperatorActions({ status, disabled, onReview, onRequestInfo, onApprove, onReject, onChargeback, onRefund, onClose }) {
  const [comment, setComment] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [chargebackReasonCode, setChargebackReasonCode] = useState('');
  const [network, setNetwork] = useState('Visa');
  const [refundAmount, setRefundAmount] = useState('');
  const [refundCurrency, setRefundCurrency] = useState('USD');
  const [refundMethod, setRefundMethod] = useState('CARD_CREDIT');
  const [closureReason, setClosureReason] = useState('CASE_RESOLVED');

  if (status === 'CLOTURE') {
    return (
      <div className="content-card">
        <h2>Actions</h2>
        <p className="empty-state">This dispute is closed. No further action is possible.</p>
      </div>
    );
  }

  return (
    <div className="content-card">
      <h2>Actions</h2>
      <label className="form-field">
        <span>Comment</span>
        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>

      <div className="action-buttons">
        {status === 'SOUMIS' && (
          <button className="btn-primary" disabled={disabled} onClick={() => onReview(comment)}>
            Take in Review
          </button>
        )}

        {(status === 'EN_COURS_D_ANALYSE' || status === 'EN_ATTENTE_D_INFORMATIONS') && (
          <>
            {status === 'EN_COURS_D_ANALYSE' && (
              <button className="btn-secondary" disabled={disabled} onClick={() => onRequestInfo(comment)}>
                Request Info
              </button>
            )}
            <button className="btn-primary" disabled={disabled} onClick={() => onApprove(comment)}>
              Approve
            </button>
            <div className="inline-form">
              <input
                type="text"
                placeholder="Rejection reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <button className="btn-danger" disabled={disabled || !rejectReason} onClick={() => onReject(rejectReason, comment)}>
                Reject
              </button>
            </div>
          </>
        )}

        {status === 'APPROUVE' && (
          <div className="inline-form">
            <input type="text" placeholder="Reason code (e.g. 4837)" value={chargebackReasonCode} onChange={(e) => setChargebackReasonCode(e.target.value)} />
            <select value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="Visa">Visa</option>
              <option value="Mastercard">Mastercard</option>
            </select>
            <button
              className="btn-primary"
              disabled={disabled || !chargebackReasonCode}
              onClick={() => onChargeback({ chargebackReasonCode, network, comment })}
            >
              Initiate Chargeback
            </button>
          </div>
        )}

        {status === 'CHARGEBACK_INITIE' && (
          <div className="inline-form">
            <input type="number" step="0.01" placeholder="Refund amount" value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} />
            <input type="text" placeholder="Currency" value={refundCurrency} onChange={(e) => setRefundCurrency(e.target.value)} />
            <select value={refundMethod} onChange={(e) => setRefundMethod(e.target.value)}>
              <option value="CARD_CREDIT">Card Credit</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
            </select>
            <button
              className="btn-primary"
              disabled={disabled || !refundAmount}
              onClick={() => onRefund({ refundAmount: Number(refundAmount), currency: refundCurrency, refundMethod })}
            >
              Process Refund
            </button>
          </div>
        )}

        {(status === 'REJETE' || status === 'REMBOURSEMENT_EFFECTUE') && (
          <div className="inline-form">
            <select value={closureReason} onChange={(e) => setClosureReason(e.target.value)}>
              <option value="CASE_RESOLVED">Case Resolved</option>
              <option value="REJECTED_FINAL">Rejected Final</option>
              <option value="REFUND_ISSUED">Refund Issued</option>
              <option value="OTHER">Other</option>
            </select>
            <button className="btn-primary" disabled={disabled} onClick={() => onClose({ closureReason, comment })}>
              Close Dispute
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
