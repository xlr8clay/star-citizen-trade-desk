const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'tradedesk.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT,
    sc_handle TEXT,
    reputation INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK(category IN ('ship', 'vehicle', 'weapon', 'armor', 'component', 'commodity', 'other')),
    item_name TEXT NOT NULL,
    manufacturer TEXT,
    price_usd REAL,
    price_auec INTEGER,
    accept_usd INTEGER DEFAULT 0,
    accept_auec INTEGER DEFAULT 0,
    condition TEXT DEFAULT 'new' CHECK(condition IN ('new', 'used', 'upgraded')),
    image_url TEXT,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'sold', 'reserved', 'cancelled')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (seller_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (listing_id) REFERENCES listings(id),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reviewer_id INTEGER NOT NULL,
    reviewed_id INTEGER NOT NULL,
    listing_id INTEGER,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_id) REFERENCES users(id),
    FOREIGN KEY (listing_id) REFERENCES listings(id)
  );

  CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
  CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category);
  CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings(seller_id);
  CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
`);

module.exports = db;
