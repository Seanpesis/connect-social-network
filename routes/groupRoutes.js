const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { requireLogin } = require('../middleware/auth');

router.use(requireLogin);

router.get('/categories', groupController.categories);
router.get('/search', groupController.search);
router.get('/', groupController.list);
router.post('/', groupController.create);
router.put('/:id', groupController.update);
router.delete('/:id', groupController.remove);
router.post('/:id/join', groupController.join);
router.post('/:id/leave', groupController.leave);

module.exports = router;
