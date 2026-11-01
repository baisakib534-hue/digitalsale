import { NextResponse } from 'next/server';
import { getDb } from '../../../../../../lib/db';
import { getSessionUserId } from '../../../../../../lib/auth';
import { newWhitelabelToken } from '../../../../../../lib/stores';

/** Seller: regenerate their unique white-label storefront link. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const db = getDb();
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const store = db.prepare('SELECT id, user_id FROM stores WHERE slug = ?').get(params.slug) as
    | { id: string; user_id: string }
    | undefined;
  if (!store) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (store.user_id !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const token = newWhitelabelToken();
      db.prepare('UPDATE stores SET whitelabel_token = ? WHERE id = ?').run(token, store.id);
      return NextResponse.json({ whitelabel_token: token });
    } catch (err) {
      if (!(err as Error).message.includes('UNIQUE')) throw err;
    }
  }
  return NextResponse.json({ error: 'token-collision' }, { status: 500 });
}
