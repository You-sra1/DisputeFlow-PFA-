// ============================================================================
// CreateDispute.jsx — Formulaire de déclaration d'un litige (POST /disputes),
// avec sélection réelle de la transaction (GET /transactions), motif parmi
// les 9 valeurs exactes du cahier des charges, et upload optionnel de
// pièces justificatives ajoutées juste après la création du litige.
// ============================================================================

import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Layout from '../components/Layout';
import { ErrorBanner } from '../components/Feedback';
import { useAuth } from '../context/AuthContext';
import * as api from '../api';
import { DISPUTE_REASONS } from '../constants';

/** Convertit un fichier sélectionné en chaîne base64, pour l'envoyer au backend. */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]); // retire le préfixe data:...;base64,
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function CreateDispute() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const preselectedTransactionId = location.state?.transactionId || '';

  const [transactions, setTransactions] = useState([]);
  const [transactionId, setTransactionId] = useState(preselectedTransactionId);
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [claimAmount, setClaimAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [files, setFiles] = useState([]);

  const [error, setError] = useState('');
  const [uploadWarning, setUploadWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api.getTransactions(token, user.id, {}).then((data) => {
      if (!cancelled) setTransactions(data);
    }).catch((err) => setError(err.message));
    return () => { cancelled = true; };
  }, [token, user.id]);

  // Pré-remplit automatiquement le montant/devise quand une transaction est choisie.
  function handleTransactionChange(id) {
    setTransactionId(id);
    const txn = transactions.find((t) => t.transaction_id === id);
    if (txn) {
      setClaimAmount(String(txn.amount));
      setCurrency(txn.currency);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setUploadWarning('');
    setSubmitting(true);

    try {
      const result = await api.createDispute(token, user.id, {
        transactionId,
        reason,
        description,
        claimAmount: Number(claimAmount),
        currency,
      });

      // Upload des pièces jointes (best-effort : un échec n'annule pas le litige créé).
      const failedFiles = [];
      for (const file of files) {
        try {
          const content = await readFileAsBase64(file);
          await api.uploadDisputeDocument(token, user.id, result.dispute_id, {
            fileName: file.name,
            fileType: file.type || 'application/octet-stream',
            fileContent: content,
          });
        } catch {
          failedFiles.push(file.name);
        }
      }

      if (failedFiles.length > 0) {
        setUploadWarning(
          `Dispute created, but the following file(s) could not be uploaded: ${failedFiles.join(', ')}. You can retry from the dispute detail page.`
        );
        // On laisse un court instant pour lire l'avertissement avant de rediriger.
        setTimeout(() => navigate(`/disputes/${result.dispute_id}`), 2500);
      } else {
        navigate(`/disputes/${result.dispute_id}`);
      }
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <Layout role="CLIENT" breadcrumb={[{ label: 'Home', to: '/dashboard' }, { label: 'New Dispute' }]}>
      <div className="page-header">
        <h1>New Dispute</h1>
      </div>

      <ErrorBanner message={error} />
      {uploadWarning && <div className="error-banner">{uploadWarning}</div>}

      <div className="content-card form-card">
        <form onSubmit={handleSubmit} className="dispute-form">
          <label className="form-field">
            <span>Transaction</span>
            <select
              value={transactionId}
              onChange={(e) => handleTransactionChange(e.target.value)}
              required
            >
              <option value="" disabled>Select a transaction</option>
              {transactions.map((t) => (
                <option key={t.transaction_id} value={t.transaction_id}>
                  {t.transaction_id} — {t.merchant} — {t.amount} {t.currency}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Reason</span>
            <select value={reason} onChange={(e) => setReason(e.target.value)} required>
              <option value="" disabled>Select a reason</option>
              {DISPUTE_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Explain why you are disputing this transaction..."
              required
            />
          </label>

          <div className="form-row">
            <label className="form-field">
              <span>Claim Amount</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={claimAmount}
                onChange={(e) => setClaimAmount(e.target.value)}
                required
              />
            </label>
            <label className="form-field">
              <span>Currency</span>
              <input
                type="text"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                required
              />
            </label>
          </div>

          <label className="form-field">
            <span>Supporting Documents (optional)</span>
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              onChange={(e) => setFiles(Array.from(e.target.files))}
            />
            {files.length > 0 && (
              <ul className="file-list">
                {files.map((f) => <li key={f.name}>{f.name}</li>)}
              </ul>
            )}
          </label>

          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Dispute'}
          </button>
        </form>
      </div>
    </Layout>
  );
}
