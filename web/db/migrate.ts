import type Database from 'better-sqlite3';
import { LEGACY_CATEGORY_MAP } from '../lib/categories';
import { randomBytes } from 'node:crypto';
import { canonicalGmail } from '../lib/email';

/**
 * Migration path for databases created by older versions of the app.
 * Runs after schema.sql (which is idempotent) on every boot.
 *
 * v2: affiliate tables + orders.affiliate_* columns + legacy category remap.
 * Safe to run repeatedly.
 */
export function runMigrations(db: Database.Database): void {
  // 1. New orders columns (SQLite has no ADD COLUMN IF NOT EXISTS).
  const cols = db.prepare('PRAGMA table_info(orders)').all() as { name: string }[];
  const names = new Set(cols.map((c) => c.name));
  if (cols.length > 0 && !names.has('affiliate_code')) {
    db.exec('ALTER TABLE orders ADD COLUMN affiliate_code TEXT');
  }
  if (cols.length > 0 && !names.has('affiliate_usd')) {
    db.exec('ALTER TABLE orders ADD COLUMN affiliate_usd INTEGER NOT NULL DEFAULT 0');
  }

  // 2. New tables are covered by schema.sql's CREATE TABLE IF NOT EXISTS.

  // 3. v3: new users columns for Telegram verification + canonical email.
  const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  const userNames = new Set(userCols.map((c) => c.name));
  if (userCols.length > 0) {
    if (!userNames.has('email_canonical')) {
      db.exec('ALTER TABLE users ADD COLUMN email_canonical TEXT');
    }
    if (!userNames.has('telegram_verified')) {
      db.exec('ALTER TABLE users ADD COLUMN telegram_verified INTEGER NOT NULL DEFAULT 0');
    }
    if (!userNames.has('telegram_username')) {
      db.exec('ALTER TABLE users ADD COLUMN telegram_username TEXT');
    }
    // Backfill canonical emails for pre-v3 accounts.
    const rows = db.prepare('SELECT id, email FROM users WHERE email_canonical IS NULL').all() as {
      id: string;
      email: string | null;
    }[];
    const backfill = db.prepare('UPDATE users SET email_canonical = ? WHERE id = ?');
    for (const r of rows) {
      if (!r.email) continue;
      const norm = canonicalGmail(r.email);
      if (norm) {
        try {
          backfill.run(norm.canonical, r.id);
        } catch {
          // Duplicate canonical across legacy rows — leave NULL, signup path enforces going forward.
        }
      }
    }
  }

  // 4. v4: products.flagged column for scam-phrase review flags.
  const prodCols = db.prepare('PRAGMA table_info(products)').all() as { name: string }[];
  const prodNames = new Set(prodCols.map((c) => c.name));
  if (prodCols.length > 0 && !prodNames.has('flagged')) {
    db.exec('ALTER TABLE products ADD COLUMN flagged INTEGER NOT NULL DEFAULT 0');
  }

  // 5. v4: stores.status for admin store suspension.
  const storeCols = db.prepare('PRAGMA table_info(stores)').all() as { name: string }[];
  if (storeCols.length > 0 && !storeCols.some((c) => c.name === 'status')) {
    db.exec("ALTER TABLE stores ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  }

  // 6. Remap legacy v1 category names to the v2 list.
  for (const [oldName, newName] of Object.entries(LEGACY_CATEGORY_MAP)) {
    if (oldName === newName) continue;
    db.prepare('UPDATE products SET category = ? WHERE category = ?').run(newName, oldName);
  }

  // 7. v6: products.video_url for the YouTube demo video.
  if (prodCols.length > 0 && !prodNames.has('video_url')) {
    db.exec('ALTER TABLE products ADD COLUMN video_url TEXT');
  }

  // 8. v7: products.stock_limit for seller-set buyer caps (NULL = unlimited).
  if (prodCols.length > 0 && !prodNames.has('stock_limit')) {
    db.exec('ALTER TABLE products ADD COLUMN stock_limit INTEGER');
  }

  // 9. v10: products.license_keys toggle (0 | 1).
  if (prodCols.length > 0 && !prodNames.has('license_keys')) {
    db.exec('ALTER TABLE products ADD COLUMN license_keys INTEGER NOT NULL DEFAULT 0');
  }

  // 10. v10: license_keys table.
  db.exec(`CREATE TABLE IF NOT EXISTS license_keys (
    id              TEXT PRIMARY KEY,
    product_id      TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id        TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    license_key     TEXT NOT NULL UNIQUE,
    status          TEXT NOT NULL DEFAULT 'active',
    activations     INTEGER NOT NULL DEFAULT 0,
    max_activations INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    revoked_at      TEXT
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_license_keys_product ON license_keys(product_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_license_keys_key ON license_keys(license_key)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_license_keys_order ON license_keys(order_id)');

  // 11. v11: discount_codes table + orders.discount_code/discount_usd.
  db.exec(`CREATE TABLE IF NOT EXISTS discount_codes (
    id          TEXT PRIMARY KEY,
    product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    code        TEXT NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'percent',
    value       INTEGER NOT NULL,
    max_uses    INTEGER,
    used_count  INTEGER NOT NULL DEFAULT 0,
    active      INTEGER NOT NULL DEFAULT 1,
    expires_at  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(product_id, code)
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_discount_codes_product ON discount_codes(product_id)');
  const orderCols = db.prepare('PRAGMA table_info(orders)').all() as { name: string }[];
  const orderNames = new Set(orderCols.map((c) => c.name));
  if (!orderNames.has('discount_code')) db.exec('ALTER TABLE orders ADD COLUMN discount_code TEXT');
  if (!orderNames.has('discount_usd')) db.exec('ALTER TABLE orders ADD COLUMN discount_usd INTEGER NOT NULL DEFAULT 0');

  // 12. v11: reviews table.
  db.exec(`CREATE TABLE IF NOT EXISTS reviews (
    id          TEXT PRIMARY KEY,
    product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id    TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    buyer_id    TEXT REFERENCES users(id),
    rating      INTEGER NOT NULL,
    body        TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id)');

  // 13. v11: wishlists table.
  db.exec(`CREATE TABLE IF NOT EXISTS wishlists (
    user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, product_id)
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_wishlists_user ON wishlists(user_id)');

  // 14. v12: stores.socials + stores.whitelabel_token.
  const storeColsV12 = db.prepare('PRAGMA table_info(stores)').all() as { name: string }[];
  const storeNames = new Set(storeColsV12.map((c) => c.name));
  if (!storeNames.has('socials')) db.exec("ALTER TABLE stores ADD COLUMN socials TEXT NOT NULL DEFAULT '{}'");
  if (!storeNames.has('whitelabel_token')) db.exec('ALTER TABLE stores ADD COLUMN whitelabel_token TEXT UNIQUE');
  // Backfill unique whitelabel tokens for existing stores.
  const missing = db
    .prepare('SELECT id FROM stores WHERE whitelabel_token IS NULL')
    .all() as { id: string }[];
  for (const s of missing) {
    db.prepare('UPDATE stores SET whitelabel_token = ? WHERE id = ?').run(
      `st_${randomBytes(18).toString('base64url')}`,
      s.id
    );
  }

  // 15. v12: store_images table.
  db.exec(`CREATE TABLE IF NOT EXISTS store_images (
    id                  TEXT PRIMARY KEY,
    store_id            TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    kind                TEXT NOT NULL,
    filename            TEXT NOT NULL,
    mime                TEXT NOT NULL,
    size                INTEGER NOT NULL,
    provider            TEXT NOT NULL DEFAULT 'local',
    telegram_file_id    TEXT,
    telegram_message_id TEXT,
    local_path          TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(store_id, kind)
  )`);

  // 16. v12: store_api_tokens table.
  db.exec(`CREATE TABLE IF NOT EXISTS store_api_tokens (
    id          TEXT PRIMARY KEY,
    store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    token       TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL DEFAULT '',
    revoked     INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_store_api_tokens_store ON store_api_tokens(store_id)');

  // 17. v12: seller_bots + store_channels + channel_post_queue (bot stage).
  db.exec(`CREATE TABLE IF NOT EXISTS seller_bots (
    id           TEXT PRIMARY KEY,
    store_id     TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    bot_token_enc TEXT NOT NULL,
    bot_username TEXT NOT NULL DEFAULT '',
    status       TEXT NOT NULL DEFAULT 'active',
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(store_id)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS store_channels (
    id            TEXT PRIMARY KEY,
    store_id      TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    channel_id    TEXT NOT NULL,
    channel_title TEXT NOT NULL DEFAULT '',
    auto_post     INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(store_id, channel_id)
  )`);
  db.exec(`CREATE TABLE IF NOT EXISTS channel_post_queue (
    id          TEXT PRIMARY KEY,
    store_id    TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id  TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'pending',
    error       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('CREATE INDEX IF NOT EXISTS idx_channel_post_queue_status ON channel_post_queue(status)');
}
