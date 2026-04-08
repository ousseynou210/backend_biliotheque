const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getBookStats, getMemberStats, getBorrowStats } = require('../controllers/statsController');

router.get('/books', auth, getBookStats);
router.get('/members', auth, getMemberStats);
router.get('/borrows', auth, getBorrowStats);

module.exports = router;
