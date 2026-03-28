const express = require('express');
const router = express.Router();
const { Op, fn, col, literal } = require('sequelize');
const auth = require('../middleware/auth');
const { Book, Member, Borrow, Category } = require('../models');

// ─── GET /api/stats/books ──────────────────────────────────────────────────
// Retourne les statistiques globales des livres
router.get('/books', auth, async (req, res) => {
  try {
    // 1. Compte le nombre total de livres enregistrés
    // COUNT(*) en SQL
    const totalBooks = await Book.count();

    // 2. Additionne toutes les available_quantity de tous les livres
    // fn('SUM', col('available_quantity')) = SUM(available_quantity) en SQL
    const totalAvailable = await Book.sum('available_quantity');

    // 3. Compte les emprunts actifs (status = "borrowed")
    const totalBorrowed = await Borrow.count({
      where: { status: 'borrowed' },
    });

    // 4. Compte le nombre de livres par catégorie
    // GROUP BY category_id en SQL
    const byCategory = await Book.findAll({
      attributes: [
        'category_id',
        // fn('COUNT', col('id')) = COUNT(id) en SQL
        [fn('COUNT', col('Book.id')), 'count'],
      ],
      include: [{
        model: Category,
        as: 'category',
        attributes: ['name'], // on veut juste le nom de la catégorie
      }],
      group: ['category_id', 'category.id', 'category.name'],
    });

    return res.status(200).json({
      totalBooks,
      totalAvailable,
      totalBorrowed,
      byCategory,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── GET /api/stats/members ────────────────────────────────────────────────
// Retourne les statistiques des membres
router.get('/members', auth, async (req, res) => {
  try {
    // 1. Compte le nombre total de membres
    const totalMembers = await Member.count();

    // 2. Compte les membres actifs
    const activeMembers = await Member.count({
      where: { status: 'active' },
    });

    // 3. Compte les membres inactifs
    const inactiveMembers = await Member.count({
      where: { status: 'inactive' },
    });

    return res.status(200).json({
      totalMembers,
      activeMembers,
      inactiveMembers,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── GET /api/stats/borrows ────────────────────────────────────────────────
// Retourne les statistiques des emprunts
router.get('/borrows', auth, async (req, res) => {
  try {
    // 1. Compte le total de tous les emprunts (toutes périodes)
    const totalBorrows = await Borrow.count();

    // 2. Compte les emprunts en cours
    const activeBorrows = await Borrow.count({
      where: { status: 'borrowed' },
    });

    // 3. Compte les emprunts terminés
    const returnedBorrows = await Borrow.count({
      where: { status: 'returned' },
    });

    // 4. Compte les emprunts en retard
    // Un emprunt est en retard si :
    // - son statut est "borrowed" (pas encore rendu)
    // - ET sa due_date est dépassée (inférieure à aujourd'hui)
    const overdueBorrows = await Borrow.count({
      where: {
        status: 'borrowed',
        due_date: { [Op.lt]: new Date() }, // Op.lt = "less than" = inférieur à
      },
    });

    // 5. Top 5 des livres les plus empruntés
    // GROUP BY book_id + ORDER BY count DESC + LIMIT 5
    const mostBorrowed = await Borrow.findAll({
      attributes: [
        'book_id',
        // On compte combien de fois chaque livre a été emprunté
        [fn('COUNT', col('Borrow.id')), 'borrow_count'],
      ],
      include: [{
        model: Book,
        as: 'book',
        attributes: ['title', 'author'],
      }],
      group: ['book_id', 'book.id', 'book.title', 'book.author'],
      order: [[literal('borrow_count'), 'DESC']], // du plus emprunté au moins
      limit: 5, // on ne prend que les 5 premiers
    });

    return res.status(200).json({
      totalBorrows,
      activeBorrows,
      returnedBorrows,
      overdueBorrows,
      mostBorrowed,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;