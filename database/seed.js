// Script d'initialisation (seed) de la base de données SQLite.
// Insère des données de démonstration cohérentes pour le développement.
// Exécution : node database/seed.js (depuis la racine du projet)
//             (doit être lancé APRÈS database/migrate.js)

const path = require('path');
const sqlite3 = require(path.join(__dirname, '..', 'backend', 'node_modules', 'sqlite3')).verbose();
const bcrypt = require(path.join(__dirname, '..', 'backend', 'node_modules', 'bcryptjs'));

const DB_PATH = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(DB_PATH);

// Active les clés étrangères pour garantir l'intégrité référentielle
// lors des insertions (ordre respecté : users → cards → transactions).
db.run('PRAGMA foreign_keys = ON');

const SALT_ROUNDS = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

// Vérifie si une ligne avec un ID donné existe dans la table.
async function exists(table, id) {
  const rows = await query(`SELECT 1 FROM ${table} WHERE id = ?`, [id]);
  return rows.length > 0;
}

// Mot de passe partagé pour tous les utilisateurs de démonstration.
const PLAIN_PASSWORD = 'Password123';

// ─── Seed : utilisateurs ────────────────────────────────────────────────────
async function seedUsers() {
  const hash = await bcrypt.hash(PLAIN_PASSWORD, SALT_ROUNDS);

  const users = [
    { id: 'CLIENT001',  name: 'Alice Martin',  email: 'client001@example.com', role: 'CLIENT' },
    { id: 'OPERATOR001', name: 'Bob Dupont',    email: 'operator@example.com',  role: 'OPERATOR' },
  ];

  for (const u of users) {
    if (await exists('users', u.id)) {
      console.log(`  ∼ Utilisateur déjà existant : ${u.id}`);
      continue;
    }
    await run(
      `INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)`,
      [u.id, u.name, u.email, hash, u.role]
    );
    console.log(`  ✓ Utilisateur créé : ${u.id} (${u.email}) [${u.role}]`);
  }
}

// ─── Seed : cartes bancaires ─────────────────────────────────────────────────
async function seedCards() {
  const cards = [
    {
      id: 'CARD001',
      userId: 'CLIENT001',
      cardNumber: '5426679999889039',
      cardType: 'MASTERCARD',
      expiryDate: '12/28',
      cardholderName: 'Alice Martin',
    },
  ];

  for (const c of cards) {
    if (await exists('cards', c.id)) {
      console.log(`  ∼ Carte déjà existante : ${c.id}`);
      continue;
    }
    await run(
      `INSERT INTO cards (id, userId, cardNumber, cardType, expiryDate, cardholderName)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [c.id, c.userId, c.cardNumber, c.cardType, c.expiryDate, c.cardholderName]
    );
    console.log(`  ✓ Carte créée : ${c.id} (${c.cardNumber}) → ${c.userId}`);
  }
}

// ─── Seed : transactions ──────────────────────────────────────────────────────
async function seedTransactions() {
  const transactions = [
    {
      id: 'TXN001',
      userId: 'CLIENT001',
      cardId: 'CARD001',
      amount: 250.75,
      currency: 'USD',
      merchant: 'Amazon',
      merchantCategory: '5311',
      status: 'COMPLETED',
      transactionDate: '2026-06-15',
      description: 'Achat en ligne sur Amazon.fr',
    },
    {
      id: 'TXN002',
      userId: 'CLIENT001',
      cardId: 'CARD001',
      amount: 14.99,
      currency: 'USD',
      merchant: 'Netflix',
      merchantCategory: '5812',
      status: 'COMPLETED',
      transactionDate: '2026-07-01',
      description: 'Abonnement mensuel Netflix',
    },
  ];

  for (const t of transactions) {
    if (await exists('transactions', t.id)) {
      console.log(`  ∼ Transaction déjà existante : ${t.id}`);
      continue;
    }
    await run(
      `INSERT INTO transactions (id, userId, cardId, amount, currency, merchant,
                                 merchantCategory, status, transactionDate, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [t.id, t.userId, t.cardId, t.amount, t.currency, t.merchant,
       t.merchantCategory, t.status, t.transactionDate, t.description]
    );
    console.log(`  ✓ Transaction créée : ${t.id} (${t.merchant}, ${t.amount} ${t.currency}) [${t.status}]`);
  }
}

// ─── Point d'entrée ──────────────────────────────────────────────────────────
async function main() {
  console.log('Début du seed des données de démonstration...\n');

  try {
    await seedUsers();
    await seedCards();
    await seedTransactions();
    console.log('\nSeed terminé avec succès.');
  } catch (err) {
    console.error('\nErreur lors du seed :', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
