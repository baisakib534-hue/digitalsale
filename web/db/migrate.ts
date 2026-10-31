import type Database from 'better-sqlite3';
import { LEGACY_CATEGORY_MAP } from '../lib/categories';
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
}
