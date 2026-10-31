-- Mosshaw schema (SQLite, better-sqlite3, WAL mode)
-- Applied idempotently on every boot via lib/db.ts.

CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT UNIQUE,
  email_canonical   TEXT UNIQUE, -- gmail canonical form: dots removed, +tag stripped
  password_hash     TEXT,
  telegram_id       TEXT UNIQUE,
  telegram_username TEXT,
  telegram_verified INTEGER NOT NULL DEFAULT 0, -- 0 | 1, mandatory before selling
  name              TEXT NOT NULL DEFAULT '',
  avatar_url        TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Signup rate limiting (v3): one row per attempt, pruned after 24h.
CREATE TABLE IF NOT EXISTS signup_attempts (
  id         TEXT PRIMARY KEY,
  ip_hash    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Telegram verification tokens for the @Digitalsale_bot deep-link flow (v3).
CREATE TABLE IF NOT EXISTS verification_tokens (
  token      TEXT PRIMARY KEY, -- 32 hex chars
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS stores (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,
  bio                 TEXT NOT NULL DEFAULT '',
  avatar_url          TEXT,
  banner_url          TEXT,
  payout_usdt_address TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT 'active', -- active | suspended (v4 admin action)
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_usd   INTEGER NOT NULL DEFAULT 0, -- price in cents
  category    TEXT NOT NULL DEFAULT 'Misc',
  tags        TEXT NOT NULL DEFAULT '',  -- comma-separated
  cover_url   TEXT,
  video_url   TEXT, -- YouTube watch/embed URL for the product demo video (v6)
  stock_limit INTEGER, -- v7: max buyers (NULL = unlimited)
  license_keys INTEGER NOT NULL DEFAULT 0, -- v10: issue a license key per paid order (0 | 1)
  status      TEXT NOT NULL DEFAULT 'draft', -- draft | published | suspended
  flagged     INTEGER NOT NULL DEFAULT 0, -- 1 = scam-phrase review flag (v4, not public)
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(store_id, slug)
);

-- Trust & safety reports (v4)
CREATE TABLE IF NOT EXISTS reports (
  id               TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type      TEXT NOT NULL, -- 'product' | 'store'
  target_id        TEXT NOT NULL,
  reason           TEXT NOT NULL, -- scam | malware | fake | copyright | prohibited | other
  details          TEXT NOT NULL DEFAULT '',
  status           TEXT NOT NULL DEFAULT 'open', -- open | reviewed | actioned | dismissed
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scan_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT,
  filename   TEXT NOT NULL DEFAULT '',
  reasons    TEXT NOT NULL DEFAULT '[]', -- JSON array
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_files (
  id                 TEXT PRIMARY KEY,
  product_id         TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filename           TEXT NOT NULL,
  mime               TEXT NOT NULL DEFAULT 'application/octet-stream',
  size               INTEGER NOT NULL DEFAULT 0,
  provider           TEXT NOT NULL DEFAULT 'local', -- telegram | local
  telegram_file_id   TEXT,
  telegram_message_id INTEGER,
  local_path         TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Product gallery images (v6): seller-uploaded pictures shown on the product
-- page. Stored via the same file archive as product_files (local/Telegram).
CREATE TABLE IF NOT EXISTS product_images (
  id                 TEXT PRIMARY KEY,
  product_id         TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  filename           TEXT NOT NULL,
  mime               TEXT NOT NULL DEFAULT 'image/jpeg',
  size               INTEGER NOT NULL DEFAULT 0,
  provider           TEXT NOT NULL DEFAULT 'local', -- telegram | local
  telegram_file_id   TEXT,
  telegram_message_id INTEGER,
  local_path         TEXT,
  position           INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id                      TEXT PRIMARY KEY,
  product_id              TEXT NOT NULL REFERENCES products(id),
  buyer_id                TEXT REFERENCES users(id),
  buyer_email             TEXT NOT NULL DEFAULT '',
  amount_usd              INTEGER NOT NULL, -- cents, what buyer pays
  fee_usd                 INTEGER NOT NULL, -- cents, platform fee (10%)
  seller_usd              INTEGER NOT NULL, -- cents, seller share
  affiliate_code          TEXT,              -- ref code that drove this sale, if any
  affiliate_usd           INTEGER NOT NULL DEFAULT 0, -- cents, affiliate cut
  status                  TEXT NOT NULL DEFAULT 'pending', -- pending | paid | failed
  nowpayments_invoice_id  TEXT,
  created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Affiliate program (v2)
CREATE TABLE IF NOT EXISTS affiliates (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code                TEXT NOT NULL UNIQUE, -- 8-char URL-safe ref code
  payout_usdt_address TEXT NOT NULL DEFAULT '',
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_affiliates (
  product_id         TEXT PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  enabled            INTEGER NOT NULL DEFAULT 0, -- 0 | 1
  commission_percent REAL NOT NULL DEFAULT 20,   -- seller-set, 5–60
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS affiliate_clicks (
  id         TEXT PRIMARY KEY,
  code       TEXT NOT NULL,
  product_id TEXT, -- NULL for storefront-level clicks (/?ref=CODE)
  ip_hash    TEXT NOT NULL, -- sha256, never a raw IP
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_files_product ON product_files(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_stores_user ON stores(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliates_code ON affiliates(code);
CREATE INDEX IF NOT EXISTS idx_clicks_code_product ON affiliate_clicks(code, product_id);
CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id, status);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_user_id);

-- Software license keys (v10, Gumroad-style): one key per paid order, optional
-- per product. Sellers verify keys from their apps via POST /api/licenses/verify.
CREATE TABLE IF NOT EXISTS license_keys (
  id              TEXT PRIMARY KEY,
  product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id        TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  license_key     TEXT NOT NULL UNIQUE, -- e.g. 7KQ2-9F3M-X8PD-2RTV
  status          TEXT NOT NULL DEFAULT 'active', -- active | revoked
  activations     INTEGER NOT NULL DEFAULT 0, -- successful verify calls
  max_activations INTEGER, -- NULL = unlimited seats
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  revoked_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_license_keys_product ON license_keys(product_id);
CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_license_keys_order ON license_keys(order_id);
