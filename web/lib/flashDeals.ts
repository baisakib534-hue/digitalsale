import type Database from 'better-sqlite3';
import { randomId } from './crypto';

export interface FlashDealRow {
  id: string;
  product_id: string;
  discount_percent: number;
  starts_at: string;
  ends_at: string;
  current_uses: number;
  start_post_sent: number;
  created_at: string;
}

/**
 * A live flash deal for a product: active, within its time window, and not ended.
 * Returns the deal row or null if no live deal exists.
 */
export function liveDealForProduct(
  db: Database.Database,
  productId: string,
  now: string = new Date().toISOString().slice(0, 19).replace('T', ' ')
): FlashDealRow | null {
  const row = db
    .prepare(
      `SELECT id, product_id, discount_percent, starts_at, ends_at, current_uses, start_post_sent, created_at
       FROM flash_deals
       WHERE product_id = ?
         AND starts_at <= ?
         AND ends_at > ?`
    )
    .get(productId, now, now) as FlashDealRow | undefined;
  return row ?? null;
}

/**
 * Check if a product has a live flash deal (convenience boolean).
 */
export function hasLiveDeal(
  db: Database.Database,
  productId: string,
  now?: string
): boolean {
  return liveDealForProduct(db, productId, now) !== null;
}

/**
 * Calculate the discounted price from a base price (in cents) and a discount percent.
 * Ensures a minimum of 1 cent (100% guard).
 */
export function discountedPrice(basePriceCents: number, discountPercent: number): number {
  const price = Math.round(basePriceCents * (1 - discountPercent / 100));
  return Math.max(1, price); // min 1 cent
}

/**
 * Get the effective checkout price for a product, considering flash deals.
 * If a live flash deal exists, returns the discounted price.
 * Does NOT consider discount codes — caller merges with validateDiscount.
 */
export function flashDealPrice(
  db: Database.Database,
  productId: string,
  basePriceCents: number,
  now?: string
): { finalPriceCents: number; discountPercent: number | null; dealId: string | null } {
  const deal = liveDealForProduct(db, productId, now);
  if (!deal) return { finalPriceCents: basePriceCents, discountPercent: null, dealId: null };
  return {
    finalPriceCents: discountedPrice(basePriceCents, deal.discount_percent),
    discountPercent: deal.discount_percent,
    dealId: deal.id,
  };
}

/**
 * Create a new flash deal for a product.
 * Enforces: one live deal per product at a time (UNIQUE product_id in DB).
 * Returns the created deal row, or throws if a deal already exists for the product.
 */
export function createFlashDeal(
  db: Database.Database,
  productId: string,
  discountPercent: number,
  startsAt: string,
  endsAt: string
): FlashDealRow {
  if (discountPercent < 5 || discountPercent > 90) {
    throw new Error('discount-percent-out-of-range');
  }
  if (startsAt >= endsAt) {
    throw new Error('invalid-time-window');
  }

  const id = randomId();
  db.prepare(
    `INSERT INTO flash_deals (id, product_id, discount_percent, starts_at, ends_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, productId, discountPercent, startsAt, endsAt);

  return {
    id,
    product_id: productId,
    discount_percent: discountPercent,
    starts_at: startsAt,
    ends_at: endsAt,
    current_uses: 0,
    start_post_sent: 0,
    created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
  };
}

/**
 * End a flash deal early by setting its ends_at to now.
 * Returns true if a deal was found and ended.
 */
export function endFlashDealEarly(
  db: Database.Database,
  productId: string,
  now: string = new Date().toISOString().slice(0, 19).replace('T', ' ')
): boolean {
  const result = db
    .prepare(`UPDATE flash_deals SET ends_at = ? WHERE product_id = ? AND ends_at > ?`)
    .run(now, productId, now);
  return result.changes > 0;
}

/**
 * Delete a flash deal entirely (seller cancels before it starts, or admin cleanup).
 */
export function deleteFlashDeal(db: Database.Database, productId: string): boolean {
  const result = db.prepare(`DELETE FROM flash_deals WHERE product_id = ?`).run(productId);
  return result.changes > 0;
}

/**
 * Get the flash deal for a product (any state — live, upcoming, or past).
 * Returns the deal row or null.
 */
export function getFlashDeal(db: Database.Database, productId: string): FlashDealRow | null {
  return db
    .prepare(
      `SELECT id, product_id, discount_percent, starts_at, ends_at, current_uses, start_post_sent, created_at
       FROM flash_deals WHERE product_id = ?`
    )
    .get(productId) as FlashDealRow | undefined ?? null;
}

/**
 * Check if a product is eligible for a flash deal (published, not suspended store).
 */
export function isProductEligibleForDeal(
  db: Database.Database,
  productId: string
): { ok: boolean; reason?: string } {
  const product = db
    .prepare(
      `SELECT p.id, p.status, p.store_id, s.status AS store_status
       FROM products p JOIN stores s ON s.id = p.store_id
       WHERE p.id = ?`
    )
    .get(productId) as { id: string; status: string; store_id: string; store_status: string } | undefined;

  if (!product) return { ok: false, reason: 'product-not-found' };
  if (product.status !== 'published') return { ok: false, reason: 'product-not-published' };
  if (product.store_status === 'suspended') return { ok: false, reason: 'store-suspended' };
  return { ok: true };
}

/**
 * Check if a seller is banned (their deals never go live).
 */
export function isSellerBanned(db: Database.Database, storeId: string): boolean {
  const row = db
    .prepare(`SELECT u.banned_at FROM stores s JOIN users u ON u.id = s.user_id WHERE s.id = ?`)
    .get(storeId) as { banned_at: string | null } | undefined;
  return !!row?.banned_at;
}

/**
 * Get all currently live flash deals (active, within time window).
 */
export function getActiveFlashDeals(
  db: Database.Database,
  now: string = new Date().toISOString().slice(0, 19).replace('T', ' ')
): FlashDealRow[] {
  return db
    .prepare(
      `SELECT id, product_id, discount_percent, starts_at, ends_at, current_uses, start_post_sent, created_at
       FROM flash_deals
       WHERE starts_at <= ? AND ends_at > ?`
    )
    .all(now, now) as FlashDealRow[];
}

/**
 * Mark the deal-start bot post as sent for a flash deal.
 */
export function markFlashDealStartPostSent(db: Database.Database, productId: string): boolean {
  const result = db
    .prepare(`UPDATE flash_deals SET start_post_sent = 1 WHERE product_id = ?`)
    .run(productId);
  return result.changes > 0;
}