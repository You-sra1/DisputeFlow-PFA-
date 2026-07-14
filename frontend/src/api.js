const BASE_URL = `${window.location.protocol}//${window.location.hostname}:5000/api`;

// Callback branché par AuthContext pour réagir à un 401 (déconnexion + redirection)
let onUnauthorized = () => {};
export function registerUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function buildRequestInfo(userID = 'anonymous') {
  return {
    requestUID: uuid(),
    requestDate: new Date().toISOString(),
    userID,
  };
}

// Fonction générique : construit l'enveloppe requestInfo + champs spécifiques,
// envoie la requête, et déballe la réponse (ou lève l'erreur telle que renvoyée par l'API).
async function apiCall(method, path, extraBody = {}, token = null, userID = 'anonymous') {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let url = `${BASE_URL}${path}`;
  const fetchOptions = { method, headers };

  if (method === 'GET') {
    // GET → query params (fetch interdit un body avec GET)
    const entries = Object.entries(extraBody).filter(([, v]) => v !== undefined && v !== null && v !== '');
    if (entries.length > 0) {
      url += '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
    }
  } else {
    headers['Content-Type'] = 'application/json';
    fetchOptions.body = JSON.stringify({
      requestInfo: buildRequestInfo(userID),
      ...extraBody,
    });
  }

  let response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (err) {
    throw {
      errorDescription: 'Impossible de contacter le serveur. Vérifiez que le backend est démarré sur le port 5000.',
      errorCode: 'NETWORK_ERROR',
    };
  }

  const json = await response.json().catch(() => null);

  if (response.status === 401) {
    onUnauthorized();
  }

  if (!json || json.resultID !== 'ProceedWithSuccess') {
    throw json || { errorDescription: 'Erreur inconnue.', errorCode: 'UNKNOWN' };
  }

  return json.data;
}

export const authAPI = {
  login: (email, password) => apiCall('POST', '/login', { email, password }),
};

export const transactionsAPI = {
  list: (token, userID, filters = {}) => apiCall('GET', '/transactions', filters, token, userID),
};

export const cardsAPI = {
  list: (token, userID) => apiCall('GET', '/cards', {}, token, userID),
};

export const disputesAPI = {
  create: (token, userID, payload) => apiCall('POST', '/disputes', payload, token, userID),
  list: (token, userID, filters = {}) => apiCall('GET', '/disputes', filters, token, userID),
  respond: (token, userID, disputeId, comment) => apiCall('PUT', `/disputes/${disputeId}/respond`, { comment }, token, userID),
  review: (token, userID, disputeId, comment) => apiCall('PUT', '/review', { disputeId, comment }, token, userID),
  requestInfo: (token, userID, disputeId, message) => apiCall('PUT', '/request-info', { disputeId, message }, token, userID),
  approve: (token, userID, disputeId, comment) => apiCall('PUT', '/approve', { disputeId, comment }, token, userID),
  reject: (token, userID, disputeId, reason, comment) => apiCall('PUT', '/reject', { disputeId, reason, comment }, token, userID),
  chargeback: (token, userID, disputeId, chargebackReasonCode, network, comment) => apiCall('PUT', '/chargeback', { disputeId, chargebackReasonCode, network, comment }, token, userID),
  refund: (token, userID, disputeId, refundAmount, currency, refundMethod) => apiCall('PUT', '/refund', { disputeId, refundAmount, currency, refundMethod }, token, userID),
  close: (token, userID, disputeId, closureReason, comment) => apiCall('PUT', '/close', { disputeId, closureReason, comment }, token, userID),
};
