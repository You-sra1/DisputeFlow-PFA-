// ============================================================================
// Loading.jsx — Petit indicateur de chargement réutilisé pendant les appels API.
// ============================================================================
export function Loading({ label = 'Loading...' }) {
  return <div className="loading-state">{label}</div>;
}

// ============================================================================
// ErrorBanner.jsx — Bandeau d'erreur affichant le message exact renvoyé par
// le backend (errorDescription), jamais un message générique muet.
// ============================================================================
export function ErrorBanner({ message }) {
  if (!message) return null;
  return <div className="error-banner">{message}</div>;
}

// ============================================================================
// SuccessBanner.jsx — Bandeau de confirmation après une action réussie.
// ============================================================================
export function SuccessBanner({ message }) {
  if (!message) return null;
  return <div className="success-banner">{message}</div>;
}
