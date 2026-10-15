function requireLogin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: 'Please log in first' });
    }
    next();
}

module.exports = { requireLogin };
