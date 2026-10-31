import type Database from 'better-sqlite3';

/**
 * Stock limits for digital products (v7).
 * Sellers can cap how many buyers a product is sold to: stock_limit NULL =
 * unlimited, otherwise the cap. A product is "sold out" when paid orders
 * plus recent pending orders (invoice window) reach the cap.
 */

const PENDING_WINDOW_MINUTES = 60;

export interface StockInfo {
  stockLimit: number | null;
  sold: number;
  soldOut: boolean;
  remaining: number | null;
}

/** Count buyers holding stock: paid orders + pending orders inside the invoice window. */
export function soldCount(db: Database.Database, productId: string): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM orders
       WHERE product_id = ?
         AND (status = 'paid'
              OR (status = 'pending' AND created_at > datetime('now', ?)))`
    )
    .get(productId, `-${PENDING_WINDOW_MINUTES} minutes`) as { c: number };
  return row.c;
}

export function stockInfo(
  db: Database.Database,
  product: { id: string; stock_limit: number | null }
): StockInfo {
  const limit = product.stock_limit;
  if (limit === null || limit === undefined) {
    return { stockLimit: null, sold: 0, soldOut: false, remaining: null };
  }
  const sold = soldCount(db, product.id);
  const soldOut = sold >= limit;
  return { stockLimit: limit, sold, soldOut, remaining: Math.max(0, limit - sold) };
}

/** Normalize seller input: on/off toggle + number → NULL (unlimited) or positive int. */
export function normalizeStockLimit(input: unknown): number | null | 'invalid' {
  if (input === undefined || input === null || input === '') return null;
  const n = typeof input === 'number' ? input : Number(input);
  if (!Number.isInteger(n) || n <= 0) return 'invalid';
  if (n > 1000000) return 'invalid';
  return n;
}
