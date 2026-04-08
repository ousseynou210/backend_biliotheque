const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getAll, create, returnBook } = require('../controllers/borrowController');

// IMPORTANT : /return/:id doit être AVANT /:id
// sinon Express interprète "return" comme un id numérique
router.get('/', auth, getAll);
router.post('/', auth, create);
router.put('/return/:id', auth, returnBook);

module.exports = router;
