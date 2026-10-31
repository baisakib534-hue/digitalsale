import { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '../../../../../../../lib/db';
import { getSessionUserId } from '../../../../../../../lib/auth';
import { revokeLicenseKey } from '../../../../../../../lib/licenses';

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

/** Seller: revoke one license key (buyer's software stops verifying). */
export async function POST(req: Request, { params }: { params: { id: string; licenseId: string } }) {
  const o = await owned(req, params.id);
  if (o instanceof NextResponse) return o;
  const key = o.db
    .prepare('SELECT id FROM license_keys WHERE id = ? AND product_id = ?')
    .get(params.licenseId, params.id) as { id: string } | undefined;
  if (!key) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const revoked = revokeLicenseKey(o.db, key.id);
  return NextResponse.json({ revoked });
}
