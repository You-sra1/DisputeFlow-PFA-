// Point d'entrée principal du backend Express.
// Ici on initialise l'application, la base SQLite et on branche les routes d'authentification.
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const db = require('./config/db');
const { successResponse, errorResponse } = require('./utils/responseBuilder');
const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json(successResponse({ status: 'ok', timestamp: new Date().toISOString() }));
});

app.get('/api/db-check', (_req, res) => {
  db.get("SELECT name FROM sqlite_master WHERE type='table'", (err, row) => {
    if (err) {
      return res.status(500).json(errorResponse(err.message, { errorCode: '00002' }));
    }
    res.json(successResponse({ tables: row ? row.name : 'aucune table trouvée' }));
  });
});

// Branche les routes d'authentification (POST /api/login, GET /api/me).
app.use('/api', authRoutes);

// Branche les routes des transactions (GET /api/transactions).
app.use('/api', transactionRoutes);

// Branche les routes des litiges (POST /api/disputes).
app.use('/api', disputeRoutes);

// Branche les routes du dashboard (GET /api/dashboard/stats, etc.).
app.use('/api', dashboardRoutes);

// Middleware de gestion centralisée des erreurs (AppError + erreurs imprévues)
// Doit être déclaré AVANT le 404 catch-all pour intercepter les erreurs
// des routeurs asynchrones (Express 5 ne les catch pas correctement sinon).
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.use((_req, res) => {
  res.status(404).json(errorResponse('Route non trouvée', { errorCode: '00004' }));
});

app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
