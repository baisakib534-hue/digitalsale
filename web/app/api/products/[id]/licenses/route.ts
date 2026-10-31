import { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '../../../../../lib/db';
import { getSessionUserId } from '../../../../../lib/auth';

type Owned = { db: Database.Database } | NextResponse;

/** Seller owns the product → may manage its license keys. */
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

/** Seller: list license keys issued for one of their products. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const o = await owned(req, params.id);
  if (o instanceof NextResponse) return o;
  const keys = o.db
    .prepare(
      `SELECT id, license_key, status, activations, max_activations, created_at, revoked_at
       FROM license_keys WHERE product_id = ? ORDER BY created_at DESC`
    )
    .all(params.id);
  return NextResponse.json({ keys });
}
