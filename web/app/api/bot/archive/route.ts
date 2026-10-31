import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getSessionUserId } from '../../../../lib/auth';
import { archiveProduct } from '../../../../lib/channelStore';

function getOrigin(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

/** Re-archive a product to the channel on demand (auth: store owner).
 *  This is the bot-contract surface @Digitalsale_bot consumes. */
export async function POST(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { productId?: unknown };
  try {
    body = (await req.json()) as { productId?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const productId = typeof body.productId === 'string' ? body.productId : '';
  if (!productId) return NextResponse.json({ error: 'missing-product' }, { status: 400 });

  const db = getDb();
  const product = db
    .prepare(
      `SELECT p.id, p.title, p.price_usd, s.name AS store_name, s.user_id AS owner_id
       FROM products p JOIN stores s ON s.id = p.store_id
       WHERE p.id = ?`
    )
    .get(productId) as
    | { id: string; title: string; price_usd: number; store_name: string; owner_id: string }
    | undefined;
  if (!product) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (product.owner_id !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const result = await archiveProduct({
    id: product.id,
    title: product.title,
    priceUsd: product.price_usd / 100,
    storeName: product.store_name,
    url: `${getOrigin(req)}/product/${product.id}`,
  });

  return NextResponse.json({
    ok: true,
    posted: result.posted,
    ...(result.messageId !== undefined ? { messageId: result.messageId } : {}),
    ...(result.reason ? { reason: result.reason } : {}),
  });
}
