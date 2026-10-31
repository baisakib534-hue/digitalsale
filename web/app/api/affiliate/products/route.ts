import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getSessionUserId } from '../../../../lib/auth';

function getOrigin(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

/**
 * GET /api/affiliate/products — affiliate-shareable products:
 * published + affiliate_enabled, with this affiliate's link when they joined.
 */
export async function GET(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const aff = db.prepare('SELECT code FROM affiliates WHERE user_id = ?').get(uid) as
    | { code: string }
    | undefined;

  const origin = getOrigin(req);
  const products = db
    .prepare(
      `SELECT p.id, p.title, p.price_usd AS priceUsd, p.category,
              pa.commission_percent AS commission,
              s.name AS storeName
       FROM products p
       JOIN stores s ON s.id = p.store_id
       JOIN product_affiliates pa ON pa.product_id = p.id AND pa.enabled = 1
       WHERE p.status = 'published' AND s.status != 'suspended'
       ORDER BY p.created_at DESC`
    )
    .all() as {
    id: string;
    title: string;
    priceUsd: number;
    category: string;
    commission: number;
    storeName: string;
  }[];

  return NextResponse.json({
    code: aff?.code ?? null,
    products: products.map((p) => ({
      ...p,
      link: aff ? `${origin}/product/${p.id}?ref=${aff.code}` : null,
    })),
  });
}
