const jwt = require('jsonwebtoken');
require('dotenv').config();

module.exports = (req, res, next) => {
  // Récupère le token dans le header
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  // Pas de token = pas d'entrée
  if (!token) {
    return res.status(401).json({ message: 'Token manquant' });
  }

  // Vérifie que le token est valide
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ message: 'Token invalide' });
    }
    req.user = user; 
    next(); 
  });
};