const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>
    if (!token) return res.status(401).json({ message: 'Access Token Required' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ message: 'Invalid Access Token' });
        req.user = user; // Attach user payload to request
        next();
    });
}



// Middleware to authorize admin users
function authorizeAdmin(req, res, next) {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin privileges required' });
    }
    next();
}


module.exports = { authenticateToken, authorizeAdmin };