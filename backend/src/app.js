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

// Branche les routes d'authentification (POST /login, GET /me).
app.use('/', authRoutes);

// Branche les routes des transactions (GET /transactions).
app.use('/', transactionRoutes);

// Branche les routes des litiges (POST /disputes).
app.use('/', disputeRoutes);

app.use((_req, res) => {
  res.status(404).json(errorResponse('Route non trouvée', { errorCode: '00004' }));
});

// Middleware de gestion centralisée des erreurs (AppError + erreurs imprévues)
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
