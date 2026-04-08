const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { upload, getAll, create, update, remove } = require('../controllers/bookController');

router.get('/', auth, getAll);
router.post('/', auth, upload.single('cover_image'), create);
router.put('/:id', auth, upload.single('cover_image'), update);
router.delete('/:id', auth, remove);

module.exports = router;
