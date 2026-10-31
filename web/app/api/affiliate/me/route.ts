import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getSessionUserId } from '../../../../lib/auth';

/**
 * GET /api/affiliate/me — the signed-in affiliate's dashboard data:
 * code, payout address, totals (clicks / paid sales / earnings), and
 * per-product breakdowns. Stats derive from affiliate_clicks + paid orders.
 */
export async function GET(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const aff = db
    .prepare('SELECT code, payout_usdt_address, created_at FROM affiliates WHERE user_id = ?')
    .get(uid) as { code: string; payout_usdt_address: string; created_at: string } | undefined;
  if (!aff) return NextResponse.json({ error: 'not-an-affiliate' }, { status: 404 });

  const clickRow = db
    .prepare('SELECT COUNT(*) AS c FROM affiliate_clicks WHERE code = ?')
    .get(aff.code) as { c: number };
  const salesRow = db
    .prepare(
      `SELECT COUNT(*) AS sales, COALESCE(SUM(affiliate_usd), 0) AS earnedUsd
       FROM orders WHERE affiliate_code = ? AND status = 'paid'`
    )
    .get(aff.code) as { sales: number; earnedUsd: number };

  const clickByProduct = db
    .prepare(
      `SELECT product_id AS productId, COUNT(*) AS clicks
       FROM affiliate_clicks WHERE code = ? AND product_id IS NOT NULL
       GROUP BY product_id`
    )
    .all(aff.code) as { productId: string; clicks: number }[];
  const clickMap = new Map(clickByProduct.map((r) => [r.productId, r.clicks]));

  const products = db
    .prepare(
      `SELECT o.product_id AS productId, p.title, p.price_usd AS priceUsd,
              pa.commission_percent AS commission,
              COUNT(*) AS sales, COALESCE(SUM(o.affiliate_usd), 0) AS earnedUsd
       FROM orders o
       JOIN products p ON p.id = o.product_id
       LEFT JOIN product_affiliates pa ON pa.product_id = o.product_id
       WHERE o.affiliate_code = ? AND o.status = 'paid'
       GROUP BY o.product_id
       ORDER BY earnedUsd DESC`
    )
    .all(aff.code) as {
    productId: string;
    title: string;
    priceUsd: number;
    commission: number | null;
    sales: number;
    earnedUsd: number;
  }[];

  return NextResponse.json({
    code: aff.code,
    usdtAddress: aff.payout_usdt_address,
    joinedAt: aff.created_at,
    totals: {
      clicks: clickRow.c,
      sales: salesRow.sales,
      earnedUsd: salesRow.earnedUsd,
    },
    products: products.map((p) => ({ ...p, clicks: clickMap.get(p.productId) ?? 0 })),
  });
}
