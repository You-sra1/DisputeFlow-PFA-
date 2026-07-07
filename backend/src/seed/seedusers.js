const bcrypt = require('bcryptjs');
const userModel = require('../models/usermodel');

async function seedUsers() {
  const total = await userModel.countUsers();
  if (total > 0) {
    console.log(`La table users contient déjà ${total} utilisateur(s). Seed ignoré.`);
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash('Password123', 10);

  await userModel.create({
    id: 'CLIENT001',
    name: 'Alice Martin',
    email: 'client001@example.com',
    password: passwordHash,
    role: 'CLIENT',
  });

  console.log('Utilisateur de test créé :');
  console.log('- client001@example.com / Password123 (CLIENT)');
  process.exit(0);
}

seedUsers().catch((err) => {
  console.error('Erreur lors du seed :', err);
  process.exit(1);
});