import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import { randomId } from './crypto';

/**
 * Software license keys (v10, Gumroad-style).
 * Sellers toggle "License keys" per product; each paid order gets one unique
 * key, and the seller's app verifies it via POST /api/licenses/verify.
 */

// Unambiguous alphabet: no 0/O, 1/I/L.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateLicenseKey(): string {
  const bytes = randomBytes(16);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [0, 1, 2, 3].map((g) => chars.slice(g * 4, g * 4 + 4).join('')).join('-');
}

export interface LicenseRow {
  id: string;
  product_id: string;
  order_id: string;
  license_key: string;
  status: string;
  activations: number;
  max_activations: number | null;
  created_at: string;
}

/** Issue a key for a paid order. Idempotent — returns the existing key if any. */
export function issueLicenseKey(
  db: Database.Database,
  productId: string,
  orderId: string
): LicenseRow {
  const existing = db
    .prepare('SELECT * FROM license_keys WHERE order_id = ?')
    .get(orderId) as LicenseRow | undefined;
  if (existing) return existing;

  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateLicenseKey();
    try {
      const id = randomId();
      db.prepare(
        `INSERT INTO license_keys (id, product_id, order_id, license_key, status, activations, created_at)
         VALUES (?, ?, ?, ?, 'active', 0, datetime('now'))`
      ).run(id, productId, orderId, key);
      return db.prepare('SELECT * FROM license_keys WHERE id = ?').get(id) as LicenseRow;
    } catch (err) {
      // UNIQUE collision on the key — retry with a fresh one.
      if (!(err as Error).message.includes('UNIQUE')) throw err;
    }
  }
  throw new Error('license-key-collision');
}

export type VerifyResult =
  | { valid: true; product_id: string; order_id: string; activations: number }
  | { valid: false; reason: 'not-found' | 'revoked' | 'product-mismatch' | 'seats-exhausted' };

/** Verify a key, optionally scoped to one product. Counts a successful activation. */
export function verifyLicenseKey(
  db: Database.Database,
  key: string,
  productId?: string
): VerifyResult {
  const row = db
    .prepare('SELECT * FROM license_keys WHERE license_key = ?')
    .get(key.trim().toUpperCase()) as LicenseRow | undefined;
  if (!row) return { valid: false, reason: 'not-found' };
  if (row.status !== 'active') return { valid: false, reason: 'revoked' };
  if (productId && row.product_id !== productId) {
    return { valid: false, reason: 'product-mismatch' };
  }
  if (row.max_activations !== null && row.activations >= row.max_activations) {
    return { valid: false, reason: 'seats-exhausted' };
  }
  db.prepare('UPDATE license_keys SET activations = activations + 1 WHERE id = ?').run(row.id);
  return { valid: true, product_id: row.product_id, order_id: row.order_id, activations: row.activations + 1 };
}

export function revokeLicenseKey(db: Database.Database, id: string): boolean {
  const r = db
    .prepare("UPDATE license_keys SET status = 'revoked', revoked_at = datetime('now') WHERE id = ? AND status = 'active'")
    .run(id);
  return r.changes > 0;
}
