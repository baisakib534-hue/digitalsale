import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { randomId } from '../../../../lib/crypto';
import { requireVerified } from '../../../../lib/verify';
import { genAffiliateCode } from '../../../../lib/affiliate';

interface JoinBody {
  usdtAddress?: unknown;
}

/**
 * POST /api/affiliate/join — anyone (verified) can become an affiliate.
 * Issues a unique referral code; 409 when already joined.
 */
export async function POST(req: Request) {
  const db = getDb();
  const gated = requireVerified(db, req);
  if (gated instanceof NextResponse) return gated;
  const { uid } = gated;

  let body: JoinBody = {};
  try {
    body = (await req.json()) as JoinBody;
  } catch {
    /* address optional */
  }
  const usdtAddress = typeof body.usdtAddress === 'string' ? body.usdtAddress.trim() : '';

  const existing = db.prepare('SELECT code FROM affiliates WHERE user_id = ?').get(uid) as
    | { code: string }
    | undefined;
  if (existing) return NextResponse.json({ error: 'already-joined', code: existing.code }, { status: 409 });

  // Unique code — the caller owns the uniqueness check (see lib/affiliate).
  let code = genAffiliateCode();
  while (db.prepare('SELECT 1 FROM affiliates WHERE code = ?').get(code)) {
    code = genAffiliateCode();
  }
  const id = randomId();
  db.prepare(
    `INSERT INTO affiliates (id, user_id, code, payout_usdt_address, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(id, uid, code, usdtAddress);

  return NextResponse.json({ code, usdtAddress }, { status: 201 });
}
