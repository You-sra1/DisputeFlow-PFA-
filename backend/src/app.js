const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.resolve(__dirname, process.env.DB_PATH || '../../database/database.sqlite');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Erreur de connexion à la base de données:', err.message);
  } else {
    console.log('Connecté à la base de données SQLite');
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/db-check', (_req, res) => {
  db.get("SELECT name FROM sqlite_master WHERE type='table'", (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ tables: row ? row.name : 'aucune table trouvée' });
  });
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route non trouvée' });
});

app.use((err, _req, res, _next) => {
  console.error('Erreur serveur:', err.stack);
  res.status(500).json({ error: 'Erreur interne du serveur' });
});

app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
