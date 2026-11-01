import { randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import { randomId } from './crypto';

/**
 * Seller profiles + white-label storefronts + seller API tokens (v12).
 */

export interface StoreSocials {
  website?: string;
  x?: string;
  instagram?: string;
  youtube?: string;
  telegram?: string;
}

const SOCIAL_KEYS = ['website', 'x', 'instagram', 'youtube', 'telegram'] as const;

/** Parse the stored socials JSON safely. */
export function parseSocials(raw: string | null): StoreSocials {
  if (!raw) return {};
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    const out: StoreSocials = {};
    for (const k of SOCIAL_KEYS) {
      if (typeof obj[k] === 'string' && obj[k].trim() !== '') {
        out[k] = (obj[k] as string).trim().slice(0, 200);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/** Normalize seller-submitted socials: trim, drop empties, require sane shape. */
export function normalizeSocials(input: unknown): StoreSocials {
  if (typeof input !== 'object' || input === null) return {};
  const obj = input as Record<string, unknown>;
  const out: StoreSocials = {};
  for (const k of SOCIAL_KEYS) {
    const v = typeof obj[k] === 'string' ? obj[k].trim() : '';
    if (!v) continue;
    if (k === 'website' || k === 'youtube') {
      if (!/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(v)) continue;
    } else {
      // handles: @name or name or full URL
      if (!/^@?[A-Za-z0-9_.]{1,40}$/.test(v) && !/^https?:\/\/\S+$/i.test(v)) continue;
    }
    out[k] = v.slice(0, 200);
  }
  return out;
}

/** Public URL for a social entry. */
export function socialUrl(key: keyof StoreSocials, value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  const handle = value.replace(/^@/, '');
  switch (key) {
    case 'x':
      return `https://x.com/${handle}`;
    case 'instagram':
      return `https://instagram.com/${handle}`;
    case 'telegram':
      return `https://t.me/${handle}`;
    default:
      return value;
  }
}

/** Fresh unique white-label token: st_<32 url-safe chars>. */
export function newWhitelabelToken(): string {
  return `st_${randomBytes(24).toString('base64url')}`;
}

export interface StoreRow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  socials: string;
  whitelabel_token: string | null;
  payout_usdt_address: string;
  status: string;
}

/** Chromeless storefront lookup: /s/[token]. Only active stores. */
export function getStoreByToken(db: Database.Database, token: string): StoreRow | undefined {
  if (!token || !/^st_[A-Za-z0-9_-]{16,64}$/.test(token)) return undefined;
  const row = db
    .prepare('SELECT * FROM stores WHERE whitelabel_token = ? AND status = ?')
    .get(token, 'active') as StoreRow | undefined;
  return row;
}

/** Seller API auth: Bearer dst_<token> → active store. */
export function getStoreByApiToken(
  db: Database.Database,
  bearer: string | null
): StoreRow | undefined {
  if (!bearer || !bearer.startsWith('dst_')) return undefined;
  const tok = db
    .prepare('SELECT store_id FROM store_api_tokens WHERE token = ? AND revoked = 0')
    .get(bearer) as { store_id: string } | undefined;
  if (!tok) return undefined;
  db.prepare("UPDATE store_api_tokens SET last_used_at = datetime('now') WHERE token = ?").run(bearer);
  const store = db.prepare('SELECT * FROM stores WHERE id = ? AND status = ?').get(tok.store_id, 'active') as
    | StoreRow
    | undefined;
  return store;
}

export function createStoreApiToken(
  db: Database.Database,
  storeId: string,
  name: string
): { id: string; token: string } {
  const id = randomId();
  const token = `dst_${randomBytes(24).toString('base64url')}`;
  db.prepare(
    `INSERT INTO store_api_tokens (id, store_id, token, name, revoked, created_at)
     VALUES (?, ?, ?, ?, 0, datetime('now'))`
  ).run(id, storeId, token, name.slice(0, 60));
  return { id, token };
}

export function revokeStoreApiToken(db: Database.Database, storeId: string, id: string): boolean {
  return db
    .prepare('UPDATE store_api_tokens SET revoked = 1 WHERE id = ? AND store_id = ?')
    .run(id, storeId).changes > 0;
}

/**
 * Bot stage: queue a channel post when a product is published and the store
 * has auto-post channels linked.
 *
 * IMPORTANT: posts go out through the SELLER'S OWN bot (seller_bots.bot_token_enc),
 * never through @Digitalsale_bot. Our bot only registers seller bots and handles
 * commands; the queue worker posts to each seller's channel with that seller's token.
 */
export function queueChannelPost(
  db: Database.Database,
  storeId: string,
  productId: string
): boolean {
  const channels = db
    .prepare('SELECT id FROM store_channels WHERE store_id = ? AND auto_post = 1')
    .all(storeId) as { id: string }[];
  if (channels.length === 0) return false;
  const existing = db
    .prepare("SELECT id FROM channel_post_queue WHERE product_id = ? AND status = 'pending'")
    .get(productId);
  if (existing) return true;
  db.prepare(
    `INSERT INTO channel_post_queue (id, store_id, product_id, status, created_at)
     VALUES (?, ?, ?, 'pending', datetime('now'))`
  ).run(randomId(), storeId, productId);
  return true;
}
