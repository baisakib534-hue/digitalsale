import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { recordClick, setRefCookieHeader } from '../../../../lib/affiliate';

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

interface ClickBody {
  code?: unknown;
  productId?: unknown;
}

/**
 * POST /api/affiliate/click — capture a ?ref=CODE visit.
 * Validates the code, records a deduped click, and sets the 30-day
 * httpOnly ref cookie. Invalid codes are ignored silently (still 200).
 */
export async function POST(req: Request) {
  let body: ClickBody;
  try {
    body = (await req.json()) as ClickBody;
  } catch {
    return NextResponse.json({ ok: true });
  }
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const productId = typeof body.productId === 'string' ? body.productId : null;

  const res = NextResponse.json({ ok: true });
  if (!code) return res;

  const db = getDb();
  const aff = db.prepare('SELECT code FROM affiliates WHERE code = ?').get(code) as
    | { code: string }
    | undefined;
  if (!aff) return res; // invalid codes ignored silently

  recordClick(db, aff.code, productId, clientIp(req));
  res.headers.append('Set-Cookie', setRefCookieHeader(aff.code));
  return res;
}
