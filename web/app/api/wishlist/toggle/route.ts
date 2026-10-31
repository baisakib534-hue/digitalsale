import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getSessionUserId } from '../../../../lib/auth';
import { toggleWishlist } from '../../../../lib/wishlist';

/** Logged-in buyer: toggle a product on their wishlist. */
export async function POST(req: Request) {
  let body: { productId?: unknown };
  try {
    body = (await req.json()) as { productId?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const productId = typeof body.productId === 'string' ? body.productId : '';
  if (!productId) return NextResponse.json({ error: 'missing-product' }, { status: 400 });

  const db = getDb();
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const product = db.prepare('SELECT id FROM products WHERE id = ?').get(productId) as
    | { id: string }
    | undefined;
  if (!product) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const wishlisted = toggleWishlist(db, uid, productId);
  return NextResponse.json({ wishlisted });
}
