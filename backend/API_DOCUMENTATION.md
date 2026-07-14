# Dispute Chargeback Management API — Documentation Technique

## Base URL

```
http://localhost:5000/api
```

## Enveloppe de Réponse

Toutes les réponses suivent le format standardisé :

```json
{
  "responseUID": "uuid",
  "resultID": "ProceedWithSuccess | Failure",
  "errorCode": "00000",
  "errorDescription": "PROCESSED WITH SUCCESS",
  "data": { ... }
}
```

## Authentification

Les routes protégées nécessitent un header JWT :

```
Authorization: Bearer <token>
```

Le token est obtenu via `POST /login` et expire après 8 heures.

---

## Endpoints

### Health

| Méthode | Route | Auth | Rôle | Description |
|---------|-------|------|------|-------------|
| GET | `/health` | Non | — | Vérifie que le serveur est en ligne |

---

### Authentification

| Méthode | Route | Auth | Rôle | Description |
|---------|-------|------|------|-------------|
| POST | `/login` | Non | — | Connexion, retourne un JWT + infos utilisateur |
| GET | `/me` | JWT | Tout | Récupère le profil de l'utilisateur connecté |

#### POST /login

**Body :**
```json
{
  "email": "client001@example.com",
  "password": "Password123"
}
```

**Réponse (200) :**
```json
{
  "responseUID": "uuid",
  "resultID": "ProceedWithSuccess",
  "errorCode": "00000",
  "errorDescription": "PROCESSED WITH SUCCESS",
  "data": {
    "token": "eyJhbGci...",
    "user": {
      "id": "CLIENT001",
      "name": "Alice Martin",
      "email": "client001@example.com",
      "role": "CLIENT"
    }
  }
}
```

**Erreurs :**
- `40070` (400) — Email et mot de passe requis
- `40101` (401) — Email ou mot de passe invalide

---

### Cartes

| Méthode | Route | Auth | Rôle | Description |
|---------|-------|------|------|-------------|
| GET | `/cards` | JWT | CLIENT | Liste des cartes actives du client |

**Réponse (200) :**
```json
{
  "data": [
    { "cardId": "CARD001", "cardNumber": "5426679999889039", "brand": "MASTERCARD" }
  ]
}
```

---

### Transactions

| Méthode | Route | Auth | Rôle | Description |
|---------|-------|------|------|-------------|
| GET | `/transactions` | JWT | CLIENT | Liste des transactions (filtres optionnels) |

#### GET /transactions

**Query params :**
- `cardNumber` (optionnel) — numéro de carte à filtrer (auto-détecté si absent)
- `startDate` (optionnel) — date de début `YYYY-MM-DD`
- `endDate` (optionnel) — date de fin `YYYY-MM-DD`

**Réponse (200) :**
```json
{
  "data": [
    {
      "transactionId": "TXN001",
      "merchant": "Amazon",
      "amount": 250.75,
      "currency": "USD",
      "transactionDate": "2026-06-15",
      "status": "COMPLETED"
    }
  ]
}
```

**Erreurs :**
- `40001` (400) — requestInfo invalide
- `40002` (400) — cardNumber invalide
- `40003` (400) — Format de date invalide
- `40004` (400) — startDate > endDate
- `40300` (403) — Carte n'appartient pas au client
- `40400` (404) — Carte introuvable

---

### Litiges — CRUD

| Méthode | Route | Auth | Rôle | Description |
|---------|-------|------|------|-------------|
| POST | `/disputes` | JWT | CLIENT | Créer un litige |
| GET | `/disputes` | JWT | CLIENT/OPERATOR | Liste des litiges (filtres) |
| PUT | `/disputes/:id/respond` | JWT | CLIENT | Répondre à une demande d'info opérateur |

#### POST /disputes

**Body :**
```json
{
  "requestInfo": {
    "requestUID": "req-001",
    "requestDate": "2026-07-14",
    "userID": "CLIENT001"
  },
  "transactionId": "TXN006",
  "reason": "UNAUTHORIZED_TRANSACTION",
  "description": "Je n'ai pas effectué cette transaction.",
  "claimAmount": 199.99,
  "currency": "USD"
}
```

**Motifs valides (9) :**
`UNAUTHORIZED_TRANSACTION`, `DOUBLE_CHARGE`, `GOODS_NOT_RECEIVED`, `SERVICE_NOT_PROVIDED`, `INCORRECT_AMOUNT`, `CANCELLED_RECURRING_PAYMENT`, `FRAUD`, `ATM_CASH_NOT_DISPENSED`, `OTHER`

**Réponse (201) :**
```json
{
  "data": {
    "disputeId": "DSP013",
    "transactionId": "TXN006",
    "status": "SUBMITTED",
    "createdAt": "2026-07-14T10:30:00.000Z"
  }
}
```

**Erreurs :**
- `40001` (400) — requestInfo manquant
- `40010` (400) — transactionId manquant
- `40011` (400) — reason manquant ou invalide
- `40012` (400) — description manquante
- `40013` (400) — claimAmount invalide (doit être > 0)
- `40014` (400) — currency manquante
- `40300` (403) — Rôle non autorisé (CLIENT requis)
- `40301` (403) — Transaction n'appartient pas au client
- `40401` (404) — Transaction introuvable
- `40901` (409) — Un litige actif existe déjà pour cette transaction

#### GET /disputes

**Query params :**
- `status` (optionnel) — filtrer par statut, ou `ALL` pour tout afficher (défaut)
- `startDate` / `endDate` (optionnels) — filtrer par date de création `YYYY-MM-DD`

**CLIENT :** ne voit que ses propres litiges, inclut `merchant` de la transaction jointe.
**OPERATOR :** voit tous les litiges, inclut `clientName` et `userID`.

**Réponse (200) :**
```json
{
  "data": [
    {
      "disputeId": "DSP001",
      "transactionId": "TXN001",
      "reason": "UNAUTHORIZED_TRANSACTION",
      "description": "...",
      "claimAmount": 250.75,
      "currency": "USD",
      "status": "SUBMITTED",
      "createdAt": "2026-07-10T10:00:00.000Z",
      "updatedAt": "2026-07-10T10:00:00.000Z"
    }
  ]
}
```

#### PUT /disputes/:id/respond

Transition : `WAITING_FOR_INFORMATION → UNDER_REVIEW`

**Body :**
```json
{
  "comment": "Voici les informations demandées."
}
```

**Réponse (200) :**
```json
{
  "data": {
    "disputeId": "DSP001",
    "status": "UNDER_REVIEW",
    "respondedBy": "CLIENT001",
    "respondDate": "2026-07-14T10:00:00.000Z"
  }
}
```

**Erreurs :**
- `40080` (400) — comment requis
- `40402` (404) — Litige introuvable
- `40300` (403) — Accès refusé (pas le propriétaire du litige)
- `40908` (409) — Le litige n'est pas au statut WAITING_FOR_INFORMATION

---

### Workflow — Opérateur

| Méthode | Route | Auth | Rôle | Transition | Statut de départ requis |
|---------|-------|------|------|------------|------------------------|
| PUT | `/review` | JWT | OPERATOR | SUBMITTED → UNDER_REVIEW | SUBMITTED uniquement |
| PUT | `/request-info` | JWT | OPERATOR | UNDER_REVIEW → WAITING_FOR_INFORMATION | UNDER_REVIEW uniquement |
| PUT | `/approve` | JWT | OPERATOR | UNDER_REVIEW/WAITING → APPROVED | UNDER_REVIEW ou WAITING_FOR_INFORMATION |
| PUT | `/reject` | JWT | OPERATOR | UNDER_REVIEW/WAITING → REJECTED | UNDER_REVIEW ou WAITING_FOR_INFORMATION |
| PUT | `/chargeback` | JWT | OPERATOR | APPROVED → CHARGEBACK_INITIATED | APPROVED uniquement |
| PUT | `/refund` | JWT | OPERATOR | CHARGEBACK → REFUND_COMPLETED | CHARGEBACK_INITIATED uniquement |
| PUT | `/close` | JWT | OPERATOR | REJECTED/REFUND → CLOSED | REJECTED ou REFUND_COMPLETED |

#### PUT /review

**Body :**
```json
{
  "requestInfo": { "requestUID": "...", "requestDate": "...", "userID": "OPERATOR001" },
  "disputeId": "DSP001",
  "comment": "Dossier pris en charge pour analyse."
}
```

**Réponse (200) :**
```json
{
  "data": {
    "disputeId": "DSP001",
    "status": "UNDER_REVIEW",
    "reviewedBy": "OPERATOR001",
    "reviewDate": "2026-07-14T10:00:00.000Z"
  }
}
```

**Erreurs :** `40001` (requestInfo), `40030` (disputeId), `40031` (comment), `40402` (introuvable), `40906` (statut invalide, doit être SUBMITTED)

#### PUT /request-info

**Body :**
```json
{
  "requestInfo": { "requestUID": "...", "requestDate": "...", "userID": "OPERATOR001" },
  "disputeId": "DSP001",
  "message": "Merci de fournir un justificatif de paiement."
}
```

**Réponse (200) :**
```json
{
  "data": {
    "disputeId": "DSP001",
    "status": "WAITING_FOR_INFORMATION",
    "requestedInformation": "Merci de fournir un justificatif de paiement."
  }
}
```

**Erreurs :** `40033` (message), `40907` (statut invalide, doit être UNDER_REVIEW)

#### PUT /approve

**Body :**
```json
{
  "requestInfo": { "requestUID": "...", "requestDate": "...", "userID": "OPERATOR001" },
  "disputeId": "DSP001",
  "comment": "Litige approuvé après vérification."
}
```

**Réponse (200) :**
```json
{
  "data": {
    "disputeId": "DSP001",
    "status": "APPROVED",
    "approvedBy": "OPERATOR001"
  }
}
```

**Erreurs :** `40031` (comment), `40902` (statut invalide, doit être UNDER_REVIEW ou WAITING_FOR_INFORMATION)

#### PUT /reject

**Body :**
```json
{
  "requestInfo": { "requestUID": "...", "requestDate": "...", "userID": "OPERATOR001" },
  "disputeId": "DSP001",
  "reason": "Preuves insuffisantes.",
  "comment": "Optionnel : commentaire complémentaire."
}
```

**Réponse (200) :**
```json
{
  "data": {
    "disputeId": "DSP001",
    "status": "REJECTED",
    "reason": "Preuves insuffisantes."
  }
}
```

**Erreurs :** `40032` (reason), `40902` (statut invalide)

#### PUT /chargeback

**Body :**
```json
{
  "requestInfo": { "requestUID": "...", "requestDate": "...", "userID": "OPERATOR001" },
  "disputeId": "DSP001",
  "chargebackReasonCode": "4837",
  "network": "Visa",
  "comment": "Chargeback initié."
}
```

**`network` doit être `Visa` ou `Mastercard`.**

**Réponse (200) :**
```json
{
  "data": {
    "disputeId": "DSP001",
    "status": "CHARGEBACK_INITIATED",
    "chargebackReference": "CB202600001"
  }
}
```

**Erreurs :** `40040` (chargebackReasonCode), `40041` (network invalide), `40903` (statut invalide, doit être APPROVED)

#### PUT /refund

**Body :**
```json
{
  "requestInfo": { "requestUID": "...", "requestDate": "...", "userID": "OPERATOR001" },
  "disputeId": "DSP001",
  "refundAmount": 199.99,
  "currency": "USD",
  "refundMethod": "CARD_CREDIT"
}
```

**`refundMethod` doit être `CARD_CREDIT` ou `BANK_TRANSFER`.**
**`refundAmount` doit être > 0 et ≤ montant du litige.**
**`currency` doit correspondre à la devise du litige.**

**Réponse (200) :**
```json
{
  "data": {
    "disputeId": "DSP001",
    "status": "REFUND_COMPLETED",
    "refundAmount": 199.99,
    "currency": "USD"
  }
}
```

**Erreurs :** `40050` (refundAmount invalide), `40051` (refundAmount > claimAmount), `40052` (currency ne correspond pas), `40053` (refundMethod invalide), `40904` (statut invalide, doit être CHARGEBACK_INITIATED)

#### PUT /close

**Body :**
```json
{
  "requestInfo": { "requestUID": "...", "requestDate": "...", "userID": "OPERATOR001" },
  "disputeId": "DSP001",
  "closureReason": "CASE_RESOLVED",
  "comment": "Dossier clôturé."
}
```

**`closureReason` doit être :** `CASE_RESOLVED`, `REJECTED_FINAL`, `REFUND_ISSUED`, `OTHER`

**Réponse (200) :**
```json
{
  "data": {
    "disputeId": "DSP001",
    "status": "CLOSED",
    "closedDate": "2026-07-14T12:30:00.000Z"
  }
}
```

**Erreurs :** `40060` (closureReason invalide), `40031` (comment), `40905` (statut invalide, doit être REJECTED ou REFUND_COMPLETED)

---

## Codes d'Erreur

| Code | HTTP | Signification |
|------|------|---------------|
| `00000` | — | Succès |
| `00001` | — | Échec (défaut) |
| `00004` | 404 | Route introuvable (catch-all) |
| `40001` | 400 | requestInfo manquant ou invalide |
| `40002` | 400 | cardNumber manquant ou invalide |
| `40003` | 400 | Format de date invalide |
| `40004` | 400 | startDate > endDate |
| `40010` | 400 | transactionId manquant |
| `40011` | 400 | reason manquant ou invalide |
| `40012` | 400 | description manquante |
| `40013` | 400 | claimAmount invalide (doit être > 0) |
| `40014` | 400 | currency manquante |
| `40020` | 400 | Valeur de statut invalide (getDisputes) |
| `40030` | 400 | disputeId manquant |
| `40031` | 400 | comment manquant |
| `40032` | 400 | reason manquant (reject) |
| `40033` | 400 | message manquant (requestInfo) |
| `40040` | 400 | chargebackReasonCode manquant |
| `40041` | 400 | network invalide (doit être Visa ou Mastercard) |
| `40050` | 400 | refundAmount invalide (doit être > 0) |
| `40051` | 400 | refundAmount > montant réclamé |
| `40052` | 400 | currency ne correspond pas au litige |
| `40053` | 400 | refundMethod invalide |
| `40060` | 400 | closureReason invalide |
| `40070` | 400 | Email et mot de passe requis |
| `40080` | 400 | comment requis (respond) |
| `40100` | 401 | JWT manquant/invalide |
| `40101` | 401 | Email ou mot de passe incorrect |
| `40300` | 403 | Accès interdit (mauvais rôle) |
| `40301` | 403 | Transaction n'appartient pas au client |
| `40400` | 404 | Carte introuvable |
| `40401` | 404 | Transaction ou utilisateur introuvable |
| `40402` | 404 | Litige introuvable |
| `40901` | 409 | Litige actif déjà existant pour cette transaction |
| `40902` | 409 | Transition invalide (approve/reject) |
| `40903` | 409 | Transition invalide (chargeback) |
| `40904` | 409 | Transition invalide (refund) |
| `40905` | 409 | Transition invalide (close) |
| `40906` | 409 | Transition invalide (review) |
| `40907` | 409 | Transition invalide (request-info) |
| `40908` | 409 | Dispute doit être WAITING_FOR_INFORMATION (respond) |
| `40910` | 409 | Transition de statut interdite (validateur générique) |
| `50000` | 500 | Erreur interne serveur |

---

## Workflow d'État des Litiges

```
                                    ┌─────────────────────────────────┐
                                    │                                 │
SUBMITTED ──► UNDER_REVIEW ──► WAITING_FOR_INFORMATION ◄────────────┘
                   │                (client respond)
                   │
                   ├────► APPROVED ──► CHARGEBACK_INITIATED ──► MERCHANT_RESPONSE_RECEIVED ──► REFUND_COMPLETED ──► CLOSED
                   │
                   └────► REJECTED ──► CLOSED
```

**9 statuts autorisés :** SUBMITTED, UNDER_REVIEW, WAITING_FOR_INFORMATION, APPROVED, REJECTED, CHARGEBACK_INITIATED, MERCHANT_RESPONSE_RECEIVED, REFUND_COMPLETED, CLOSED

---

## Comptes de Test

| Rôle | Email | Mot de passe |
|------|-------|-------------|
| CLIENT | client001@example.com | Password123 |
| CLIENT | client002@example.com | Password123 |
| OPERATOR | operator@example.com | Password123 |
