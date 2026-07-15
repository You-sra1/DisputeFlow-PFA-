import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Configuration Vite : le serveur de dev tourne sur le port 5173 par défaut.
// Le backend (Express) tourne séparément sur le port 5000 (voir src/api.js).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // permet l'accès depuis une IP réseau (utile en environnement virtualisé)
  },
});
