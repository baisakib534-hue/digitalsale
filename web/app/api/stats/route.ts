import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stats — live marketplace safety numbers, straight from the DB.
 * Real counts only; the UI shows "—" when a count is zero.
 */
export async function GET() {
  const db = getDb();
  const one = (sql: string): number => {
    const row = db.prepare(sql).get() as { c: number } | undefined;
    return row?.c ?? 0;
  };
  return NextResponse.json({
    productsLive: one(`SELECT COUNT(*) AS c FROM products WHERE status = 'published'`),
    filesScanned: one('SELECT COUNT(*) AS c FROM product_files'),
    reportsResolved: one(`SELECT COUNT(*) AS c FROM reports WHERE status != 'open'`),
    sellersVerified: one('SELECT COUNT(*) AS c FROM users WHERE telegram_verified = 1'),
  });
}
