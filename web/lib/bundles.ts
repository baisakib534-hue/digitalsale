import type Database from 'better-sqlite3';
import { flashDealPrice } from './flashDeals';

export interface Bundle {
  id: string;
  seller_id: string;
  name: string;
  description: string;
  price_cents: number;
  cover_image: string | null;
  status: 'live' | 'ended';
  created_at: string;
  updated_at: string;
}

export interface BundleItem {
  bundle_id: string;
  product_id: string;
}

export interface BundleWithItems extends Bundle {
  items: BundleItem[];
}

export interface ProductPrice {
  product_id: string;
  price_cents: number;
  effective_price_cents: number;
  flash_deal_id: string | null;
}

/**
 * Fetch all items (product_ids) for a bundle.
 */
export function bundleItems(db: Database.Database, bundleId: string): string[] {
  const rows = db
    .prepare('SELECT product_id FROM bundle_items WHERE bundle_id = ? ORDER BY product_id')
    .all(bundleId) as { product_id: string }[];
  return rows.map((r) => r.product_id);
}

/**
 * Compute the sum of CURRENT effective prices for all products in a bundle.
 * Applies live flash deals to each product.
 * Returns { sumCents, breakdown } where breakdown is per-product detail.
 */
export function bundleSumCents(
  db: Database.Database,
  bundleId: string,
  now: string = new Date().toISOString().slice(0, 19).replace('T', ' ')
): { sumCents: number; breakdown: ProductPrice[] } {
  const productIds = bundleItems(db, bundleId);
  if (productIds.length === 0) return { sumCents: 0, breakdown: [] };

  const placeholders = productIds.map(() => '?').join(',');
  const productRows = db
    .prepare(
      `SELECT id, price_usd, status FROM products WHERE id IN (${placeholders})`
    )
    .all(...productIds) as { id: string; price_usd: number; status: string }[];

  const breakdown: ProductPrice[] = [];

  for (const p of productRows) {
    if (p.status !== 'published') {
      breakdown.push({
        product_id: p.id,
        price_cents: p.price_usd,
        effective_price_cents: p.price_usd,
        flash_deal_id: null,
      });
      continue;
    }

    const { finalPriceCents, dealId } = flashDealPrice(db, p.id, p.price_usd, now);
    breakdown.push({
      product_id: p.id,
      price_cents: p.price_usd,
      effective_price_cents: finalPriceCents,
      flash_deal_id: dealId,
    });
  }

  const sumCents = breakdown.reduce((acc, b) => acc + b.effective_price_cents, 0);
  return { sumCents, breakdown };
}

/**
 * Effective price the buyer pays for a bundle:
 * min(bundle.price_cents, bundleSumCents(...))
 * Lower price wins — exactly like the deal-vs-code rule.
 */
export function effectiveBundlePrice(
  db: Database.Database,
  bundleId: string,
  now: string = new Date().toISOString().slice(0, 19).replace('T', ' ')
): { chargedCents: number; winner: 'bundle' | 'sum'; sumCents: number; breakdown: ProductPrice[] } {
  const bundle = db
    .prepare('SELECT * FROM bundles WHERE id = ?')
    .get(bundleId) as Bundle | undefined;
  if (!bundle) {
    throw new Error('Bundle not found');
  }

  if (bundle.status !== 'live') {
    throw new Error('Bundle is not live');
  }

  const { sumCents, breakdown } = bundleSumCents(db, bundleId, now);
  const bundlePrice = bundle.price_cents;

  if (sumCents <= 0) {
    throw new Error('Bundle has no valid items');
  }

  const chargedCents = Math.min(bundlePrice, sumCents);
  const winner = chargedCents === bundlePrice ? 'bundle' : 'sum';

  // Min 1 cent guard
  const finalCents = Math.max(1, chargedCents);

  return { chargedCents: finalCents, winner, sumCents, breakdown };
}

/**
 * Validate a bundle for creation:
 * - 2-20 products
 * - All products belong to the same seller
 * - Bundle price < sum of individual current prices (at creation time)
 * - All products are published
 */
export function validateBundleForCreation(
  db: Database.Database,
  sellerId: string,
  productIds: string[],
  bundlePriceCents: number
): { valid: boolean; reason?: string; sumCents: number } {
  if (productIds.length < 2 || productIds.length > 20) {
    return { valid: false, reason: 'A bundle must contain 2 to 20 products', sumCents: 0 };
  }

  const placeholders = productIds.map(() => '?').join(',');
  const products = db
    .prepare(
      `SELECT id, store_id, price_usd, status FROM products WHERE id IN (${placeholders})`
    )
    .all(...productIds) as { id: string; store_id: string; price_usd: number; status: string }[];

  if (products.length !== productIds.length) {
    return { valid: false, reason: 'One or more products not found', sumCents: 0 };
  }

  for (const p of products) {
    if (p.store_id !== sellerId) {
      return { valid: false, reason: 'All products in a bundle must belong to the same seller', sumCents: 0 };
    }
    if (p.status !== 'published') {
      return { valid: false, reason: 'All products in a bundle must be published', sumCents: 0 };
    }
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let sumCents = 0;
  for (const p of products) {
    const { finalPriceCents } = flashDealPrice(db, p.id, p.price_usd, now);
    sumCents += finalPriceCents;
  }

  if (bundlePriceCents >= sumCents) {
    return {
      valid: false,
      reason: `Bundle price must be lower than buying separately (sum is ${formatUsd(sumCents)})`,
      sumCents,
    };
  }

  return { valid: true, sumCents };
}

/**
 * Create a new bundle with items.
 */
export function createBundle(
  db: Database.Database,
  sellerId: string,
  name: string,
  description: string,
  priceCents: number,
  productIds: string[],
  coverImage: string | null = null
): Bundle {
  const validation = validateBundleForCreation(db, sellerId, productIds, priceCents);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

  db.prepare(
    `INSERT INTO bundles (id, seller_id, name, description, price_cents, cover_image, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'live', ?, ?)`
  ).run(id, sellerId, name, description, priceCents, coverImage, now, now);

  const insertItem = db.prepare('INSERT INTO bundle_items (bundle_id, product_id) VALUES (?, ?)');
  for (const pid of productIds) {
    insertItem.run(id, pid);
  }

  return {
    id,
    seller_id: sellerId,
    name,
    description,
    price_cents: priceCents,
    cover_image: coverImage,
    status: 'live',
    created_at: now,
    updated_at: now,
  };
}

/**
 * Get a bundle by ID with its items.
 */
export function getBundle(db: Database.Database, bundleId: string): BundleWithItems | null {
  const bundle = db
    .prepare('SELECT * FROM bundles WHERE id = ?')
    .get(bundleId) as Bundle | undefined;
  if (!bundle) return null;

  const items = db
    .prepare('SELECT bundle_id, product_id FROM bundle_items WHERE bundle_id = ?')
    .all(bundleId) as BundleItem[];

  return { ...bundle, items };
}

/**
 * Get all live bundles for a seller.
 */
export function getSellerBundles(db: Database.Database, sellerId: string): BundleWithItems[] {
  const bundles = db
    .prepare('SELECT * FROM bundles WHERE seller_id = ? AND status = \'live\' ORDER BY created_at DESC')
    .all(sellerId) as Bundle[];

  const result: BundleWithItems[] = [];
  for (const b of bundles) {
    const items = db
      .prepare('SELECT bundle_id, product_id FROM bundle_items WHERE bundle_id = ?')
      .all(b.id) as BundleItem[];
    result.push({ ...b, items });
  }
  return result;
}

/**
 * End a bundle (mark as ended, hide from buyer surfaces).
 */
export function endBundle(db: Database.Database, bundleId: string, sellerId: string): boolean {
  const result = db
    .prepare('UPDATE bundles SET status = \'ended\', updated_at = ? WHERE id = ? AND seller_id = ?')
    .run(new Date().toISOString().slice(0, 19).replace('T', ' '), bundleId, sellerId);
  return result.changes > 0;
}

/**
 * Check if a seller is banned (their bundles never go live).
 */
export function isSellerBanned(db: Database.Database, storeId: string): boolean {
  const row = db
    .prepare(`SELECT u.banned_at FROM stores s JOIN users u ON u.id = s.user_id WHERE s.id = ?`)
    .get(storeId) as { banned_at: string | null } | undefined;
  return !!row?.banned_at;
}

/**
 * Format cents as USD string.
 */
export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Compute savings display string for a bundle.
 */
export function savingsDisplay(bundlePriceCents: number, sumCents: number): string {
  const savings = sumCents - bundlePriceCents;
  if (savings <= 0) return '';
  const pct = Math.round((savings / sumCents) * 100);
  return `Bundle of ${pct}% · Save ${formatUsd(savings)}`;
}