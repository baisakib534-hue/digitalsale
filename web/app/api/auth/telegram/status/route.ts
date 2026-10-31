import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { getSessionUserId } from '../../../../../lib/auth';

/** GET (auth) → live Telegram verification status (polled by /verify). */
export async function GET(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  const user = db
    .prepare('SELECT telegram_verified, telegram_username FROM users WHERE id = ?')
    .get(uid) as { telegram_verified: number; telegram_username: string | null } | undefined;
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({
    verified: user.telegram_verified === 1,
    telegramUsername: user.telegram_username,
  });
}
