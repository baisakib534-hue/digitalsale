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
  custom_slug: string | null;
  theme_json: string | null;
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

/**
 * v13: white-label lookup by token OR custom slug. Custom slugs never contain
 * '_' so they can never collide with st_… tokens. Only active stores.
 */
export function getStoreByWhiteLabel(db: Database.Database, tokenOrSlug: string): StoreRow | undefined {
  if (!tokenOrSlug) return undefined;
  if (tokenOrSlug.startsWith('st_')) return getStoreByToken(db, tokenOrSlug);
  const slug = normalizeCustomSlug(tokenOrSlug);
  if (!slug.ok) return undefined;
  const row = db
    .prepare('SELECT * FROM stores WHERE custom_slug = ? AND status = ?')
    .get(slug.value, 'active') as StoreRow | undefined;
  return row;
}

/* ------------------------------------------------------------------ */
/* v13: customizable store links — /s/<custom-slug>, unique per store.  */
/* ------------------------------------------------------------------ */

/** Slugs that would shadow real site routes — never assignable to a store. */
const RESERVED_SLUGS = new Set([
  'api', 's', 'auth', 'market', 'dashboard', 'sell', 'product', 'products',
  'store', 'stores', 'checkout', 'wishlist', 'affiliates', 'affiliate',
  'docs', 'account', 'settings', 'admin', 'support', 'help', 'login',
  'signup', 'signin', 'signout', 'logout', 'static', 'assets', 'images',
  'favicon.ico', 'robots.txt', 'sitemap.xml', 'about', 'terms', 'privacy',
  'contact', 'blog', 'new', 'edit', 'create', 'search', 'cart', 'orders',
  'purchases', 'sales', 'payouts', 'notifications', 'messages', 'invite',
  'verify', 'confirm', 'reset', 'callback', 'webhook', 'health', 'status',
  'www', 'app', 'dev', 'test', 'demo', 'null', 'undefined',
]);

export type SlugCheck = { ok: true; value: string } | { ok: false; reason: 'empty' | 'invalid' | 'reserved' | 'taken' };

/** Validate + canonicalize a custom store slug. Uniqueness is checked by setCustomSlug. */
export function normalizeCustomSlug(raw: unknown): SlugCheck {
  const s = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (!s) return { ok: false, reason: 'empty' };
  if (s.length < 3 || s.length > 30 || !/^[a-z0-9]([a-z0-9-]{1,28}[a-z0-9])?$/.test(s)) {
    return { ok: false, reason: 'invalid' };
  }
  if (RESERVED_SLUGS.has(s)) return { ok: false, reason: 'reserved' };
  return { ok: true, value: s };
}

/**
 * Claim (or release with null) a store's custom slug. First come, first served —
 * the UNIQUE index guarantees no two stores share a link.
 */
export function setCustomSlug(
  db: Database.Database,
  storeId: string,
  raw: unknown
): { ok: true } | { ok: false; reason: 'empty' | 'invalid' | 'reserved' | 'taken' } {
  if (raw === null || (typeof raw === 'string' && raw.trim() === '')) {
    db.prepare('UPDATE stores SET custom_slug = NULL WHERE id = ?').run(storeId);
    return { ok: true };
  }
  const check = normalizeCustomSlug(raw);
  if (!check.ok) return check;
  const clash = db
    .prepare('SELECT id FROM stores WHERE custom_slug = ? AND id != ?')
    .get(check.value, storeId) as { id: string } | undefined;
  if (clash) return { ok: false, reason: 'taken' };
  try {
    db.prepare('UPDATE stores SET custom_slug = ? WHERE id = ?').run(check.value, storeId);
  } catch {
    return { ok: false, reason: 'taken' };
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* v13: storefront theme customizer (Shopify-style, simplified).        */
/* ------------------------------------------------------------------ */

export interface StoreTheme {
  /** Accent color hex, e.g. #EA580C. */
  accent: string;
  /** Storefront color scheme: follow the site theme, or force light/dark. */
  mode: 'auto' | 'light' | 'dark';
  /** Product grid layout. */
  layout: 'grid' | 'list';
  /** Show the banner hero. */
  showBanner: boolean;
  /** Show the social links row. */
  showSocials: boolean;
}

export const DEFAULT_THEME: StoreTheme = {
  accent: '#EA580C',
  mode: 'auto',
  layout: 'grid',
  showBanner: true,
  showSocials: true,
};

const ACCENT_PRESETS = new Set([
  '#EA580C', '#DC2626', '#D97706', '#CA8A04', '#65A30D', '#16A34A',
  '#0D9488', '#0891B2', '#2563EB', '#4F46E5', '#9333EA', '#DB2777',
  '#1C1917', '#64748B',
]);

/** Parse stored theme_json safely, falling back to defaults. */
export function parseTheme(raw: string | null): StoreTheme {
  if (!raw) return { ...DEFAULT_THEME };
  try {
    const t = normalizeTheme(JSON.parse(raw));
    return t;
  } catch {
    return { ...DEFAULT_THEME };
  }
}

/** Sanitize seller-supplied theme input — never trust it verbatim. */
export function normalizeTheme(input: unknown): StoreTheme {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  let accent = typeof o.accent === 'string' ? o.accent.trim() : DEFAULT_THEME.accent;
  if (!/^#[0-9a-fA-F]{6}$/.test(accent)) accent = DEFAULT_THEME.accent;
  // Only allowlisted presets or any valid hex — custom hex is fine, it is just a color.
  const mode = o.mode === 'light' || o.mode === 'dark' ? o.mode : 'auto';
  const layout = o.layout === 'list' ? 'list' : 'grid';
  return {
    accent: accent.toUpperCase(),
    mode,
    layout,
    showBanner: o.showBanner === false ? false : true,
    showSocials: o.showSocials === false ? false : true,
  };
}

export function themeAccentPresets(): string[] {
  return [...ACCENT_PRESETS];
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
  productId: string,
  kind: 'new' | 'milestone' = 'new'
): boolean {
  const channels = db
    .prepare('SELECT id FROM store_channels WHERE store_id = ? AND auto_post = 1')
    .all(storeId) as { id: string }[];
  if (channels.length === 0) return false;
  const existing = db
    .prepare("SELECT id FROM channel_post_queue WHERE product_id = ? AND kind = ? AND status = 'pending'")
    .get(productId, kind);
  if (existing) return true;
  db.prepare(
    `INSERT INTO channel_post_queue (id, store_id, product_id, kind, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', datetime('now'))`
  ).run(randomId(), storeId, productId, kind);
  return true;
}

/**
 * Best-seller milestone: call after an order is marked paid. When the
 * product's paid-order count hits 10 / 25 / 50 / 100 / 250 / 500 / 1000,
 * queue a 'milestone' celebration post (seller's own bot, own channels).
 */
export function checkMilestone(
  db: Database.Database,
  storeId: string,
  productId: string
): number | null {
  const MILESTONES = [10, 25, 50, 100, 250, 500, 1000];
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM orders WHERE product_id = ? AND status = 'paid'`)
    .get(productId) as { n: number };
  if (!MILESTONES.includes(row.n)) return null;
  queueChannelPost(db, storeId, productId, 'milestone');
  return row.n;
}
