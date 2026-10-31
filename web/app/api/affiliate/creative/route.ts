import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getSessionUserId } from '../../../../lib/auth';
import { BRAND } from '../../../../lib/brand';

function getOrigin(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

/**
 * GET /api/affiliate/creative?product=<id> — promo kit for one product:
 * the affiliate's link, three swipe-copy variants, and a creative-card
 * payload (title, price, commission, brand) the UI renders as a share card.
 */
export async function GET(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const url = new URL(req.url);
  const productId = url.searchParams.get('product') ?? '';

  const db = getDb();
  const aff = db.prepare('SELECT code FROM affiliates WHERE user_id = ?').get(uid) as
    | { code: string }
    | undefined;
  if (!aff) return NextResponse.json({ error: 'not-an-affiliate' }, { status: 404 });

  const product = db
    .prepare(
      `SELECT p.id, p.title, p.description, p.price_usd AS priceUsd,
              pa.commission_percent AS commission, s.name AS storeName
       FROM products p
       JOIN stores s ON s.id = p.store_id
       JOIN product_affiliates pa ON pa.product_id = p.id AND pa.enabled = 1
       WHERE p.id = ? AND p.status = 'published' AND s.status != 'suspended'`
    )
    .get(productId) as
    | {
        id: string;
        title: string;
        description: string;
        priceUsd: number;
        commission: number;
        storeName: string;
      }
    | undefined;
  if (!product) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  const link = `${getOrigin(req)}/product/${product.id}?ref=${aff.code}`;
  const price = (product.priceUsd / 100).toFixed(2);
  const blurb = product.description.split('\n')[0].slice(0, 140);

  const swipes = [
    `I found "${product.title}" on ${BRAND.name} and it's exactly what I was looking for — $${price}. ${blurb} ${link}`,
    `Quick recommendation: ${product.title} by ${product.storeName} ($${price}) on ${BRAND.name}. ${blurb} ${link}`,
    `If you need ${product.title.toLowerCase()}, this is the one I'd get: $${price} on ${BRAND.name}. ${blurb} ${link}`,
  ];

  return NextResponse.json({
    productId: product.id,
    code: aff.code,
    link,
    commission: product.commission,
    swipes,
    card: {
      title: product.title,
      storeName: product.storeName,
      price,
      commission: product.commission,
      blurb,
      link,
      brand: BRAND.name,
      tagline: BRAND.tagline,
    },
  });
}
