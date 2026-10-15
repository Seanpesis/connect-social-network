const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { requireLogin } = require('../middleware/auth');

router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/logout', userController.logout);
router.get('/me', requireLogin, userController.me);
router.get('/search', requireLogin, userController.search);
router.get('/', requireLogin, userController.list);
router.put('/:id', requireLogin, userController.update);
router.delete('/:id', requireLogin, userController.remove);

module.exports = router;
