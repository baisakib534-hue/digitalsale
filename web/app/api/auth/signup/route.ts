import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { hashPassword, randomId } from '../../../../lib/crypto';
import { createSessionToken, sessionCookieHeader } from '../../../../lib/auth';
import { normalizeGmail, isDisposable } from '../../../../lib/email';
import { checkSignupRateLimit } from '../../../../lib/rateLimit';

interface SignupBody {
  email?: unknown;
  password?: unknown;
  name?: unknown;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(req: Request) {
  let body: SignupBody;
  try {
    body = (await req.json()) as SignupBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  // Gmail only (case-insensitive, googlemail normalized).
  const norm = normalizeGmail(body.email);
  if (!norm) return NextResponse.json({ error: 'email-not-gmail' }, { status: 400 });
  // Temp-mail blocklist (defense in depth).
  if (isDisposable(norm.display)) {
    return NextResponse.json({ error: 'email-temp-blocked' }, { status: 400 });
  }
  if (name.length < 2) return NextResponse.json({ error: 'invalid-name' }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: 'weak-password' }, { status: 400 });

  const db = getDb();
  if (!checkSignupRateLimit(db, clientIp(req))) {
    return NextResponse.json({ error: 'rate-limited' }, { status: 429 });
  }

  // Uniqueness on the CANONICAL address: j.ohn+shop@gmail.com === john@gmail.com.
  const existing = db
    .prepare('SELECT id FROM users WHERE email_canonical = ? OR email = ?')
    .get(norm.canonical, norm.display);
  if (existing) return NextResponse.json({ error: 'email-taken' }, { status: 409 });

  const id = randomId();
  db.prepare(
    `INSERT INTO users (id, email, email_canonical, password_hash, name, telegram_verified, created_at)
     VALUES (?, ?, ?, ?, ?, 0, datetime('now'))`
  ).run(id, norm.display, norm.canonical, hashPassword(password), name);

  const res = NextResponse.json({ user: { id, name, email: norm.display } }, { status: 201 });
  res.headers.append('Set-Cookie', sessionCookieHeader(createSessionToken(id)));
  return res;
}
