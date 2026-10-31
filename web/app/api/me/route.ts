import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getSessionUserId } from '../../../lib/auth';

export async function GET(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const user = db
    .prepare('SELECT id, email, name, telegram_verified FROM users WHERE id = ?')
    .get(uid) as { id: string; email: string | null; name: string; telegram_verified: number } | undefined;
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const store = db
    .prepare('SELECT slug FROM stores WHERE user_id = ?')
    .get(uid) as { slug: string } | undefined;

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      hasStore: !!store,
      storeSlug: store?.slug ?? null,
      telegramVerified: user.telegram_verified === 1,
    },
  });
}
