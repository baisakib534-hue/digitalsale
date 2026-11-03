import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { getSessionUserId } from '../../../../../lib/auth';
import {
  liveDealForProduct,
  createFlashDeal,
  endFlashDealEarly,
  isProductEligibleForDeal,
  isSellerBanned,
} from '../../../../../lib/flashDeals';
import { randomId } from '../../../../../lib/crypto';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify product belongs to seller
  const product = db.prepare('SELECT store_id FROM products WHERE id = ?').get(productId) as { store_id: string } | undefined;
  if (!product || product.store_id !== uid) {
    return NextResponse.json({ error: 'product-not-found' }, { status: 404 });
  }

  const deal = liveDealForProduct(db, productId);
  if (!deal) {
    return NextResponse.json({ deal: null });
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const orders = db.prepare(
    `SELECT COUNT(*) as count, COALESCE(SUM(amount_usd), 0) as revenue
     FROM orders WHERE flash_deal_id = ? AND status = 'paid'`
  ).get(deal.id) as { count: number; revenue: number };

  const timeLeft = deal.ends_at > now ? Math.floor((new Date(deal.ends_at).getTime() - new Date(now).getTime()) / 1000) : 0;

  return NextResponse.json({
    deal: {
      ...deal,
      timeLeft,
      ordersAttributed: orders.count,
      revenueAttributed: orders.revenue,
    },
  });
}

/** Start a flash deal for a product. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify product belongs to seller and is published
  const product = db.prepare(
    'SELECT id, store_id, status, price_usd FROM products WHERE id = ?'
  ).get(productId) as { id: string; store_id: string; status: string; price_usd: number } | undefined;

  if (!product || product.store_id !== uid) {
    return NextResponse.json({ error: 'product-not-found' }, { status: 404 });
  }

  if (product.status !== 'published') {
    return NextResponse.json({ error: 'product-not-published' }, { status: 400 });
  }

  // Banned sellers' deals never go live.
  if (isSellerBanned(db, product.store_id)) {
    return NextResponse.json({ error: 'seller-banned' }, { status: 403 });
  }

  const eligible = isProductEligibleForDeal(db, productId);
  if (!eligible.ok) return NextResponse.json({ error: eligible.reason }, { status: 400 });

  let body: { discount_percent?: unknown; starts_at?: unknown; ends_at?: unknown; durationHours?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const discountPercent = typeof body.discount_percent === 'number' ? body.discount_percent : NaN;
  if (!Number.isInteger(discountPercent) || discountPercent < 5 || discountPercent > 90) {
    return NextResponse.json({ error: 'discount-percent-out-of-range' }, { status: 400 });
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  let startsAt: string;
  let endsAt: string;

  if (typeof body.starts_at === 'string' && typeof body.ends_at === 'string') {
    startsAt = body.starts_at;
    endsAt = body.ends_at;
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

  // Min 1 cent price floor
  const dealPrice = Math.round(product.price_usd * (1 - discountPercent / 100));
  if (dealPrice < 1) {
    return NextResponse.json({ error: 'deal-price-below-minimum' }, { status: 400 });
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

/** End a flash deal early. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: productId } = await params;
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();

  // Verify product belongs to seller
  const product = db.prepare('SELECT store_id FROM products WHERE id = ?').get(productId) as { store_id: string } | undefined;
  if (!product || product.store_id !== uid) {
    return NextResponse.json({ error: 'product-not-found' }, { status: 404 });
  }

  let body: { action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  if (body.action === 'end_early') {
    const deal = liveDealForProduct(db, productId);
    if (!deal) {
      return NextResponse.json({ error: 'no-live-deal' }, { status: 404 });
    }

    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const ended = endFlashDealEarly(db, productId, now);
    if (!ended) {
      return NextResponse.json({ error: 'no-live-deal' }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'invalid-action' }, { status: 400 });
}