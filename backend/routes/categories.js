const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const { Category, Book } = require('../models');

// ─── Schéma de validation ──────────────────────────────────────────────────
// Joi vérifie que les données envoyées sont correctes avant de toucher la base
const categorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('', null),
});

// ─── GET /api/categories ───────────────────────────────────────────────────
// Retourne toutes les catégories avec leurs livres associés
// "auth" devant = route protégée, il faut un token valide
router.get('/', auth, async (req, res) => {
  try {
    const categories = await Category.findAll({
      // "include" permet de joindre les livres liés à chaque catégorie
      // c'est comme un JOIN en SQL
      include: [{ model: Book, as: 'books', attributes: ['id'] }],
    });
    return res.status(200).json(categories);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── POST /api/categories ──────────────────────────────────────────────────
// Crée une nouvelle catégorie
router.post('/', auth, async (req, res) => {
  // 1. On valide les données reçues
  const { error } = categorySchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    // 2. On crée la catégorie dans la base
    const category = await Category.create({
      name: req.body.name,
      description: req.body.description || null,
    });
    return res.status(201).json(category);
  } catch (err) {
    // Si le nom existe déjà (unique: true dans le modèle), on attrape l'erreur
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Cette catégorie existe déjà' });
    }
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── PUT /api/categories/:id ───────────────────────────────────────────────
// Modifie une catégorie existante
// ":id" est une variable dans l'URL — ex: /api/categories/3 → id = 3
router.put('/:id', auth, async (req, res) => {
  // 1. On valide les données
  const { error } = categorySchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    // 2. On cherche la catégorie par son id
    const category = await Category.findByPk(req.params.id);

    // 3. Si elle n'existe pas, on retourne une erreur 404
    if (!category) {
      return res.status(404).json({ message: 'Catégorie introuvable' });
    }

    // 4. On met à jour les champs
    await category.update({
      name: req.body.name,
      description: req.body.description || null,
    });

    return res.status(200).json(category);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Cette catégorie existe déjà' });
    }
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── DELETE /api/categories/:id ───────────────────────────────────────────
// Supprime une catégorie
router.delete('/:id', auth, async (req, res) => {
  try {
    // 1. On cherche la catégorie
    const category = await Category.findByPk(req.params.id);

    // 2. Si elle n'existe pas → 404
    if (!category) {
      return res.status(404).json({ message: 'Catégorie introuvable' });
    }

    // 3. On supprime
    await category.destroy();
    return res.status(200).json({ message: 'Catégorie supprimée' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;