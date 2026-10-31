import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { validateDiscount } from '../../../../lib/discounts';

/** Public: check a discount code before checkout. */
export async function POST(req: Request) {
  let body: { productId?: unknown; code?: unknown };
  try {
    body = (await req.json()) as { productId?: unknown; code?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const productId = typeof body.productId === 'string' ? body.productId : '';
  if (!productId) return NextResponse.json({ error: 'missing-product' }, { status: 400 });

  const db = getDb();
  const product = db
    .prepare('SELECT id, price_usd, status FROM products WHERE id = ?')
    .get(productId) as { id: string; price_usd: number; status: string } | undefined;
  if (!product || product.status !== 'published') {
    return NextResponse.json({ error: 'product-unavailable' }, { status: 404 });
  }
  const result = validateDiscount(db, productId, product.price_usd, body.code);
  if (!result.ok) return NextResponse.json({ valid: false, reason: result.reason });
  return NextResponse.json({
    valid: true,
    code: result.row.code,
    kind: result.row.kind,
    finalPriceCents: result.finalPriceCents,
    discountCents: result.discountCents,
  });
}
