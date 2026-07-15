// ============================================================================
// api.js — Couche unique de communication avec le backend Express.
//
// Rôle de ce fichier :
//   - Centraliser TOUS les appels HTTP vers le backend (aucun composant ne
//     doit appeler fetch() directement, il doit passer par une fonction d'ici).
//   - Générer automatiquement le bloc "requestInfo" (requestUID, requestDate,
//     userID) attendu par CHAQUE endpoint du cahier des charges, pour ne pas
//     avoir à le répéter dans chaque page.
//   - Attacher automatiquement le header Authorization: Bearer <token> sur
//     les routes protégées.
//   - Normaliser la gestion des erreurs : chaque fonction lève une Error
//     JavaScript dont le message est le errorDescription renvoyé par le
//     backend, et qui porte aussi le errorCode / statusCode d'origine pour
//     un traitement plus fin si besoin (ex: redirection sur 401).
// ============================================================================

import { v4 as uuidv4 } from 'uuid';

// URL de base du backend. Configurable via VITE_API_URL (.env), avec un
// repli sur localhost:5000 si la variable n'est pas définie.
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/**
 * Construit le bloc "requestInfo" attendu par le backend sur chaque requête,
 * conformément au format exact du cahier des charges.
 * @param {string} userID - l'identifiant de l'utilisateur courant (ou "anonymous")
 */
function buildRequestInfo(userID = 'anonymous') {
  return {
    requestUID: uuidv4(),
    requestDate: new Date().toISOString(),
    userID,
  };
}

/**
 * Fonction bas-niveau qui exécute un appel HTTP vers le backend et
 * uniformise la gestion des erreurs.
 *
 * @param {string} path - chemin relatif de l'API, ex: "/login"
 * @param {object} options - options fetch (method, body, token...)
 */
async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    // Le backend est injoignable (arrêté, mauvaise URL, CORS bloqué, etc.)
    const err = new Error(
      'Impossible de contacter le serveur. Vérifiez que le backend est démarré sur le port 5000.'
    );
    err.isNetworkError = true;
    throw err;
  }

  let json;
  try {
    json = await response.json();
  } catch (parseError) {
    const err = new Error('Réponse du serveur invalide (JSON illisible).');
    err.statusCode = response.status;
    throw err;
  }

  // Le backend renvoie toujours la même enveloppe :
  // { responseUID, resultID, errorCode, errorDescription, data }
  if (json.resultID !== 'ProceedWithSuccess') {
    const err = new Error(json.errorDescription || 'Une erreur est survenue.');
    err.errorCode = json.errorCode;
    err.statusCode = response.status;
    throw err;
  }

  return json.data;
}

// ============================================================================
// AUTHENTIFICATION & PROFIL
// ============================================================================

/** POST /login — connexion, renvoie { token, user } */
export function login(email, password) {
  return request('/login', {
    method: 'POST',
    body: { requestInfo: buildRequestInfo(), email, password },
  });
}

/** GET /me — informations du profil courant */
export function getMe(token) {
  return request('/me', { token });
}

/** PUT /me — mise à jour du profil (name, email) */
export function updateMe(token, userID, { name, email }) {
  return request('/me', {
    method: 'PUT',
    token,
    body: { requestInfo: buildRequestInfo(userID), name, email },
  });
}

// ============================================================================
// CARTES & TRANSACTIONS
// ============================================================================

/** GET /cards — cartes du client authentifié */
export function getCards(token, userID) {
  return request('/cards', { token });
}

/**
 * GET /transactions — historique des transactions du client.
 * @param {object} filters - { cardNumber, startDate, endDate } (tous optionnels sauf cardNumber selon le backend)
 */
export function getTransactions(token, userID, filters = {}) {
  const params = new URLSearchParams();
  if (filters.cardNumber) params.set('cardNumber', filters.cardNumber);
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  const query = params.toString() ? `?${params.toString()}` : '';
  return request(`/transactions${query}`, { token });
}

/** GET /transactions/:id — détail d'une transaction */
export function getTransactionById(token, id) {
  return request(`/transactions/${id}`, { token });
}

// ============================================================================
// LITIGES — CRÉATION & CONSULTATION
// ============================================================================

/** POST /disputes — déclaration d'un litige par le client */
export function createDispute(token, userID, { transactionId, reason, description, claimAmount, currency }) {
  return request('/disputes', {
    method: 'POST',
    token,
    body: {
      requestInfo: buildRequestInfo(userID),
      transactionId,
      reason,
      description,
      claimAmount,
      currency,
    },
  });
}

/**
 * GET /disputes — liste des litiges (CLIENT : les siens / OPERATOR : tous).
 * @param {object} filters - { status, startDate, endDate }
 */
export function getDisputes(token, userID, filters = {}) {
  const params = new URLSearchParams();
  params.set('status', filters.status || 'ALL');
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  return request(`/disputes?${params.toString()}`, { token });
}

/** GET /disputes/:id/history — historique des changements de statut */
export function getDisputeHistory(token, disputeId) {
  return request(`/disputes/${disputeId}/history`, { token });
}

/** GET /disputes/:id/comments — commentaires liés au litige */
export function getDisputeComments(token, disputeId) {
  return request(`/disputes/${disputeId}/comments`, { token });
}

/** GET /disputes/:id/documents — pièces justificatives du litige */
export function getDisputeDocuments(token, disputeId) {
  return request(`/disputes/${disputeId}/documents`, { token });
}

/** POST /disputes/:id/documents — ajout d'une pièce justificative (base64) */
export function uploadDisputeDocument(token, userID, disputeId, { fileName, fileType, fileContent }) {
  return request(`/disputes/${disputeId}/documents`, {
    method: 'POST',
    token,
    body: { requestInfo: buildRequestInfo(userID), fileName, fileType, fileContent },
  });
}

/** GET /disputes/documents/:documentId — contenu d'un document précis */
export function getDocumentContent(token, documentId) {
  return request(`/disputes/documents/${documentId}`, { token });
}

/** PUT /disputes/:id/respond — réponse du client à une demande d'informations */
export function respondToDispute(token, userID, disputeId, message) {
  return request(`/disputes/${disputeId}/respond`, {
    method: 'PUT',
    token,
    body: { requestInfo: buildRequestInfo(userID), comment: message },
  });
}

// ============================================================================
// LITIGES — WORKFLOW OPÉRATEUR
// ============================================================================

/** PUT /review/:id — prise en charge (SOUMIS → EN_COURS_D_ANALYSE) */
export function reviewDispute(token, userID, disputeId, comment) {
  return request(`/review/${disputeId}`, {
    method: 'PUT',
    token,
    body: { requestInfo: buildRequestInfo(userID), comment },
  });
}

/** PUT /request-info/:id — demande d'informations (EN_COURS_D_ANALYSE → EN_ATTENTE_D_INFORMATIONS) */
export function requestDisputeInfo(token, userID, disputeId, message) {
  return request(`/request-info/${disputeId}`, {
    method: 'PUT',
    token,
    body: { requestInfo: buildRequestInfo(userID), message },
  });
}

/** PUT /approve/:id — approbation (EN_COURS_D_ANALYSE/EN_ATTENTE → APPROUVE) */
export function approveDispute(token, userID, disputeId, comment) {
  return request(`/approve/${disputeId}`, {
    method: 'PUT',
    token,
    body: { requestInfo: buildRequestInfo(userID), comment },
  });
}

/** PUT /reject/:id — rejet (EN_COURS_D_ANALYSE/EN_ATTENTE → REJETE) */
export function rejectDispute(token, userID, disputeId, reason, comment) {
  return request(`/reject/${disputeId}`, {
    method: 'PUT',
    token,
    body: { requestInfo: buildRequestInfo(userID), reason, comment },
  });
}

/** PUT /chargeback/:id — initiation chargeback (APPROUVE → CHARGEBACK_INITIE) */
export function initiateChargeback(token, userID, disputeId, { chargebackReasonCode, network, comment }) {
  return request(`/chargeback/${disputeId}`, {
    method: 'PUT',
    token,
    body: { requestInfo: buildRequestInfo(userID), chargebackReasonCode, network, comment },
  });
}

/** PUT /refund/:id — remboursement (CHARGEBACK_INITIE → REMBOURSEMENT_EFFECTUE) */
export function processRefund(token, userID, disputeId, { refundAmount, currency, refundMethod }) {
  return request(`/refund/${disputeId}`, {
    method: 'PUT',
    token,
    body: { requestInfo: buildRequestInfo(userID), refundAmount, currency, refundMethod },
  });
}

/** PUT /close/:id — clôture (REJETE/REMBOURSEMENT_EFFECTUE → CLOTURE) */
export function closeDispute(token, userID, disputeId, { closureReason, comment }) {
  return request(`/close/${disputeId}`, {
    method: 'PUT',
    token,
    body: { requestInfo: buildRequestInfo(userID), closureReason, comment },
  });
}

// ============================================================================
// DASHBOARD (statistiques opérateur)
// ============================================================================

/** GET /dashboard/stats — indicateurs globaux */
export function getDashboardStats(token) {
  return request('/dashboard/stats', { token });
}

/** GET /dashboard/status-distribution — répartition des litiges par statut */
export function getStatusDistribution(token) {
  return request('/dashboard/status-distribution', { token });
}

/** GET /dashboard/reason-distribution — répartition des litiges par motif */
export function getReasonDistribution(token) {
  return request('/dashboard/reason-distribution', { token });
}

/** GET /dashboard/merchant-disputes — litiges par marchand */
export function getMerchantDisputes(token) {
  return request('/dashboard/merchant-disputes', { token });
}

/** GET /dashboard/avg-processing-time — délais moyens de traitement */
export function getAvgProcessingTime(token) {
  return request('/dashboard/avg-processing-time', { token });
}

/** GET /dashboard/monthly-trends — tendances mensuelles */
export function getMonthlyTrends(token) {
  return request('/dashboard/monthly-trends', { token });
}
