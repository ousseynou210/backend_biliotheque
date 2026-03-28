const express = require('express');
const router = express.Router();
const Joi = require('joi');
const auth = require('../middleware/auth');
const { Borrow, Member, Book } = require('../models');

// ─── Schéma de validation ──────────────────────────────────────────────────
const borrowSchema = Joi.object({
  member_id: Joi.number().required(),
  book_id: Joi.number().required(),
  // due_date doit être une date future au format YYYY-MM-DD
  due_date: Joi.date().iso().greater('now').required(),
});

// ─── GET /api/borrows ──────────────────────────────────────────────────────
// Retourne la liste des emprunts avec filtre par statut et pagination
router.get('/', auth, async (req, res) => {
  try {
    // On récupère les paramètres depuis l'URL
    // ex: /api/borrows?status=borrowed&page=1&limit=10
    const { status, page = 1, limit = 10 } = req.query;

    // On construit les conditions de recherche
    const where = {};

    // Si un statut est fourni, on filtre par ce statut
    // Les 3 valeurs possibles : "borrowed", "returned", "overdue"
    if (status) {
      where.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Borrow.findAndCountAll({
      where,
      // include permet de récupérer les infos du membre et du livre
      // en une seule requête au lieu de faire 3 requêtes séparées
      include: [
        {
          model: Member,
          as: 'member',
          // On ne prend que les champs utiles, pas toute la table
          attributes: ['id', 'first_name', 'last_name'],
        },
        {
          model: Book,
          as: 'book',
          attributes: ['id', 'title', 'author'],
        },
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      // Les emprunts les plus récents en premier
      order: [['borrow_date', 'DESC']],
    });

    return res.status(200).json({
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      borrows: rows,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── POST /api/borrows ─────────────────────────────────────────────────────
// Crée un nouvel emprunt
router.post('/', auth, async (req, res) => {
  // 1. On valide les données
  const { error } = borrowSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    // 2. On vérifie que le membre existe et qu'il est actif
    // Un membre inactif ne peut pas emprunter
    const member = await Member.findByPk(req.body.member_id);
    if (!member) {
      return res.status(400).json({ message: 'Membre introuvable' });
    }
    if (member.status !== 'active') {
      return res.status(400).json({ message: 'Ce membre est inactif' });
    }

    // 3. On vérifie que le livre existe et qu'il est disponible
    // available_quantity doit être >= 1 pour pouvoir emprunter
    const book = await Book.findByPk(req.body.book_id);
    if (!book) {
      return res.status(400).json({ message: 'Livre introuvable' });
    }
    if (book.available_quantity < 1) {
      return res.status(400).json({ message: 'Livre non disponible' });
    }

    // 4. On crée l'emprunt dans la base
    const borrow = await Borrow.create({
      member_id: req.body.member_id,
      book_id: req.body.book_id,
      borrow_date: new Date(), // date du jour automatiquement
      due_date: req.body.due_date,
      status: 'borrowed',
    });

    // 5. On décrémente le nombre de livres disponibles
    // ex: available_quantity était 3 → devient 2
    await book.update({
      available_quantity: book.available_quantity - 1,
    });

    // 6. On retourne l'emprunt avec les infos du membre et du livre
    const borrowWithDetails = await Borrow.findByPk(borrow.id, {
      include: [
        { model: Member, as: 'member', attributes: ['id', 'first_name', 'last_name'] },
        { model: Book, as: 'book', attributes: ['id', 'title', 'author'] },
      ],
    });

    return res.status(201).json(borrowWithDetails);
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── PUT /api/borrows/return/:id ───────────────────────────────────────────
// Enregistre le retour d'un livre
// Cette route doit être AVANT /:id sinon Express va confondre "return" avec un id
router.put('/return/:id', auth, async (req, res) => {
  try {
    // 1. On cherche l'emprunt avec les détails du livre
    const borrow = await Borrow.findByPk(req.params.id, {
      include: [{ model: Book, as: 'book' }],
    });

    // 2. S'il n'existe pas → 404
    if (!borrow) {
      return res.status(404).json({ message: 'Emprunt introuvable' });
    }

    // 3. Si le livre est déjà retourné, on ne peut pas le retourner deux fois
    if (borrow.status === 'returned') {
      return res.status(400).json({ message: 'Ce livre a déjà été retourné' });
    }

    // 4. On met à jour l'emprunt
    // return_date = date du jour, status = "returned"
    await borrow.update({
      return_date: new Date(),
      status: 'returned',
    });

    // 5. On réincrémente le nombre de livres disponibles
    // ex: available_quantity était 2 → redevient 3
    await borrow.book.update({
      available_quantity: borrow.book.available_quantity + 1,
    });

    return res.status(200).json({
      message: 'Livre retourné avec succès',
      borrow,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;