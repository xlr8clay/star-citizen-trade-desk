const express = require('express');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Get all active listings with filters
router.get('/', (req, res) => {
  const { category, search, sort, minPrice, maxPrice, currency } = req.query;
  let query = 'SELECT l.*, u.username as seller_username, u.sc_handle, u.reputation FROM listings l JOIN users u ON l.seller_id = u.id WHERE l.status = ?';
  const params = ['active'];

  if (category && category !== 'all') {
    query += ' AND l.category = ?';
    params.push(category);
  }

  if (search) {
    query += ' AND (l.title LIKE ? OR l.item_name LIKE ? OR l.description LIKE ?)';
    const term = `%${search}%`;
    params.push(term, term, term);
  }

  if (currency === 'usd') {
    query += ' AND l.accept_usd = 1';
    if (minPrice) { query += ' AND l.price_usd >= ?'; params.push(Number(minPrice)); }
    if (maxPrice) { query += ' AND l.price_usd <= ?'; params.push(Number(maxPrice)); }
  } else if (currency === 'auec') {
    query += ' AND l.accept_auec = 1';
    if (minPrice) { query += ' AND l.price_auec >= ?'; params.push(Number(minPrice)); }
    if (maxPrice) { query += ' AND l.price_auec <= ?'; params.push(Number(maxPrice)); }
  }

  switch (sort) {
    case 'price_low': query += ' ORDER BY COALESCE(l.price_usd, 999999) ASC'; break;
    case 'price_high': query += ' ORDER BY COALESCE(l.price_usd, 0) DESC'; break;
    case 'oldest': query += ' ORDER BY l.created_at ASC'; break;
    default: query += ' ORDER BY l.created_at DESC';
  }

  const listings = db.prepare(query).all(...params);
  res.json(listings);
});

// Get single listing
router.get('/:id', (req, res) => {
  const listing = db.prepare(`
    SELECT l.*, u.username as seller_username, u.display_name as seller_display_name, 
           u.sc_handle, u.reputation 
    FROM listings l JOIN users u ON l.seller_id = u.id 
    WHERE l.id = ?
  `).get(req.params.id);

  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  res.json(listing);
});

// Create listing
router.post('/', requireAuth, (req, res) => {
  const { title, description, category, itemName, manufacturer, priceUsd, priceAuec, acceptUsd, acceptAuec, condition, imageUrl } = req.body;

  if (!title || !category || !itemName) {
    return res.status(400).json({ error: 'Title, category, and item name are required' });
  }

  if (!acceptUsd && !acceptAuec) {
    return res.status(400).json({ error: 'Must accept at least one payment type (USD or aUEC)' });
  }

  const result = db.prepare(`
    INSERT INTO listings (seller_id, title, description, category, item_name, manufacturer, price_usd, price_auec, accept_usd, accept_auec, condition, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.user.id, title, description || null, category, itemName,
    manufacturer || null, priceUsd || null, priceAuec || null,
    acceptUsd ? 1 : 0, acceptAuec ? 1 : 0, condition || 'new', imageUrl || null
  );

  res.json({ success: true, id: result.lastInsertRowid });
});

// Update listing
router.put('/:id', requireAuth, (req, res) => {
  const listing = db.prepare('SELECT * FROM listings WHERE id = ? AND seller_id = ?').get(req.params.id, req.user.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found or not yours' });

  const { title, description, category, itemName, manufacturer, priceUsd, priceAuec, acceptUsd, acceptAuec, condition, status, geUrl } = req.body;

  db.prepare(`
    UPDATE listings SET title = ?, description = ?, category = ?, item_name = ?, manufacturer = ?,
    price_usd = ?, price_auec = ?, accept_usd = ?, accept_auec = ?, condition = ?, status = ?, image_url = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title || listing.title, description ?? listing.description, category || listing.category,
    itemName || listing.item_name, manufacturer ?? listing.manufacturer,
    priceUsd ?? listing.price_usd, priceAuec ?? listing.price_auec,
    acceptUsd !== undefined ? (acceptUsd ? 1 : 0) : listing.accept_usd,
    acceptAuec !== undefined ? (acceptAuec ? 1 : 0) : listing.accept_auec,
    condition || listing.condition, status || listing.status, imageUrl ?? listing.image_url,
    req.params.id
  );

  res.json({ success: true });
});

// Delete listing
router.delete('/:id', requireAuth, (req, res) => {
  const result = db.prepare('UPDATE listings SET status = ? WHERE id = ? AND seller_id = ?').run('cancelled', req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Listing not found or not yours' });
  res.json({ success: true });
});

module.exports = router;
