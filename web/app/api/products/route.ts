import { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '../../../lib/db';
import { randomId } from '../../../lib/crypto';
import { slugify } from '../../../lib/format';
import { getSessionUserId } from '../../../lib/auth';
import { requireVerified } from '../../../lib/verify';
import { archiveProduct } from '../../../lib/channelStore';
import { CATEGORIES, isCategory } from '../../../lib/categories';
import { validateCommission, DEFAULT_COMMISSION } from '../../../lib/affiliate';
import { scanListingText } from '../../../lib/scamPatterns';
import { parseYouTubeId, youTubeWatchUrl } from '../../../lib/video';
import { normalizeStockLimit } from '../../../lib/stock';

interface ProductRow {
  id: string;
  store_id: string;
  title: string;
  slug: string;
  description: string;
  price_usd: number;
  category: string;
  tags: string;
  cover_url: string | null;
  status: string;
  flagged: number;
  affiliate_enabled: number | null;
  affiliate_commission: number | null;
  created_at: string;
  store_name: string;
  store_slug: string;
}

const AFFILIATE_JOIN = `LEFT JOIN product_affiliates pa ON pa.product_id = p.id`;

const PUBLIC_SELECT = `SELECT p.id, p.store_id, p.title, p.slug, p.description, p.price_usd,
    p.category, p.tags, p.cover_url, p.video_url, p.stock_limit, p.status,
    pa.enabled AS affiliate_enabled, pa.commission_percent AS affiliate_commission,
    p.created_at, s.name AS store_name, s.slug AS store_slug
  FROM products p JOIN stores s ON s.id = p.store_id ${AFFILIATE_JOIN}`; // flagged is never public

const SELLER_SELECT = `SELECT p.id, p.store_id, p.title, p.slug, p.description, p.price_usd,
    p.category, p.tags, p.cover_url, p.video_url, p.stock_limit, p.status, p.flagged,
    pa.enabled AS affiliate_enabled, pa.commission_percent AS affiliate_commission,
    p.created_at, s.name AS store_name, s.slug AS store_slug
  FROM products p JOIN stores s ON s.id = p.store_id ${AFFILIATE_JOIN}`;

function uniqueProductSlug(db: Database.Database, storeId: string, base: string): string {
  let slug = base || 'product';
  let n = 2;
  while (db.prepare('SELECT id FROM products WHERE store_id = ? AND slug = ?').get(storeId, slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function getOrigin(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

/**
 * GET /api/products
 *   ?mine=1[&status=] — auth; the seller's own products, all statuses
 *   ?published=1[&q=&category=&sort=] — public list (market page uses server DB directly)
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const db = getDb();

  if (url.searchParams.get('mine') === '1') {
    const uid = getSessionUserId(req);
    if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const status = url.searchParams.get('status');
    let sql = `${SELLER_SELECT} WHERE s.user_id = ?`;
    const params: unknown[] = [uid];
    if (status === 'draft' || status === 'published') {
      sql += ' AND p.status = ?';
      params.push(status);
    }
    sql += ' ORDER BY p.created_at DESC';
    const products = db.prepare(sql).all(...params) as ProductRow[];
    return NextResponse.json({ products });
  }

  if (url.searchParams.get('published') === '1') {
    let sql = `${PUBLIC_SELECT} WHERE p.status = 'published' AND s.status != 'suspended'`;
    const params: unknown[] = [];
    const category = url.searchParams.get('category') ?? '';
    if (isCategory(category)) {
      sql += ' AND p.category = ?';
      params.push(category);
    }
    const q = (url.searchParams.get('q') ?? '').trim();
    if (q) {
      sql += ' AND (p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    const sort = url.searchParams.get('sort');
    sql +=
      sort === 'price-asc'
        ? ' ORDER BY p.price_usd ASC'
        : sort === 'price-desc'
          ? ' ORDER BY p.price_usd DESC'
          : ' ORDER BY p.created_at DESC';
    const products = db.prepare(sql).all(...params) as ProductRow[];
    return NextResponse.json({ products });
  }

  return NextResponse.json({ error: 'use ?mine=1 or ?published=1' }, { status: 400 });
}

interface ProductBody {
  title?: unknown;
  description?: unknown;
  price?: unknown;
  category?: unknown;
  tags?: unknown;
  status?: unknown;
  videoUrl?: unknown;
  affiliateEnabled?: unknown;
  affiliateCommission?: unknown;
  stockLimit?: unknown;
}

export async function POST(req: Request) {
  const db = getDb();
  const gated = requireVerified(db, req);
  if (gated instanceof NextResponse) return gated;
  const { uid } = gated;

  let body: ProductBody;
  try {
    body = (await req.json()) as ProductBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  const price = typeof body.price === 'number' ? body.price : Number(body.price);
  const category = typeof body.category === 'string' ? body.category : '';
  const tags = typeof body.tags === 'string' ? body.tags.trim() : '';
  const status = body.status === 'published' ? 'published' : 'draft';
  // v6: optional YouTube demo video — stored as the canonical watch URL.
  let videoUrl: string | null = null;
  if (body.videoUrl !== undefined && body.videoUrl !== null && String(body.videoUrl).trim() !== '') {
    const vid = parseYouTubeId(body.videoUrl);
    if (!vid) return NextResponse.json({ error: 'invalid-video-url' }, { status: 400 });
    videoUrl = youTubeWatchUrl(vid);
  }
  const affiliateEnabled = body.affiliateEnabled === true;
  const commission =
    typeof body.affiliateCommission === 'number' && validateCommission(body.affiliateCommission)
      ? body.affiliateCommission
      : DEFAULT_COMMISSION;
  // v7: optional buyer cap — null = unlimited.
  const stockLimit = normalizeStockLimit(body.stockLimit);
  if (stockLimit === 'invalid') return NextResponse.json({ error: 'invalid-stock-limit' }, { status: 400 });

  if (title.length < 3) return NextResponse.json({ error: 'invalid-title' }, { status: 400 });
  if (!Number.isFinite(price) || price <= 0)
    return NextResponse.json({ error: 'invalid-price' }, { status: 400 });
  if (!isCategory(category))
    return NextResponse.json({ error: 'invalid-category', valid: CATEGORIES }, { status: 400 });

  const store = db
    .prepare('SELECT id, name, slug FROM stores WHERE user_id = ?')
    .get(uid) as { id: string; name: string; slug: string } | undefined;
  if (!store) return NextResponse.json({ error: 'no-store' }, { status: 400 });

  // v4: scam-phrase flagging on listing text (review only, never blocks, never public).
  const scamHits = scanListingText(title, description);

  const id = randomId();
  const priceUsd = Math.round(price * 100);
  const slug = uniqueProductSlug(db, store.id, slugify(title));
  db.prepare(
    `INSERT INTO products (id, store_id, title, slug, description, price_usd, category, tags, status,
       video_url, stock_limit, flagged, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(
    id, store.id, title, slug, description, priceUsd, category, tags, status,
    videoUrl, stockLimit, scamHits.length > 0 ? 1 : 0
  );
  // v2: seller affiliate settings live in product_affiliates (toggle + commission).
  db.prepare(
    `INSERT INTO product_affiliates (product_id, enabled, commission_percent, updated_at)
     VALUES (?, ?, ?, datetime('now'))`
  ).run(id, affiliateEnabled ? 1 : 0, commission);


  // Announce to the channel (the bot-contract surface @Digitalsale_bot reads) —
  // best effort, never fails the request.
  let archived: { posted: boolean; reason?: string } = { posted: false, reason: 'not-configured' };
  try {
    const result = await archiveProduct({
      id,
      title,
      priceUsd: price,
      storeName: store.name,
      url: `${getOrigin(req)}/product/${id}`,
    });
    archived = { posted: result.posted, ...(result.reason ? { reason: result.reason } : {}) };
  } catch {
    archived = { posted: false, reason: 'archive-error' };
  }

  const product = db
    .prepare(`${PUBLIC_SELECT} WHERE p.id = ?`)
    .get(id) as ProductRow;
  return NextResponse.json({ product, archived }, { status: 201 });
}
