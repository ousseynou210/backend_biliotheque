const sequelize = require('../config/database');
const User = require('./User');
const Category = require('./Category');
const Book = require('./Book');
const Member = require('./Member');
const Borrow = require('./Borrow');

// Un livre appartient à une catégorie
Book.belongsTo(Category, { foreignKey: 'category_id', as: 'category' });
Category.hasMany(Book, { foreignKey: 'category_id', as: 'books' });

// Un emprunt appartient à un membre
Borrow.belongsTo(Member, { foreignKey: 'member_id', as: 'member' });
Member.hasMany(Borrow, { foreignKey: 'member_id', as: 'borrows' });

// Un emprunt appartient à un livre
Borrow.belongsTo(Book, { foreignKey: 'book_id', as: 'book' });
Book.hasMany(Borrow, { foreignKey: 'book_id', as: 'borrows' });

module.exports = { sequelize, User, Category, Book, Member, Borrow };