import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { endFlashDealEarly, deleteFlashDeal, getFlashDeal } from '@/lib/flashDeals';

/** End a live flash deal early. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const db = getDb();
  const uid = getSessionUserId(req);

  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const product = db
    .prepare('SELECT id, store_id FROM products WHERE id = ?')
    .get(productId) as { id: string; store_id: string } | undefined;
  if (!product) return NextResponse.json({ error: 'product-not-found' }, { status: 404 });

  const store = db.prepare('SELECT user_id FROM stores WHERE id = ?').get(product.store_id) as
    | { user_id: string }
    | undefined;
  if (!store || store.user_id !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const deal = getFlashDeal(db, productId);
  if (!deal) return NextResponse.json({ error: 'deal-not-found' }, { status: 404 });

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const ended = endFlashDealEarly(db, productId, now);
  if (!ended) return NextResponse.json({ error: 'deal-already-ended' }, { status: 400 });

  return NextResponse.json({ ok: true });
}

/** Cancel a flash deal (before it starts or after it ends). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const db = getDb();
  const uid = getSessionUserId(req);

  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const product = db
    .prepare('SELECT id, store_id FROM products WHERE id = ?')
    .get(productId) as { id: string; store_id: string } | undefined;
  if (!product) return NextResponse.json({ error: 'product-not-found' }, { status: 404 });

  const store = db.prepare('SELECT user_id FROM stores WHERE id = ?').get(product.store_id) as
    | { user_id: string }
    | undefined;
  if (!store || store.user_id !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const deal = getFlashDeal(db, productId);
  if (!deal) return NextResponse.json({ error: 'deal-not-found' }, { status: 404 });

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  if (deal.starts_at <= now && deal.ends_at > now) {
    return NextResponse.json({ error: 'deal-live-use-patch' }, { status: 400 });
  }

  const deleted = deleteFlashDeal(db, productId);
  if (!deleted) return NextResponse.json({ error: 'deal-not-found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}