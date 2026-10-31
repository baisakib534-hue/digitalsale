import type Database from 'better-sqlite3';

/**
 * Amazon-style merchandising badges (v7).
 * - best-seller: top products by paid revenue in the last 30 days
 * - trending: most paid orders in the last 7 days
 * - new: published within the last 14 days
 * Computed live from the orders table — no stored state to go stale.
 */

export type Badge = 'best-seller' | 'trending' | 'new';

export const BADGE_LABEL: Record<Badge, string> = {
  'best-seller': 'Best Seller',
  trending: 'Trending',
  new: 'New',
};

const BEST_SELLER_COUNT = 3;
const TRENDING_COUNT = 5;
const NEW_DAYS = 14;

/** Map of productId → badges, for published non-suspended products. */
export function getBadges(db: Database.Database): Map<string, Badge[]> {
  const map = new Map<string, Badge[]>();
  const add = (id: string, b: Badge) => {
    const list = map.get(id) ?? [];
    if (!list.includes(b)) list.push(b);
    map.set(id, list);
  };

  // Best sellers: top revenue, last 30 days.
  const sellers = db
    .prepare(
      `SELECT p.id AS id, SUM(o.amount_usd) AS revenue
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN stores s ON s.id = p.store_id
       WHERE o.status = 'paid'
         AND o.created_at > datetime('now', '-30 days')
         AND p.status = 'published' AND s.status != 'suspended'
       GROUP BY p.id
       ORDER BY revenue DESC
       LIMIT ?`
    )
    .all(BEST_SELLER_COUNT) as { id: string }[];
  for (const r of sellers) add(r.id, 'best-seller');

  // Trending: most orders, last 7 days.
  const trending = db
    .prepare(
      `SELECT p.id AS id, COUNT(*) AS n
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN stores s ON s.id = p.store_id
       WHERE o.status = 'paid'
         AND o.created_at > datetime('now', '-7 days')
         AND p.status = 'published' AND s.status != 'suspended'
       GROUP BY p.id
       ORDER BY n DESC
       LIMIT ?`
    )
    .all(TRENDING_COUNT) as { id: string }[];
  for (const r of trending) add(r.id, 'trending');

  // New arrivals: published in the last 14 days.
  const fresh = db
    .prepare(
      `SELECT p.id AS id
       FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE p.status = 'published' AND s.status != 'suspended'
         AND p.created_at > datetime('now', ?)`
    )
    .all(`-${NEW_DAYS} days`) as { id: string }[];
  for (const r of fresh) add(r.id, 'new');

  return map;
}

/** Ordered product IDs for the "Trending now" and "Best sellers" market sections. */
export function trendingIds(db: Database.Database, limit = 8): string[] {
  return (
    db
      .prepare(
        `SELECT p.id AS id
         FROM orders o
         JOIN products p ON p.id = o.product_id
         JOIN stores s ON s.id = p.store_id
         WHERE o.status = 'paid'
           AND o.created_at > datetime('now', '-7 days')
           AND p.status = 'published' AND s.status != 'suspended'
         GROUP BY p.id
         ORDER BY COUNT(*) DESC, p.created_at DESC
         LIMIT ?`
      )
      .all(limit) as { id: string }[]
  ).map((r) => r.id);
}

export function bestSellerIds(db: Database.Database, limit = 8): string[] {
  return (
    db
      .prepare(
        `SELECT p.id AS id
         FROM orders o
         JOIN products p ON p.id = o.product_id
         JOIN stores s ON s.id = p.store_id
         WHERE o.status = 'paid'
           AND o.created_at > datetime('now', '-30 days')
           AND p.status = 'published' AND s.status != 'suspended'
         GROUP BY p.id
         ORDER BY SUM(o.amount_usd) DESC, p.created_at DESC
         LIMIT ?`
      )
      .all(limit) as { id: string }[]
  ).map((r) => r.id);
}
