const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { authenticateToken, authorizeAdmin } = require('../middleware/auth');
const db = require('../config/database');

const router = express.Router();

// User Registration Endpoint (Admin Only)
router.post(
    '/register',
    authenticateToken,
    authorizeAdmin,
    [
        body('username').isLength({ min: 3 }).trim().escape(),
        body('password').isLength({ min: 6 }).trim(),
        body('role').optional().isIn(['user', 'admin']).trim().escape(),
    ],
    async (req, res) => {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        
        const { username, password, role } = req.body;

        try {
            // Check if user already exists
            const existingUser = await db.query('SELECT * FROM users WHERE username = $1', [username]);
            if (existingUser.rows.length > 0) {
                return res.status(409).json({ message: 'Username already exists' });
            }

            // Hash the password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Insert new user
            const result = await db.query(
                'INSERT INTO users (username, password, role) VALUES ($1, $2, $3) RETURNING username, role',
                [username, hashedPassword, role || 'user']
            );

            res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
        } catch (err) {
            console.error('Error registering user:', err.message);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
);


// User Login Endpoint
router.post(
    '/login',
    [
        body('username').isLength({ min: 3 }).trim().escape(),
        body('password').isLength({ min: 6 }).trim(),
    ],
    async (req, res) => {
        // Validate input
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const { username, password } = req.body;

        try {
            // Fetch user from database
            const userResult = await db.query('SELECT * FROM users WHERE username = $1', [username]);
            if (userResult.rows.length === 0) {
                return res.status(401).json({ message: 'Invalid Credentials' });
            }

            const user = userResult.rows[0];

            // Compare password
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ message: 'Invalid Credentials' });
            }

            // Generate JWT
            const token = jwt.sign(
                { username: user.username, role: user.role },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.json({ token });
        } catch (err) {
            console.error('Error during login:', err.message);
            res.status(500).json({ message: 'Internal Server Error' });
        }
    }
);


router.get('/profile', (req, res) => {
    const token = req.headers.authorization?.split(' ')[1]; // Get the token from the Authorization header
  
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
        if (err) {
          return res.status(403).json({ error: 'Failed to authenticate token' });
        }

        // Directly return the username and role from the token
        const { username, role } = decoded;

        res.json({
            username,
            role,
        });
    });
});




module.exports = router;
