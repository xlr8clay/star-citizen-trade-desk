const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName, scHandle } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, display_name, sc_handle) VALUES (?, ?, ?, ?, ?)'
    ).run(username, email, passwordHash, displayName || username, scHandle || null);

    const token = jwt.sign(
      { id: result.lastInsertRowid, username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user: { id: result.lastInsertRowid, username, displayName: displayName || username } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(username, username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.json({ success: true, user: { id: user.id, username: user.username, displayName: user.display_name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

// Get current user
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, username, email, display_name, sc_handle, reputation, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Get user profile
router.get('/profile/:username', (req, res) => {
  const user = db.prepare('SELECT id, username, display_name, sc_handle, reputation, created_at FROM users WHERE username = ?').get(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const listings = db.prepare('SELECT * FROM listings WHERE seller_id = ? AND status = ? ORDER BY created_at DESC').all(user.id, 'active');
  const reviews = db.prepare(`
    SELECT r.*, u.username as reviewer_username 
    FROM reviews r JOIN users u ON r.reviewer_id = u.id 
    WHERE r.reviewed_id = ? ORDER BY r.created_at DESC LIMIT 20
  `).all(user.id);

  res.json({ user, listings, reviews });
});

module.exports = router;
