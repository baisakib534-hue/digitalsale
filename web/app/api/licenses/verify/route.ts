import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyLicenseKey } from '../../../../lib/licenses';

/**
 * Public license verification (v10, Gumroad-style).
 * Sellers' apps call this to activate/validate a buyer's key:
 *   POST /api/licenses/verify  { "key": "XXXX-XXXX-XXXX-XXXX", "product_id": "optional" }
 *
 * Simple per-IP throttle: 60 attempts/minute.
 */
const attempts = new Map<string, { n: number; reset: number }>();

function throttled(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now > rec.reset) {
    attempts.set(ip, { n: 1, reset: now + 60_000 });
    return false;
  }
  rec.n += 1;
  return rec.n > 60;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (throttled(ip)) {
    return NextResponse.json({ error: 'rate-limited' }, { status: 429 });
  }

  let body: { key?: unknown; product_id?: unknown };
  try {
    body = (await req.json()) as { key?: unknown; product_id?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const key = typeof body.key === 'string' ? body.key.trim() : '';
  if (!key) return NextResponse.json({ error: 'missing-key' }, { status: 400 });
  const productId = typeof body.product_id === 'string' ? body.product_id : undefined;

  const db = getDb();
  const result = verifyLicenseKey(db, key, productId);
  if (!result.valid) {
    return NextResponse.json({ valid: false, reason: result.reason }, { status: 200 });
  }
  return NextResponse.json(
    { valid: true, product_id: result.product_id, activations: result.activations },
    { status: 200 }
  );
}
