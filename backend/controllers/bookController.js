const Joi = require('joi');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Op } = require('sequelize');
const { Book, Category } = require('../models');

// ─── Configuration Multer ──────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp/;
  const isValid = allowed.test(path.extname(file.originalname).toLowerCase());
  if (isValid) {
    cb(null, true);
  } else {
    cb(new Error('Format image non supporté'), false);
  }
};

// On exporte upload pour pouvoir l'utiliser comme middleware dans la route
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5Mo
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
const getAll = async (req, res) => {
  try {
    const { search, category_id, page = 1, limit = 10 } = req.query;

    const where = {};
    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { author: { [Op.like]: `%${search}%` } },
      ];
    }
    if (category_id) {
      where.category_id = category_id;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Book.findAndCountAll({
      where,
      include: [{ model: Category, as: 'category', attributes: ['id', 'name'] }],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['id', 'DESC']],
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
};

// ─── POST /api/books ───────────────────────────────────────────────────────
const create = async (req, res) => {
  const { error } = bookSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    const category = await Category.findByPk(req.body.category_id);
    if (!category) {
      return res.status(400).json({ message: 'Catégorie introuvable' });
    }

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
};

// ─── PUT /api/books/:id ────────────────────────────────────────────────────
const update = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Livre introuvable' });
    }

    // Si une nouvelle image est envoyée, on supprime l'ancienne du disque
    if (req.file && book.cover_image) {
      const oldPath = path.join(__dirname, '../uploads', book.cover_image);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    await book.update({
      title: req.body.title || book.title,
      author: req.body.author || book.author,
      isbn: req.body.isbn || book.isbn,
      category_id: req.body.category_id || book.category_id,
      quantity: req.body.quantity || book.quantity,
      available_quantity: req.body.available_quantity || book.available_quantity,
      description: req.body.description || book.description,
      cover_image: req.file ? req.file.filename : book.cover_image,
    });

    return res.status(200).json(book);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── DELETE /api/books/:id ─────────────────────────────────────────────────
const remove = async (req, res) => {
  try {
    const book = await Book.findByPk(req.params.id);
    if (!book) {
      return res.status(404).json({ message: 'Livre introuvable' });
    }

    if (book.cover_image) {
      const imgPath = path.join(__dirname, '../uploads', book.cover_image);
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
      }
    }

    await book.destroy();
    return res.status(200).json({ message: 'Livre supprimé' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { upload, getAll, create, update, remove };
