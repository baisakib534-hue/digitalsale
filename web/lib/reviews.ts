import type Database from 'better-sqlite3';
import { randomId } from './crypto';

/**
 * Reviews & ratings (v11, Etsy-style).
 * One review per paid order — only verified buyers can review.
 */

export interface ReviewRow {
  id: string;
  product_id: string;
  order_id: string;
  buyer_id: string | null;
  rating: number;
  body: string;
  created_at: string;
}

export function productRating(
  db: Database.Database,
  productId: string
): { avg: number | null; count: number } {
  const row = db
    .prepare('SELECT COUNT(*) AS c, AVG(rating) AS a FROM reviews WHERE product_id = ?')
    .get(productId) as { c: number; a: number | null };
  return { avg: row.a === null ? null : Math.round(row.a * 10) / 10, count: row.c };
}

/** Ratings for many products at once (for cards). */
export function productRatings(
  db: Database.Database,
  productIds: string[]
): Map<string, { avg: number | null; count: number }> {
  const map = new Map<string, { avg: number | null; count: number }>();
  if (productIds.length === 0) return map;
  const placeholders = productIds.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT product_id, COUNT(*) AS c, AVG(rating) AS a
       FROM reviews WHERE product_id IN (${placeholders}) GROUP BY product_id`
    )
    .all(...productIds) as { product_id: string; c: number; a: number | null }[];
  for (const r of rows) {
    map.set(r.product_id, { avg: r.a === null ? null : Math.round(r.a * 10) / 10, count: r.c });
  }
  return map;
}

export type ReviewCheck =
  | { ok: true }
  | { ok: false; reason: 'no-order' | 'not-paid' | 'already-reviewed' | 'not-buyer' };

/** Can this user review this product with this order? */
export function canReview(
  db: Database.Database,
  productId: string,
  orderId: string,
  userId: string | null,
  userEmail: string
): ReviewCheck {
  const order = db.prepare('SELECT id, product_id, buyer_id, buyer_email, status FROM orders WHERE id = ?').get(
    orderId
  ) as
    | { id: string; product_id: string; buyer_id: string | null; buyer_email: string; status: string }
    | undefined;
  if (!order || order.product_id !== productId) return { ok: false, reason: 'no-order' };
  if (order.status !== 'paid') return { ok: false, reason: 'not-paid' };
  const isBuyer = (userId && order.buyer_id === userId) || (userEmail && order.buyer_email === userEmail);
  if (!isBuyer) return { ok: false, reason: 'not-buyer' };
  const existing = db.prepare('SELECT id FROM reviews WHERE order_id = ?').get(orderId);
  if (existing) return { ok: false, reason: 'already-reviewed' };
  return { ok: true };
}

export function createReview(
  db: Database.Database,
  productId: string,
  orderId: string,
  buyerId: string | null,
  rating: number,
  body: string
): ReviewRow {
  const id = randomId();
  db.prepare(
    `INSERT INTO reviews (id, product_id, order_id, buyer_id, rating, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, productId, orderId, buyerId, rating, body.slice(0, 1000));
  return db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as ReviewRow;
}
