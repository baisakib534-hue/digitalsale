import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { isProductEligibleForDeal, isSellerBanned, createFlashDeal } from '@/lib/flashDeals';
import { randomId } from '@/lib/crypto';

/** Start a flash deal for a product. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: productId } = await params;
  const db = getDb();
  const uid = getSessionUserId(req);

  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const product = db
    .prepare('SELECT id, store_id, status FROM products WHERE id = ?')
    .get(productId) as { id: string; store_id: string; status: string } | undefined;
  if (!product) return NextResponse.json({ error: 'product-not-found' }, { status: 404 });

  const store = db.prepare('SELECT user_id FROM stores WHERE id = ?').get(product.store_id) as
    | { user_id: string }
    | undefined;
  if (!store || store.user_id !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  // Banned sellers' deals never go live.
  if (isSellerBanned(db, product.store_id)) {
    return NextResponse.json({ error: 'seller-banned' }, { status: 403 });
  }

  const eligible = isProductEligibleForDeal(db, productId);
  if (!eligible.ok) return NextResponse.json({ error: eligible.reason }, { status: 400 });

  let body: { discountPercent?: unknown; durationHours?: unknown; startsAt?: unknown; endsAt?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const discountPercent = typeof body.discountPercent === 'number' ? body.discountPercent : NaN;
  if (!Number.isInteger(discountPercent) || discountPercent < 5 || discountPercent > 90) {
    return NextResponse.json({ error: 'discount-percent-out-of-range' }, { status: 400 });
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let startsAt: string;
  let endsAt: string;

  if (typeof body.startsAt === 'string' && typeof body.endsAt === 'string') {
    startsAt = body.startsAt;
    endsAt = body.endsAt;
    if (startsAt >= endsAt) return NextResponse.json({ error: 'invalid-time-window' }, { status: 400 });
    if (startsAt < now) return NextResponse.json({ error: 'start-in-past' }, { status: 400 });
  } else if (typeof body.durationHours === 'number' && body.durationHours > 0) {
    startsAt = now;
    const end = new Date();
    end.setHours(end.getHours() + body.durationHours);
    endsAt = end.toISOString().slice(0, 19).replace('T', ' ');
  } else {
    return NextResponse.json({ error: 'invalid-duration' }, { status: 400 });
  }

  try {
    const deal = createFlashDeal(db, productId, discountPercent, startsAt, endsAt);
    return NextResponse.json({ deal }, { status: 201 });
  } catch (err) {
    if ((err as Error).message === 'discount-percent-out-of-range') {
      return NextResponse.json({ error: 'discount-percent-out-of-range' }, { status: 400 });
    }
    if ((err as Error).message === 'invalid-time-window') {
      return NextResponse.json({ error: 'invalid-time-window' }, { status: 400 });
    }
    // UNIQUE(product_id) violation — one live deal per product.
    return NextResponse.json({ error: 'deal-exists' }, { status: 409 });
  }
}