const Joi = require('joi');
const { Op } = require('sequelize');
const { Member } = require('../models');

// ─── Schéma de validation ──────────────────────────────────────────────────
const memberSchema = Joi.object({
  first_name: Joi.string().min(1).max(100).required(),
  last_name: Joi.string().min(1).max(100).required(),
  email: Joi.string().email().allow('', null),
  phone: Joi.string().max(20).allow('', null),
  address: Joi.string().max(500).allow('', null),
  membership_date: Joi.date().iso().allow('', null),
  status: Joi.string().valid('active', 'inactive'),
});

// ─── GET /api/members ──────────────────────────────────────────────────────
const getAll = async (req, res) => {
  try {
    const { search, status, page = 1, limit = 10 } = req.query;

    const where = {};

    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const offset = (page - 1) * limit;

    const { count, rows } = await Member.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['last_name', 'ASC']],
    });

    return res.status(200).json({
      total: count,
      page: parseInt(page),
      totalPages: Math.ceil(count / limit),
      members: rows,
    });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── POST /api/members ─────────────────────────────────────────────────────
const create = async (req, res) => {
  const { error } = memberSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    const member = await Member.create({
      first_name: req.body.first_name,
      last_name: req.body.last_name,
      email: req.body.email || null,
      phone: req.body.phone || null,
      address: req.body.address || null,
      membership_date: req.body.membership_date || new Date(),
      status: req.body.status || 'active',
    });

    return res.status(201).json(member);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── PUT /api/members/:id ──────────────────────────────────────────────────
const update = async (req, res) => {
  const { error } = memberSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    const member = await Member.findByPk(req.params.id);
    if (!member) {
      return res.status(404).json({ message: 'Membre introuvable' });
    }

    await member.update({
      first_name: req.body.first_name || member.first_name,
      last_name: req.body.last_name || member.last_name,
      email: req.body.email || member.email,
      phone: req.body.phone || member.phone,
      address: req.body.address || member.address,
      membership_date: req.body.membership_date || member.membership_date,
      status: req.body.status || member.status,
    });

    return res.status(200).json(member);
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

// ─── DELETE /api/members/:id ───────────────────────────────────────────────
const remove = async (req, res) => {
  try {
    const member = await Member.findByPk(req.params.id);
    if (!member) {
      return res.status(404).json({ message: 'Membre introuvable' });
    }

    await member.destroy();
    return res.status(200).json({ message: 'Membre supprimé' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};

module.exports = { getAll, create, update, remove };
