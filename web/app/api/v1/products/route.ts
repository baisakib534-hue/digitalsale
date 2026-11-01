import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { randomId } from '../../../../lib/crypto';
import { slugify } from '../../../../lib/format';
import { getStoreByApiToken, queueChannelPost } from '../../../../lib/stores';
import { isCategory } from '../../../../lib/categories';
import { normalizeStockLimit } from '../../../../lib/stock';

function authed(req: Request) {
  const db = getDb();
  const header = req.headers.get('authorization') || '';
  const m = /^Bearer\s+(dst_\S+)$/.exec(header.trim());
  const store = getStoreByApiToken(db, m ? m[1] : null);
  if (!store) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  return { db, store };
}

function uniqueProductSlug(db: any, storeId: string, base: string): string {
  let slug = base || 'product';
  let n = 2;
  while (db.prepare('SELECT id FROM products WHERE store_id = ? AND slug = ?').get(storeId, slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/**
 * Seller API v1 — list the store's products.
 * Auth: Authorization: Bearer dst_<token>
 */
export async function GET(req: Request) {
  const a = authed(req);
  if ('error' in a) return a.error;
  const products = a.db
    .prepare(
      `SELECT id, title, slug, description, price_usd, category, tags, status,
              stock_limit, license_keys, created_at
       FROM products WHERE store_id = ? ORDER BY created_at DESC`
    )
    .all(a.store.id);
  return NextResponse.json({ products });
}

interface V1ProductBody {
  title?: unknown;
  description?: unknown;
  price?: unknown; // dollars, e.g. 19.99
  category?: unknown;
  tags?: unknown;
  status?: unknown; // draft | published
  stockLimit?: unknown;
  licenseKeys?: unknown;
}

/**
 * Seller API v1 — create a product from the seller's own web app.
 * Publishing triggers the channel auto-post queue (bot stage).
 */
export async function POST(req: Request) {
  const a = authed(req);
  if ('error' in a) return a.error;
  const { db, store } = a;

  let body: V1ProductBody;
  try {
    body = (await req.json()) as V1ProductBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 120) : '';
  if (title.length < 3) return NextResponse.json({ error: 'invalid-title' }, { status: 400 });
  const priceNum = Number(body.price);
  if (!Number.isFinite(priceNum) || priceNum < 1 || priceNum > 100000) {
    return NextResponse.json({ error: 'invalid-price' }, { status: 400 });
  }
  const priceUsd = Math.round(priceNum * 100);
  const category = typeof body.category === 'string' && isCategory(body.category) ? body.category : 'Presets';
  const description = typeof body.description === 'string' ? body.description.trim().slice(0, 5000) : '';
  const tags =
    typeof body.tags === 'string'
      ? body.tags.split(',').map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 8).join(',')
      : '';
  const status = body.status === 'published' ? 'published' : 'draft';
  const stockLimit = normalizeStockLimit(body.stockLimit);
  if (stockLimit === 'invalid') return NextResponse.json({ error: 'invalid-stock-limit' }, { status: 400 });

  const id = randomId();
  const slug = uniqueProductSlug(db, store.id, slugify(title));
  db.prepare(
    `INSERT INTO products (id, store_id, title, slug, description, price_usd, category, tags, status,
       stock_limit, license_keys, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, store.id, title, slug, description, priceUsd, category, tags, status, stockLimit, body.licenseKeys === true ? 1 : 0);

  // Bot stage: newly published products auto-post to the seller's channel.
  if (status === 'published') {
    try {
      queueChannelPost(db, store.id, id);
    } catch {
      /* queue is best-effort */
    }
  }

  return NextResponse.json({ product: { id, slug, status } }, { status: 201 });
}
