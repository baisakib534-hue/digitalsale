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
  socials             TEXT NOT NULL DEFAULT '{}', -- v12: JSON {website,x,instagram,youtube,telegram}
  whitelabel_token    TEXT UNIQUE, -- v12: unique token for the chromeless storefront /s/[token]
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
  discount_code           TEXT,              -- v11: discount code used, if any
  discount_usd            INTEGER NOT NULL DEFAULT 0, -- v11: cents saved via discount
  flash_deal_id           TEXT,              -- v17: flash deal applied, if any
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

-- Discount codes (v11, Gumroad-style): per-product promo codes, percent or fixed.
CREATE TABLE IF NOT EXISTS discount_codes (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  code        TEXT NOT NULL, -- uppercase, unique per product
  kind        TEXT NOT NULL DEFAULT 'percent', -- percent | fixed
  value       INTEGER NOT NULL, -- percent 1-90, or fixed cents
  max_uses    INTEGER, -- NULL = unlimited
  used_count  INTEGER NOT NULL DEFAULT 0,
  active      INTEGER NOT NULL DEFAULT 1, -- 0 | 1
  expires_at  TEXT, -- NULL = never
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id, code)
);

CREATE INDEX IF NOT EXISTS idx_discount_codes_product ON discount_codes(product_id);

-- Flash deals (v17): time-boxed automatic discounts per product.
-- One live deal per product enforced by UNIQUE(product_id).
CREATE TABLE IF NOT EXISTS flash_deals (
  id                TEXT PRIMARY KEY,
  product_id        TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  discount_percent  INTEGER NOT NULL CHECK (discount_percent >= 5 AND discount_percent <= 90),
  starts_at         TEXT NOT NULL,
  ends_at           TEXT NOT NULL,
  current_uses      INTEGER NOT NULL DEFAULT 0, -- v17: tracks how many times deal was used
  start_post_sent   INTEGER NOT NULL DEFAULT 0, -- v17: 1 if deal-start bot post has been sent
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(product_id)
);

CREATE INDEX IF NOT EXISTS idx_flash_deals_time ON flash_deals(starts_at, ends_at);

-- Reviews & ratings (v11, Etsy-style): one review per paid order.
CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_id    TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  buyer_id    TEXT REFERENCES users(id),
  rating      INTEGER NOT NULL, -- 1..5
  body        TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);

-- Wishlist (v11): buyers save products for later.
CREATE TABLE IF NOT EXISTS wishlists (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id);

-- Seller profile images (v12): one logo + one banner per store.
CREATE TABLE IF NOT EXISTS store_images (
  id                  TEXT PRIMARY KEY,
  store_id            TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  kind                TEXT NOT NULL, -- logo | banner
  filename            TEXT NOT NULL,
  mime                TEXT NOT NULL,
  size                INTEGER NOT NULL,
  provider            TEXT NOT NULL DEFAULT 'local', -- local | telegram
  telegram_file_id    TEXT,
  telegram_message_id TEXT,
  local_path          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(store_id, kind)
);

-- Seller API tokens (v12): sellers list products from their own web app.
CREATE TABLE IF NOT EXISTS store_api_tokens (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE, -- dst_<random>
  name        TEXT NOT NULL DEFAULT '',
  revoked     INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_store_api_tokens_store ON store_api_tokens(store_id);

-- Seller bots (v12, bot stage): seller's own Telegram bot, registered via @Digitalsale_bot.
CREATE TABLE IF NOT EXISTS seller_bots (
  id           TEXT PRIMARY KEY,
  store_id     TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  bot_token_enc TEXT NOT NULL, -- encrypted with BOT_TOKEN_KEY
  bot_username TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'active', -- active | revoked
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(store_id)
);

-- Store channels (v12, bot stage): Telegram channels linked for auto-posting.
CREATE TABLE IF NOT EXISTS store_channels (
  id            TEXT PRIMARY KEY,
  store_id      TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  channel_id    TEXT NOT NULL, -- Telegram chat id
  channel_title TEXT NOT NULL DEFAULT '',
  auto_post     INTEGER NOT NULL DEFAULT 1, -- 0 | 1
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(store_id, channel_id)
);

-- Channel post queue (v12, bot stage): drained by the bot worker once live.
CREATE TABLE IF NOT EXISTS channel_post_queue (
  id          TEXT PRIMARY KEY,
  store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | posted | failed
  error       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_channel_post_queue_status ON channel_post_queue(status);

-- Bundles (v18): seller-curated groups of 2+ products sold at a single price.
-- One row per bundle; items stored in bundle_items with CASCADE on delete.
CREATE TABLE IF NOT EXISTS bundles (
  id           TEXT PRIMARY KEY,
  seller_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  price_cents  INTEGER NOT NULL, -- the ONE bundle price in cents
  cover_image  TEXT, -- optional cover image URL
  status       TEXT NOT NULL DEFAULT 'live', -- live | ended
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bundle_items (
  bundle_id  TEXT NOT NULL REFERENCES bundles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  PRIMARY KEY (bundle_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_bundles_seller ON bundles(seller_id);
CREATE INDEX IF NOT EXISTS idx_bundles_status ON bundles(status);
CREATE INDEX IF NOT EXISTS idx_bundle_items_product ON bundle_items(product_id);
