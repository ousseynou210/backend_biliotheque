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
    req.user = user; // on attache l'utilisateur à la requête
    next(); // on laisse passer
  });
};




 /* Comment ça marche ?

Requête arrive
      ↓
Le videur regarde le header Authorization
      ↓
Pas de token ?  → ❌ Refusé (401)
Token invalide? → ❌ Refusé (401)
Token valide ?  → ✅ Laissé passer (next)
      ↓
La route s'exécute normalement
*/
