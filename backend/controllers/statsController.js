const { Op, fn, col, literal } = require('sequelize');
const { Book, Member, Borrow, Category } = require('../models');

// ─── GET /api/stats/books ──────────────────────────────────────────────────
const getBookStats = async (req, res) => {
  try {
    const totalBooks = await Book.count();
    const totalAvailable = await Book.sum('available_quantity');
    const totalBorrowed = await Borrow.count({ where: { status: 'borrowed' } });

    const byCategory = await Book.findAll({
      attributes: [
        'category_id',
        [fn('COUNT', col('Book.id')), 'count'],
      ],
      include: [{
        model: Category,
        as: 'category',
        attributes: ['name'],
      }],
      group: ['category_id', 'category.id', 'category.name'],
    });

    return res.status(200).json({ totalBooks, totalAvailable, totalBorrowed, byCategory });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── GET /api/stats/members ────────────────────────────────────────────────
const getMemberStats = async (req, res) => {
  try {
    const totalMembers = await Member.count();
    const activeMembers = await Member.count({ where: { status: 'active' } });
    const inactiveMembers = await Member.count({ where: { status: 'inactive' } });

    return res.status(200).json({ totalMembers, activeMembers, inactiveMembers });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── GET /api/stats/borrows ────────────────────────────────────────────────
const getBorrowStats = async (req, res) => {
  try {
    const totalBorrows = await Borrow.count();
    const activeBorrows = await Borrow.count({ where: { status: 'borrowed' } });
    const returnedBorrows = await Borrow.count({ where: { status: 'returned' } });
    const overdueBorrows = await Borrow.count({
      where: {
        status: 'borrowed',
        due_date: { [Op.lt]: new Date() },
      },
    });

    const mostBorrowed = await Borrow.findAll({
      attributes: [
        'book_id',
        [fn('COUNT', col('Borrow.id')), 'borrow_count'],
      ],
      include: [{
        model: Book,
        as: 'book',
        attributes: ['title', 'author'],
      }],
      group: ['book_id', 'book.id', 'book.title', 'book.author'],
      order: [[literal('borrow_count'), 'DESC']],
      limit: 5,
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
};

module.exports = { getBookStats, getMemberStats, getBorrowStats };
