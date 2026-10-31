import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { getSessionUserId } from '../../../../../lib/auth';
import { canReview, createReview, type ReviewRow } from '../../../../../lib/reviews';

/** Public: latest reviews for a product. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(params.id) as
    | { id: string }
    | undefined;
  if (!product) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const reviews = db
    .prepare(
      `SELECT id, rating, body, created_at FROM reviews
       WHERE product_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(params.id) as Pick<ReviewRow, 'id' | 'rating' | 'body' | 'created_at'>[];
  return NextResponse.json({ reviews });
}

interface ReviewBody {
  orderId?: unknown;
  rating?: unknown;
  body?: unknown;
}

/** Verified buyer: leave one review per paid order. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  let body: ReviewBody;
  try {
    body = (await req.json()) as ReviewBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  const rating = Math.floor(Number(body.rating));
  if (!orderId) return NextResponse.json({ error: 'missing-order' }, { status: 400 });
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'invalid-rating' }, { status: 400 });
  }
  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 1000) : '';

  const db = getDb();
  const uid = getSessionUserId(req);
  let email = '';
  if (uid) {
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(uid) as
      | { email: string | null }
      | undefined;
    email = user?.email ?? '';
  }
  const check = canReview(db, params.id, orderId, uid, email);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 403 });
  const review = createReview(db, params.id, orderId, uid, rating, text);
  return NextResponse.json({ review }, { status: 201 });
}
