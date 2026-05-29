const express = require('express');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get conversations (grouped by other user)
router.get('/', requireAuth, (req, res) => {
  const conversations = db.prepare(`
    SELECT 
      CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END as other_user_id,
      u.username as other_username,
      u.display_name as other_display_name,
      MAX(m.created_at) as last_message_at,
      SUM(CASE WHEN m.receiver_id = ? AND m.read = 0 THEN 1 ELSE 0 END) as unread_count
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END
    WHERE m.sender_id = ? OR m.receiver_id = ?
    GROUP BY other_user_id
    ORDER BY last_message_at DESC
  `).all(req.user.id, req.user.id, req.user.id, req.user.id, req.user.id);

  res.json(conversations);
});

// Get messages with a specific user
router.get('/:userId', requireAuth, (req, res) => {
  const messages = db.prepare(`
    SELECT m.*, u.username as sender_username
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE (m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
  `).all(req.user.id, req.params.userId, req.params.userId, req.user.id);

  // Mark as read
  db.prepare('UPDATE messages SET read = 1 WHERE sender_id = ? AND receiver_id = ?').run(req.params.userId, req.user.id);

  res.json(messages);
});

// Send message
router.post('/', requireAuth, (req, res) => {
  const { receiverId, content, listingId } = req.body;

  if (!receiverId || !content) {
    return res.status(400).json({ error: 'Receiver and content are required' });
  }

  if (Number(receiverId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot message yourself' });
  }

  const receiver = db.prepare('SELECT id FROM users WHERE id = ?').get(receiverId);
  if (!receiver) return res.status(404).json({ error: 'Receiver not found' });

  const result = db.prepare(
    'INSERT INTO messages (listing_id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)'
  ).run(listingId || null, req.user.id, receiverId, content);

  res.json({ success: true, id: result.lastInsertRowid });
});

// Get unread count
router.get('/unread/count', requireAuth, (req, res) => {
  const result = db.prepare('SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND read = 0').get(req.user.id);
  res.json({ count: result.count });
});

module.exports = router;
