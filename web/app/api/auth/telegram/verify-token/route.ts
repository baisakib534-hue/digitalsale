import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { getSessionUserId } from '../../../../../lib/auth';
import { createVerifyToken } from '../../../../../lib/verify';

/** POST (auth) → mint a @Digitalsale_bot deep-link verification token. */
export async function POST(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  const { token, deepLink, expiresAt } = createVerifyToken(db, uid);
  return NextResponse.json({ token, deepLink, expiresAt }, { status: 201 });
}
