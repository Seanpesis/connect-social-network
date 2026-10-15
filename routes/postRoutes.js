const express = require('express');
const router = express.Router();
const postController = require('../controllers/postController');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/feed', postController.feed);
router.get('/mine', postController.mine);
router.get('/search', postController.search);
router.get('/stats', postController.stats);
router.get('/', postController.list);
router.post('/', postController.create);
router.put('/:id', postController.update);
router.delete('/:id', postController.remove);
router.post('/:id/like', postController.like);

module.exports = router;
