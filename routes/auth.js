const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Joi = require('joi');
const { User } = require('../models');
require('dotenv').config();

// ─── Schéma de validation pour l'inscription ───────────────────────────────
const registerSchema = Joi.object({
  name: Joi.string().min(2).max(100).required(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
});

// ─── Schéma de validation pour la connexion ────────────────────────────────
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

// ─── POST /api/auth/register ───────────────────────────────────────────────
router.post('/register', async (req, res) => {
  // 1. On valide les données envoyées par l'utilisateur
  const { error } = registerSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    // 2. On vérifie que l'email n'existe pas déjà
    const existing = await User.findOne({ where: { email: req.body.email } });
    if (existing) {
      return res.status(400).json({ message: 'Email déjà utilisé' });
    }

    // 3. On hache le mot de passe avant de le sauvegarder
    // bcrypt transforme "admin123" en quelque chose comme "$2a$10$xyz..."
    // Comme ça même si la base est piratée, le vrai mot de passe est protégé
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    // 4. On crée l'utilisateur dans la base de données
    const user = await User.create({
      name: req.body.name,
      email: req.body.email,
      password: hashedPassword,
    });

    // 5. On génère un token JWT
    // C'est le "badge secret" que le frontend va garder et envoyer à chaque requête
    const token = jwt.sign(
      { id: user.id, email: user.email }, // données stockées dans le token
      process.env.JWT_SECRET,             // clé secrète pour signer
      { expiresIn: process.env.JWT_EXPIRES_IN } // durée de validité
    );

    // 6. On retourne le token et les infos de l'utilisateur
    return res.status(201).json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });

  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── POST /api/auth/login ──────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  // 1. On valide les données
  const { error } = loginSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    // 2. On cherche l'utilisateur par email
    const user = await User.findOne({ where: { email: req.body.email } });
    if (!user) {
      // On dit "email ou mot de passe incorrect" et pas "email introuvable"
      // pour ne pas donner d'indices à un pirate
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // 3. On compare le mot de passe tapé avec le mot de passe haché en base
    // bcrypt.compare fait la comparaison intelligemment
    const validPassword = await bcrypt.compare(req.body.password, user.password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }

    // 4. On génère le token JWT
    const token = jwt.sign(
      { id: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // 5. On retourne le token et les infos
    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });

  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── GET /api/auth/profile ─────────────────────────────────────────────────
// Cette route est protégée — elle nécessite un token valide
// req.user est ajouté par le middleware auth.js
router.get('/profile', require('../middleware/auth'), async (req, res) => {
  try {
    // On cherche l'utilisateur par son id (extrait du token)
    const user = await User.findByPk(req.user.id, {
      attributes: ['id', 'name', 'email'], // on ne renvoie pas le mot de passe !
    });
    return res.status(200).json(user);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;