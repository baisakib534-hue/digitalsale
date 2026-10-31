import type Database from 'better-sqlite3';
import { randomId } from './crypto';

/**
 * Discount codes (v11, Gumroad-style).
 * Sellers create per-product promo codes (percent or fixed amount);
 * buyers apply them at checkout.
 */

export interface DiscountRow {
  id: string;
  product_id: string;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  max_uses: number | null;
  used_count: number;
  active: number;
  expires_at: string | null;
}

/** Normalize a user-typed code: uppercase, trimmed. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9-]{1,22}[A-Z0-9]$/.test(code)) return null;
  return code;
}

export type ValidateResult =
  | { ok: true; row: DiscountRow; finalPriceCents: number; discountCents: number }
  | { ok: false; reason: 'invalid-code' | 'not-found' | 'inactive' | 'expired' | 'exhausted' };

/** Validate a code against a product and compute the discounted price (cents). */
export function validateDiscount(
  db: Database.Database,
  productId: string,
  priceCents: number,
  rawCode: unknown
): ValidateResult {
  const code = normalizeCode(rawCode);
  if (!code) return { ok: false, reason: 'invalid-code' };
  const row = db
    .prepare('SELECT * FROM discount_codes WHERE product_id = ? AND code = ?')
    .get(productId, code) as DiscountRow | undefined;
  if (!row) return { ok: false, reason: 'not-found' };
  if (row.active !== 1) return { ok: false, reason: 'inactive' };
  if (row.expires_at && row.expires_at < new Date().toISOString().slice(0, 19).replace('T', ' ')) {
    return { ok: false, reason: 'expired' };
  }
  if (row.max_uses !== null && row.used_count >= row.max_uses) {
    return { ok: false, reason: 'exhausted' };
  }
  let final: number;
  if (row.kind === 'percent') {
    final = Math.round((priceCents * (100 - Math.min(90, Math.max(1, row.value)))) / 100);
  } else {
    final = priceCents - Math.max(1, row.value);
  }
  final = Math.max(1, final); // never free — payment rails need a positive amount
  return { ok: true, row, finalPriceCents: final, discountCents: priceCents - final };
}

export function createDiscount(
  db: Database.Database,
  productId: string,
  code: string,
  kind: 'percent' | 'fixed',
  value: number,
  maxUses: number | null,
  expiresAt: string | null
): DiscountRow {
  const id = randomId();
  db.prepare(
    `INSERT INTO discount_codes (id, product_id, code, kind, value, max_uses, used_count, active, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, datetime('now'))`
  ).run(id, productId, code, kind, value, maxUses, expiresAt);
  return db.prepare('SELECT * FROM discount_codes WHERE id = ?').get(id) as DiscountRow;
}

export function incrementDiscountUse(db: Database.Database, discountId: string): void {
  db.prepare('UPDATE discount_codes SET used_count = used_count + 1 WHERE id = ?').run(discountId);
}

export function deactivateDiscount(db: Database.Database, discountId: string): boolean {
  return db.prepare('UPDATE discount_codes SET active = 0 WHERE id = ?').run(discountId).changes > 0;
}
