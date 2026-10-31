import { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '../../../../lib/db';
import { slugify } from '../../../../lib/format';
import { getSessionUserId } from '../../../../lib/auth';
import { isVerified } from '../../../../lib/verify';
import { isCategory } from '../../../../lib/categories';
import { validateCommission, DEFAULT_COMMISSION } from '../../../../lib/affiliate';
import { scanListingText } from '../../../../lib/scamPatterns';
import { parseYouTubeId, youTubeWatchUrl } from '../../../../lib/video';

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

interface FileRow {
  id: string;
  filename: string;
  mime: string;
  size: number;
  provider: string;
  created_at: string;
}

const WITH_STORE = `SELECT p.id, p.store_id, p.title, p.slug, p.description, p.price_usd,
    p.category, p.tags, p.cover_url, p.video_url, p.status, p.flagged,
    pa.enabled AS affiliate_enabled, pa.commission_percent AS affiliate_commission,
    p.created_at,
    s.name AS store_name, s.slug AS store_slug, s.user_id AS store_user_id
  FROM products p JOIN stores s ON s.id = p.store_id
  LEFT JOIN product_affiliates pa ON pa.product_id = p.id`;

type Owned = { db: Database.Database; product: ProductRow & { store_user_id: string }; isOwner: boolean } | NextResponse;

function load(req: Request, id: string, requireOwner: boolean): Owned {
  const uid = getSessionUserId(req);
  const db = getDb();
  const product = db.prepare(`${WITH_STORE} WHERE p.id = ?`).get(id) as
    | (ProductRow & { store_user_id: string })
    | undefined;
  if (!product) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const isOwner = !!uid && product.store_user_id === uid;
  if (requireOwner && !isOwner) {
    return NextResponse.json({ error: uid ? 'forbidden' : 'unauthorized' }, { status: uid ? 403 : 401 });
  }
  return { db, product, isOwner };
}

function uniqueProductSlug(db: Database.Database, storeId: string, base: string, excludeId: string): string {
  let slug = base || 'product';
  let n = 2;
  while (db.prepare('SELECT id FROM products WHERE store_id = ? AND slug = ? AND id != ?').get(storeId, slug, excludeId)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

/** Public: published only unless the requester owns the product (owner also sees files).
 * Suspended products return to everyone (no files) so the page can show the
 * "under review" notice — they stay out of market/search lists. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const found = load(req, params.id, false);
  if (found instanceof NextResponse) return found;
  const { db, product, isOwner } = found;
  if (product.status !== 'published' && product.status !== 'suspended' && !isOwner) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  const { store_user_id: _omit, flagged: _flag, ...publicProduct } = product;
  if (!isOwner) return NextResponse.json({ product: publicProduct });
  const files = db
    .prepare('SELECT id, filename, mime, size, provider, created_at FROM product_files WHERE product_id = ? ORDER BY created_at')
    .all(product.id) as FileRow[];
  const images = db
    .prepare('SELECT id, filename, mime, size, position, created_at FROM product_images WHERE product_id = ? ORDER BY position, created_at')
    .all(product.id);
  return NextResponse.json({ product: { ...publicProduct, files, images } });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const found = load(req, params.id, true);
  if (found instanceof NextResponse) return found;
  const { db, product } = found;
  // v3: editing products requires Telegram verification.
  if (!isVerified(db, product.store_user_id)) {
    return NextResponse.json({ error: 'telegram-verification-required' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let textChanged = false;

  if (body.title !== undefined) {
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length < 3) return NextResponse.json({ error: 'invalid-title' }, { status: 400 });
    updates.push('title = ?');
    values.push(title);
    textChanged = textChanged || title !== product.title;
    if (title !== product.title) {
      updates.push('slug = ?');
      values.push(uniqueProductSlug(db, product.store_id, slugify(title), product.id));
    }
  }
  if (body.description !== undefined) {
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    updates.push('description = ?');
    values.push(description);
    textChanged = textChanged || description !== product.description;
  }
  if (body.price !== undefined) {
    const price = typeof body.price === 'number' ? body.price : Number(body.price);
    if (!Number.isFinite(price) || price <= 0)
      return NextResponse.json({ error: 'invalid-price' }, { status: 400 });
    updates.push('price_usd = ?');
    values.push(Math.round(price * 100));
  }
  if (body.category !== undefined) {
    const category = typeof body.category === 'string' ? body.category : '';
    if (!isCategory(category)) return NextResponse.json({ error: 'invalid-category' }, { status: 400 });
    updates.push('category = ?');
    values.push(category);
  }
  if (body.tags !== undefined) {
    updates.push('tags = ?');
    values.push(typeof body.tags === 'string' ? body.tags.trim() : '');
  }
  if (body.status !== undefined) {
    if (body.status !== 'draft' && body.status !== 'published')
      return NextResponse.json({ error: 'invalid-status' }, { status: 400 });
    updates.push('status = ?');
    values.push(body.status);
  }
  // v6: YouTube demo video — empty string clears it.
  if (body.videoUrl !== undefined) {
    const raw = typeof body.videoUrl === 'string' ? body.videoUrl.trim() : '';
    if (raw === '' || raw === null) {
      updates.push('video_url = NULL');
    } else {
      const vid = parseYouTubeId(raw);
      if (!vid) return NextResponse.json({ error: 'invalid-video-url' }, { status: 400 });
      updates.push('video_url = ?');
      values.push(youTubeWatchUrl(vid));
    }
  }
  // v2: seller affiliate controls (live in product_affiliates), editable any time.
  const affUpdates: string[] = [];
  const affValues: unknown[] = [];
  if (body.affiliateEnabled !== undefined) {
    affUpdates.push('enabled = ?');
    affValues.push(body.affiliateEnabled === true ? 1 : 0);
  }
  if (body.affiliateCommission !== undefined) {
    if (!validateCommission(body.affiliateCommission))
      return NextResponse.json({ error: 'invalid-commission' }, { status: 400 });
    affUpdates.push('commission_percent = ?');
    affValues.push(body.affiliateCommission);
  }
  if (affUpdates.length > 0) {
    affUpdates.push("updated_at = datetime('now')");
    db.prepare(
      `INSERT INTO product_affiliates (product_id, enabled, commission_percent, updated_at)
       VALUES (?, 0, ${DEFAULT_COMMISSION}, datetime('now'))
       ON CONFLICT(product_id) DO UPDATE SET ${affUpdates.join(', ')}`
    ).run(product.id, ...affValues);
  }

  if (updates.length === 0 && affUpdates.length === 0)
    return NextResponse.json({ error: 'nothing-to-update' }, { status: 400 });

  // v4: re-scan listing text when title/description changed (review flag only).
  if (textChanged) {
    const newTitle = (body.title as string | undefined)?.trim() ?? product.title;
    const newDesc = (body.description as string | undefined)?.trim() ?? product.description;
    updates.push('flagged = ?');
    values.push(scanListingText(newTitle, newDesc).length > 0 ? 1 : 0);
  }

  if (updates.length > 0) {
    db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values, product.id);
  }
  const updated = db.prepare(`${WITH_STORE} WHERE p.id = ?`).get(product.id);
  return NextResponse.json({ product: updated });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const found = load(req, params.id, true);
  if (found instanceof NextResponse) return found;
  if (!isVerified(found.db, found.product.store_user_id)) {
    return NextResponse.json({ error: 'telegram-verification-required' }, { status: 403 });
  }
  found.db.prepare('DELETE FROM products WHERE id = ?').run(found.product.id);
  return new NextResponse(null, { status: 204 });
}
