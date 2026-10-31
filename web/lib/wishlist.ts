import type Database from 'better-sqlite3';

/** Wishlist (v11): buyers save products for later. */

export function isWishlisted(db: Database.Database, userId: string, productId: string): boolean {
  return !!db
    .prepare('SELECT 1 FROM wishlists WHERE user_id = ? AND product_id = ?')
    .get(userId, productId);
}

export function toggleWishlist(db: Database.Database, userId: string, productId: string): boolean {
  const existing = isWishlisted(db, userId, productId);
  if (existing) {
    db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?').run(userId, productId);
    return false;
  }
  db.prepare(
    "INSERT OR IGNORE INTO wishlists (user_id, product_id, created_at) VALUES (?, ?, datetime('now'))"
  ).run(userId, productId);
  return true;
}

export function wishlistFor(
  db: Database.Database,
  userId: string,
  productIds: string[]
): Set<string> {
  const set = new Set<string>();
  if (!userId || productIds.length === 0) return set;
  const placeholders = productIds.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT product_id FROM wishlists WHERE user_id = ? AND product_id IN (${placeholders})`)
    .all(userId, ...productIds) as { product_id: string }[];
  for (const r of rows) set.add(r.product_id);
  return set;
}
