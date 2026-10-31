import { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '../../../../../../../lib/db';
import { getSessionUserId } from '../../../../../../../lib/auth';
import { deactivateDiscount } from '../../../../../../../lib/discounts';

type Owned = { db: Database.Database } | NextResponse;

async function owned(req: Request, productId: string): Promise<Owned> {
  const db = getDb();
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const row = db
    .prepare(
      `SELECT p.id FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE p.id = ? AND s.user_id = ?`
    )
    .get(productId, uid) as { id: string } | undefined;
  if (!row) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return { db };
}

/** Seller: deactivate a discount code. */
export async function POST(req: Request, { params }: { params: { id: string; discountId: string } }) {
  const o = await owned(req, params.id);
  if (o instanceof NextResponse) return o;
  const row = o.db
    .prepare('SELECT id FROM discount_codes WHERE id = ? AND product_id = ?')
    .get(params.discountId, params.id) as { id: string } | undefined;
  if (!row) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const deactivated = deactivateDiscount(o.db, row.id);
  return NextResponse.json({ deactivated });
}
