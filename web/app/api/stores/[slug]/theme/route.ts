import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { getSessionUserId } from '../../../../../lib/auth';
import { normalizeTheme } from '../../../../../lib/stores';

/** v13: seller saves their storefront theme (accent, mode, layout, sections). */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const db = getDb();
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const store = db.prepare('SELECT id, user_id FROM stores WHERE slug = ?').get(params.slug) as
    | { id: string; user_id: string }
    | undefined;
  if (!store) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (store.user_id !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: { theme?: unknown };
  try {
    body = (await req.json()) as { theme?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const theme = normalizeTheme(body.theme);
  db.prepare('UPDATE stores SET theme_json = ? WHERE id = ?').run(JSON.stringify(theme), store.id);
  return NextResponse.json({ theme });
}
