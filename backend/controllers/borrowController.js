const Joi = require('joi');
const { Borrow, Member, Book } = require('../models');

// ─── Schéma de validation ──────────────────────────────────────────────────
const borrowSchema = Joi.object({
  member_id: Joi.number().required(),
  book_id: Joi.number().required(),
  due_date: Joi.date().iso().greater('now').required(),
});

// ─── GET /api/borrows ──────────────────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;

    const where = {};
    if (status) {
      where.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Borrow.findAndCountAll({
      where,
      include: [
        {
          model: Member,
          as: 'member',
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
};

// ─── POST /api/borrows ─────────────────────────────────────────────────────
const create = async (req, res) => {
  const { error } = borrowSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    const member = await Member.findByPk(req.body.member_id);
    if (!member) {
      return res.status(400).json({ message: 'Membre introuvable' });
    }
    if (member.status !== 'active') {
      return res.status(400).json({ message: 'Ce membre est inactif' });
    }

    const book = await Book.findByPk(req.body.book_id);
    if (!book) {
      return res.status(400).json({ message: 'Livre introuvable' });
    }
    if (book.available_quantity < 1) {
      return res.status(400).json({ message: 'Livre non disponible' });
    }

    const borrow = await Borrow.create({
      member_id: req.body.member_id,
      book_id: req.body.book_id,
      borrow_date: new Date(),
      due_date: req.body.due_date,
      status: 'borrowed',
    });

    // On décrémente la quantité disponible
    await book.update({ available_quantity: book.available_quantity - 1 });

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
};

// ─── PUT /api/borrows/return/:id ───────────────────────────────────────────
const returnBook = async (req, res) => {
  try {
    const borrow = await Borrow.findByPk(req.params.id, {
      include: [{ model: Book, as: 'book' }],
    });

    if (!borrow) {
      return res.status(404).json({ message: 'Emprunt introuvable' });
    }

    if (borrow.status === 'returned') {
      return res.status(400).json({ message: 'Ce livre a déjà été retourné' });
    }

    await borrow.update({ return_date: new Date(), status: 'returned' });

    // On réincrémente la quantité disponible
    await borrow.book.update({
      available_quantity: borrow.book.available_quantity + 1,
    });

    return res.status(200).json({ message: 'Livre retourné avec succès', borrow });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { getAll, create, returnBook };
