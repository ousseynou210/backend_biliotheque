const Joi = require('joi');
const { Category, Book } = require('../models');

// ─── Schéma de validation ──────────────────────────────────────────────────
const categorySchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).allow('', null),
});

// ─── GET /api/categories ───────────────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const categories = await Category.findAll({
      include: [{ model: Book, as: 'books', attributes: ['id'] }],
    });
    return res.status(200).json(categories);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/categories ──────────────────────────────────────────────────
const create = async (req, res) => {
  const { error } = categorySchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    const category = await Category.create({
      name: req.body.name,
      description: req.body.description || null,
    });
    return res.status(201).json(category);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Cette catégorie existe déjà' });
    }
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── PUT /api/categories/:id ───────────────────────────────────────────────
const update = async (req, res) => {
  const { error } = categorySchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Catégorie introuvable' });
    }

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
};

// ─── DELETE /api/categories/:id ───────────────────────────────────────────
const remove = async (req, res) => {
  try {
    const category = await Category.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ message: 'Catégorie introuvable' });
    }

    await category.destroy();
    return res.status(200).json({ message: 'Catégorie supprimée' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { getAll, create, update, remove };
