const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// On importe la connexion à la base de données
const sequelize = require('./config/database');

// On importe tous les modèles via index.js
// Cet import déclenche aussi toutes les associations (belongsTo, hasMany...)
const { User, Category, Book, Member, Borrow } = require('./models');

// On importe toutes les routes
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const bookRoutes = require('./routes/books');
const memberRoutes = require('./routes/members');
const borrowRoutes = require('./routes/borrows');
const statsRoutes = require('./routes/stats');

// ─── Création de l'application Express ────────────────────────────────────
const app = express();

// ─── Middlewares globaux ───────────────────────────────────────────────────
// cors() permet au frontend (port 3000) de parler au backend (port 5000)
// sans ça le navigateur bloque les requêtes pour des raisons de sécurité
app.use(cors());

// express.json() permet de lire le corps des requêtes en JSON
// sans ça req.body serait toujours undefined
app.use(express.json());

// express.urlencoded() permet de lire les formulaires HTML classiques
app.use(express.urlencoded({ extended: true }));

// On expose le dossier uploads/ pour que les images soient accessibles
// ex: http://localhost:5000/uploads/1693000000000-123456789.jpg
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Branchement des routes ────────────────────────────────────────────────
// Chaque route a son préfixe d'URL
// ex: toutes les routes dans authRoutes commencent par /api/auth
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/books', bookRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/borrows', borrowRoutes);
app.use('/api/stats', statsRoutes);

// ─── Route de test ─────────────────────────────────────────────────────────
// Permet de vérifier rapidement que le serveur tourne
app.get('/', (req, res) => {
  res.json({ message: '🚀 API Bibliothèque en ligne !' });
});

// ─── Fonction de démarrage ─────────────────────────────────────────────────
const start = async () => {
  try {
    // 1. On teste la connexion à MySQL
    await sequelize.authenticate();
    console.log('✅ Connexion MySQL réussie');

    // 2. On synchronise les modèles avec la base de données
    // alter: true = Sequelize met à jour les tables si les modèles ont changé
    // sans supprimer les données existantes
    await sequelize.sync({ alter: true });
    console.log('✅ Tables synchronisées');

    // 3. On crée un admin par défaut s'il n'en existe aucun
    // Comme ça on peut toujours se connecter même sur une base vide
    const adminExists = await User.findOne({
      where: { email: 'admin@bibliotheque.com' }
    });

    if (!adminExists) {
      // On hache le mot de passe avant de le sauvegarder
      const hashedPassword = await bcrypt.hash('admin123', 10);
      await User.create({
        name: 'Administrateur',
        email: 'admin@bibliotheque.com',
        password: hashedPassword,
      });
      console.log('✅ Admin par défaut créé');
      console.log('   Email    : admin@bibliotheque.com');
      console.log('   Password : admin123');
    }

    // 4. On démarre le serveur sur le port défini dans .env
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
    });

  } catch (err) {
    // Si une erreur survient au démarrage (ex: MySQL pas lancé)
    // on l'affiche clairement et on arrête le processus
    console.error(' Erreur au démarrage :', err.message);
    process.exit(1);
  }
};

// On lance tout !
start();