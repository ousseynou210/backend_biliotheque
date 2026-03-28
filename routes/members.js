const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { Op } = require('sequelize');
const auth = require('../middleware/auth');
const { Member } = require('../models');

// ─── Schéma de validation ──────────────────────────────────────────────────
// On définit les règles que doivent respecter les données envoyées
const memberSchema = Joi.object({
  first_name: Joi.string().min(1).max(100).required(),
  last_name: Joi.string().min(1).max(100).required(),
  // format() vérifie que c'est bien un email valide ex: marie@gmail.com
  email: Joi.string().email().allow('', null),
  // max(20) car les numéros de tel ne dépassent pas 20 caractères
  phone: Joi.string().max(20).allow('', null),
  address: Joi.string().max(500).allow('', null),
  // iso() vérifie le format YYYY-MM-DD ex: 2024-01-15
  membership_date: Joi.date().iso().allow('', null),
  status: Joi.string().valid('active', 'inactive'),
});

// ─── GET /api/members ──────────────────────────────────────────────────────
// Retourne la liste des membres avec recherche, filtre et pagination
router.get('/', auth, async (req, res) => {
  try {
    // On récupère les paramètres depuis l'URL
    // ex: /api/members?search=marie&status=active&page=1&limit=10
    const { search, status, page = 1, limit = 10 } = req.query;

    // On construit les conditions de recherche dynamiquement
    const where = {};

    if (search) {
      // Op.or = cherche dans plusieurs colonnes en même temps
      // Op.like = SQL LIKE, le % veut dire "n'importe quoi avant/après"
      // ex: search="mar" va trouver "Marie", "Martin", "Lamar"...
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
      ];
    }

    // Si un filtre de statut est fourni, on l'ajoute aux conditions
    if (status) {
      where.status = status;
    }

    // Calcul de l'offset pour la pagination
    // ex: page=3, limit=10 → offset=20 → on saute les 20 premiers résultats
    const offset = (page - 1) * limit;

    // findAndCountAll retourne à la fois les données ET le total
    // utile pour calculer le nombre de pages
    const { count, rows } = await Member.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['last_name', 'ASC']], // classé par nom de famille alphabétiquement
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
});

// ─── POST /api/members ─────────────────────────────────────────────────────
// Crée un nouveau membre
router.post('/', auth, async (req, res) => {
  // 1. On valide les données reçues
  const { error } = memberSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    // 2. On crée le membre dans la base
    // Si membership_date n'est pas fourni, Sequelize met la date du jour (défaut du modèle)
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
    // Si l'email existe déjà dans la base (unique: true dans le modèle)
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ message: 'Cet email est déjà utilisé' });
    }
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

// ─── PUT /api/members/:id ──────────────────────────────────────────────────
// Modifie un membre existant
router.put('/:id', auth, async (req, res) => {
  // 1. On valide les données
  const { error } = memberSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      message: 'Données invalides',
      errors: error.details.map(d => d.message),
    });
  }

  try {
    // 2. On cherche le membre par son id dans l'URL
    const member = await Member.findByPk(req.params.id);

    // 3. S'il n'existe pas → erreur 404
    if (!member) {
      return res.status(404).json({ message: 'Membre introuvable' });
    }

    // 4. On met à jour uniquement les champs fournis
    // Si un champ n'est pas envoyé, on garde l'ancienne valeur avec "|| member.champ"
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
});

// ─── DELETE /api/members/:id ───────────────────────────────────────────────
// Supprime un membre
router.delete('/:id', auth, async (req, res) => {
  try {
    // 1. On cherche le membre
    const member = await Member.findByPk(req.params.id);

    // 2. S'il n'existe pas → 404
    if (!member) {
      return res.status(404).json({ message: 'Membre introuvable' });
    }

    // 3. On supprime
    await member.destroy();
    return res.status(200).json({ message: 'Membre supprimé' });
  } catch (err) {
    return res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
});

module.exports = router;