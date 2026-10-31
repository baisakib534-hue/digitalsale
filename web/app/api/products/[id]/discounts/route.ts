import { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '../../../../../lib/db';
import { getSessionUserId } from '../../../../../lib/auth';
import { createDiscount, normalizeCode, type DiscountRow } from '../../../../../lib/discounts';

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

/** Seller: list discount codes for one of their products. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const o = await owned(req, params.id);
  if (o instanceof NextResponse) return o;
  const codes = o.db
    .prepare(
      `SELECT id, code, kind, value, max_uses, used_count, active, expires_at, created_at
       FROM discount_codes WHERE product_id = ? ORDER BY created_at DESC`
    )
    .all(params.id) as DiscountRow[];
  return NextResponse.json({ codes });
}

interface DiscountBody {
  code?: unknown;
  kind?: unknown;
  value?: unknown;
  maxUses?: unknown;
  expiresAt?: unknown;
}

/** Seller: create a discount code. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const o = await owned(req, params.id);
  if (o instanceof NextResponse) return o;
  let body: DiscountBody;
  try {
    body = (await req.json()) as DiscountBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const code = normalizeCode(body.code);
  if (!code) return NextResponse.json({ error: 'invalid-code' }, { status: 400 });
  const kind = body.kind === 'fixed' ? 'fixed' : 'percent';
  const value = Math.floor(Number(body.value));
  if (!Number.isFinite(value) || value <= 0) {
    return NextResponse.json({ error: 'invalid-value' }, { status: 400 });
  }
  if (kind === 'percent' && value > 90) {
    return NextResponse.json({ error: 'percent-too-high' }, { status: 400 });
  }
  let maxUses: number | null = null;
  if (body.maxUses !== undefined && body.maxUses !== null && String(body.maxUses).trim() !== '') {
    const mu = Math.floor(Number(body.maxUses));
    if (!Number.isFinite(mu) || mu < 1) return NextResponse.json({ error: 'invalid-max-uses' }, { status: 400 });
    maxUses = mu;
  }
  let expiresAt: string | null = null;
  if (typeof body.expiresAt === 'string' && body.expiresAt.trim() !== '') {
    const d = new Date(body.expiresAt);
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'invalid-expiry' }, { status: 400 });
    }
    expiresAt = d.toISOString().slice(0, 19).replace('T', ' ');
  }
  try {
    const row = createDiscount(o.db, params.id, code, kind, value, maxUses, expiresAt);
    return NextResponse.json({ code: row }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'code-taken' }, { status: 409 });
  }
}
