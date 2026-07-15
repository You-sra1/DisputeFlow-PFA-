# SecureBank — Dispute Portal (Frontend)

Frontend React (Vite) du portail de gestion des litiges et chargebacks,
conçu pour se connecter directement à votre backend Express déjà développé.

## 1. Installation

```bash
cd frontend
npm install
```

## 2. Configuration de la connexion au backend

Un fichier `.env` est déjà présent avec :

```
VITE_API_URL=http://localhost:5000
```

Si votre backend tourne sur un autre port ou une autre adresse (par exemple
une IP réseau), modifiez cette valeur dans `.env` avant de lancer le frontend.

## 3. Lancer le projet

Assurez-vous que le backend tourne déjà (`npm run dev` dans le dossier
`backend/`), puis dans un second terminal :

```bash
cd frontend
npm run dev
```

Le frontend démarre sur `http://localhost:5173`.

## 4. Comptes de démonstration

Utilisez les comptes créés par votre script `database/seed.js` :

- **Client** : `client001@example.com` / `Password123`
- **Opérateur** : `operator@example.com` / `Password123`

## 5. Structure du projet

```
src/
├── api.js                 # Couche unique d'appels au backend (26 fonctions,
│                           # une par endpoint : login, transactions, disputes,
│                           # workflow, dashboard...)
├── constants.js            # Statuts, motifs, couleurs — cohérents avec le
│                           # cahier des charges et les contraintes SQL du backend
├── context/
│   ├── AuthContext.jsx     # Session utilisateur (token JWT, rôle, login/logout)
│   └── ThemeContext.jsx    # Bascule Light Mode / Dark Mode
├── components/             # Sidebar, Header, Layout, KPICard, StatusBadge,
│                           # DisputesTable, BarChartCard, ProtectedRoute...
├── pages/
│   ├── Login.jsx
│   ├── ClientDashboard.jsx / ClientTransactions.jsx / ClientDisputes.jsx
│   ├── CreateDispute.jsx / DisputeDetail.jsx
│   ├── OperatorDashboard.jsx / OperatorDisputes.jsx / Analytics.jsx
│   └── Profile.jsx / Settings.jsx
├── App.jsx                 # Toutes les routes + protection par rôle
└── App.css                 # Styles globaux (variables light/dark)
```

## 6. Endpoints backend utilisés

Toutes les routes du cahier des charges sont couvertes (`POST /login`,
`GET /transactions`, `POST /disputes`, `GET /disputes`, `PUT /review`,
`PUT /request-info`, `PUT /approve`, `PUT /reject`, `PUT /chargeback`,
`PUT /refund`, `PUT /close`), ainsi que les routes additionnelles déjà
développées pour enrichir l'expérience (`GET/PUT /me`, `GET /cards`,
`GET /disputes/:id/history`, `/comments`, `/documents`, `PUT /disputes/:id/respond`,
`GET /dashboard/stats`, `/status-distribution`, `/reason-distribution`).

Si un de ces endpoints n'existe pas encore côté backend, la page concernée
affichera un message d'erreur clair (`errorDescription` renvoyé par le
backend, ou "Impossible de contacter le serveur" si la route est introuvable),
plutôt que de planter silencieusement.

## 7. Notes importantes

- **CORS** : assurez-vous que `app.use(cors())` est bien actif côté backend
  (déjà le cas dans votre `app.js`).
- **Token JWT** : stocké en `sessionStorage` (survit à un F5, pas à la
  fermeture de l'onglet), jamais en `localStorage` pour limiter l'exposition.
- **Aucune donnée statique** : chaque page appelle réellement le backend ;
  si une liste est vide, c'est parce que la base ne contient rien pour ce
  filtre, pas un bug d'affichage.
