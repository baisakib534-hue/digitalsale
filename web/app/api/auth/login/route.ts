import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { verifyPassword } from '../../../../lib/crypto';
import { createSessionToken, sessionCookieHeader } from '../../../../lib/auth';
import { normalizeGmail } from '../../../../lib/email';

interface LoginBody {
  email?: unknown;
  password?: unknown;
}

interface UserRow {
  id: string;
  email: string | null;
  name: string;
  password_hash: string | null;
  telegram_verified: number;
}

export async function POST(req: Request) {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const password = typeof body.password === 'string' ? body.password : '';

  // Gmail only — same normalization as signup so dotted/+ variants log in.
  const norm = normalizeGmail(body.email);
  if (!norm) return NextResponse.json({ error: 'email-not-gmail' }, { status: 400 });

  const db = getDb();
  const user = db
    .prepare(
      `SELECT id, email, name, password_hash, telegram_verified FROM users
       WHERE email_canonical = ? OR email = ?`
    )
    .get(norm.canonical, norm.display) as UserRow | undefined;

  if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
    return NextResponse.json({ error: 'invalid-credentials' }, { status: 401 });
  }

  const res = NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      telegramVerified: user.telegram_verified === 1,
    },
  });
  res.headers.append('Set-Cookie', sessionCookieHeader(createSessionToken(user.id)));
  return res;
}
