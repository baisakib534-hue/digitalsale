import type Database from 'better-sqlite3';
import { createHash, randomBytes } from 'node:crypto';
import { parseCookies } from './auth';
import { BRAND } from './brand';

/**
 * Gumroad-style affiliate program.
 *
 * Money math (documented in code + UI, tested exactly):
 *   Sale price P (cents). Platform takes 10% of P.
 *   If the product has affiliates enabled and the order carries a valid ref
 *   code, the affiliate earns `commission_percent` (set by the SELLER, 5–60%)
 *   of P. The seller gets P − platform_fee − affiliate_cut.
 *   Example: $100.00 sale, 20% affiliate →
 *     affiliate $20.00, platform $10.00, seller $70.00.
 */

export const REF_COOKIE = 'mosshaw_ref';
export const REF_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const MIN_COMMISSION = 5;
export const MAX_COMMISSION = 60;
export const DEFAULT_COMMISSION = 20;

/** Seller-set commission must be 5–60 (percent of the sale price). */
export function validateCommission(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= MIN_COMMISSION &&
    value <= MAX_COMMISSION
  );
}

/**
 * Full sale split. Throws on out-of-range commission.
 * Guarantees platform + affiliate + seller === amountCents.
 */
export function splitSale(
  amountCents: number,
  commissionPercent: number,
  feePercent: number = BRAND.feePercent
): { platform: number; affiliate: number; seller: number } {
  if (!validateCommission(commissionPercent)) {
    throw new Error(`commission must be between ${MIN_COMMISSION} and ${MAX_COMMISSION}`);
  }
  if (!Number.isInteger(amountCents) || amountCents < 0) {
    throw new Error('amount must be a non-negative integer of cents');
  }
  const platform = Math.round((amountCents * feePercent) / 100);
  const affiliate = Math.round((amountCents * commissionPercent) / 100);
  return { platform, affiliate, seller: amountCents - platform - affiliate };
}

/** 8-char URL-safe affiliate code. The caller checks DB uniqueness. */
export function genAffiliateCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = randomBytes(8);
  let code = '';
  for (const b of bytes) code += alphabet[b % alphabet.length];
  return code;
}

/** One-way hash of a client IP for click dedupe (privacy: never store raw IPs). */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`mosshaw-click:${ip}`).digest('hex');
}

/**
 * Record an affiliate click. Dedupe: one counted click per
 * (code, product, ip_hash) per rolling 24h. Returns true when counted.
 */
export function recordClick(
  db: Database.Database,
  code: string,
  productId: string | null,
  ip: string
): boolean {
  const ipHash = hashIp(ip);
  const recent = db
    .prepare(
      `SELECT id FROM affiliate_clicks
       WHERE code = ? AND COALESCE(product_id, '') = COALESCE(?, '')
         AND ip_hash = ? AND created_at >= datetime('now', '-1 day')
       LIMIT 1`
    )
    .get(code, productId, ipHash);
  if (recent) return false;
  db.prepare(
    `INSERT INTO affiliate_clicks (id, code, product_id, ip_hash, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(
    randomBytes(8).toString('hex'),
    code,
    productId,
    ipHash
  );
  return true;
}

/** Set-cookie header for the 30-day affiliate ref cookie (httpOnly). */
export function setRefCookieHeader(code: string): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${REF_COOKIE}=${encodeURIComponent(code)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${REF_TTL_SECONDS}${secure}`;
}

export function clearRefCookieHeader(): string {
  return `${REF_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Read the ref code from a Request's Cookie header. */
export function getRefCode(req: Request): string | null {
  const cookies = parseCookies(req.headers.get('cookie'));
  const code = cookies[REF_COOKIE];
  return code && code.length > 0 ? code : null;
}

export interface AffiliateAttribution {
  code: string;
  affiliateUsd: number;
  commissionPercent: number;
}

/**
 * Resolve attribution for a checkout: the ref code must belong to a real
 * affiliate AND the product must have affiliates enabled. Returns null when
 * either check fails (invalid codes are ignored silently).
 */
export function resolveAffiliate(
  db: Database.Database,
  productId: string,
  amountCents: number,
  refCode: string | null
): AffiliateAttribution | null {
  if (!refCode) return null;
  const aff = db.prepare('SELECT code FROM affiliates WHERE code = ?').get(refCode) as
    | { code: string }
    | undefined;
  if (!aff) return null;
  const pa = db
    .prepare('SELECT enabled, commission_percent FROM product_affiliates WHERE product_id = ?')
    .get(productId) as { enabled: number; commission_percent: number } | undefined;
  if (!pa || pa.enabled !== 1 || !validateCommission(pa.commission_percent)) return null;
  const affiliateUsd = Math.round((amountCents * pa.commission_percent) / 100);
  return { code: aff.code, affiliateUsd, commissionPercent: pa.commission_percent };
}
