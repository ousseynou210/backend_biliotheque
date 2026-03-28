const express = require('express');
const router = express.Router();
const Joi = require('joi');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const { Book, Category } = require('../models');

// ─── Configuration de Multer (upload d'images) ────────────────────────────
// Multer est le module qui gère la réception des fichiers envoyés par le frontend
const storage = multer.diskStorage({
  // On définit où sauvegarder les images uploadées
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  // On génère un nom unique pour chaque image
  // ex: "1693000000000-123456789.jpg"
  // comme ça deux livres avec la même image n'écrasent pas le fichier
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// On n'accepte que les images (jpeg, jpg, png, webp)
const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const isValid = allowed.test(path.extname(file.originalname).toLowerCase());
  if (isValid) {
    cb(null, true); // accepté
  } else {
    cb(new Error('Format image non supporté'), false); // refusé
  }
};

// On limite la taille à 5Mo maximum
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5Mo en octets
});

// ─── Schéma de validation ──────────────────────────────────────────────────
const bookSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  author: Joi.string().min(1).max(255).required(),
  isbn: Joi.string().max(20).allow('', null),
  category_id: Joi.number().required(),
  quantity: Joi.number().integer().min(1).required(),
  available_quantity: Joi.number().integer().min(0),
  description: Joi.string().max(1000).allow('', null),
});

// ─── GET /api/books ────────────────────────────────────────────────────────
// Retourne la liste des livres avec recherche et pagination
router.get('/', auth, async (req, res) => {
  try {
    // On récupère les paramètres de l'URL
    // ex: /api/books?search=prince&page=2&limit=5
    const { search, page = 1, limit = 10 } = req.query;

    // On construit les conditions de recherche
    const where = {};
    if (search) {
      const { Op } = require('sequelize');
      where[Op.or] = [
        // Op.like = SQL LIKE — cherche le mot dans le titre ou l'auteur
        { title: { [Op.like]: `%${search}%` } },
        { author: { [Op.like]: `%${search}%` } },
      ];
    }

    // offset = combien de lignes on saute
    // ex: page 2, limit 10 → offset 10 → on saute les 10 premiers
    const offset = (page - 1) * limit;

    const { count, rows } = await Book.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['id', 'DESC']], // les plus récents en premier
    });

    return res.status(200).json({
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      books: rows,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── POST /api/books ───────────────────────────────────────────────────────
// Crée un nouveau livre
// "upload.single('cover_image')" = on attend un seul fichier avec ce nom de champ
router.post('/', auth, upload.single('cover_image'), async (req, res) => {
  // 1. On valide les données texte
  const { error } = bookSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    // 2. On vérifie que la catégorie existe
    const category = await Category.findByPk(req.body.category_id);
    if (!category) {
      return res.status(400).json({ message: 'Catégorie introuvable' });
    }

    // 3. On crée le livre
    // Si une image a été uploadée, req.file.filename contient son nom
    const book = await Book.create({
      title: req.body.title,
      author: req.body.author,
      isbn: req.body.isbn || null,
      category_id: req.body.category_id,
      quantity: req.body.quantity,
      available_quantity: req.body.available_quantity || req.body.quantity,
      description: req.body.description || null,
      cover_image: req.file ? req.file.filename : null,
    });

    return res.status(201).json(book);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── PUT /api/books/:id ────────────────────────────────────────────────────
// Modifie un livre existant
router.put('/:id', auth, upload.single('cover_image'), async (req, res) => {
  try {
    // 1. On cherche le livre
    const book = await Book.findByPk(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Livre introuvable' });
    }

    // 2. Si une nouvelle image est envoyée, on supprime l'ancienne du disque
    // pour ne pas accumuler des fichiers inutiles
    if (req.file && book.cover_image) {
      const oldPath = path.join(__dirname, '../uploads', book.cover_image);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath); // supprime le fichier
      }
    }

    // 3. On met à jour le livre
    await book.update({
      title: req.body.title || book.title,
      author: req.body.author || book.author,
      isbn: req.body.isbn || book.isbn,
      category_id: req.body.category_id || book.category_id,
      quantity: req.body.quantity || book.quantity,
      available_quantity: req.body.available_quantity || book.available_quantity,
      description: req.body.description || book.description,
      // Si nouvelle image → on prend le nouveau nom, sinon on garde l'ancien
      cover_image: req.file ? req.file.filename : book.cover_image,
    });

    return res.status(200).json(book);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── DELETE /api/books/:id ─────────────────────────────────────────────────
// Supprime un livre
router.delete('/:id', auth, async (req, res) => {
  try {
    // 1. On cherche le livre
    const book = await Book.findByPk(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Livre introuvable' });
    }

    // 2. On supprime l'image du disque si elle existe
    if (book.cover_image) {
      const imgPath = path.join(__dirname, '../uploads', book.cover_image);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    // 3. On supprime le livre de la base
    await book.destroy();
    return res.status(200).json({ message: 'Livre supprimé' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;