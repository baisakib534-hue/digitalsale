import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { getSessionUserId } from '../../../../../lib/auth';
import { setCustomSlug } from '../../../../../lib/stores';

/**
 * v13: seller sets (or clears with null/"") their customizable white-label link:
 * /s/<custom-slug> instead of /s/st_…. First come, first served — slugs are unique.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const db = getDb();
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const store = db.prepare('SELECT id, user_id FROM stores WHERE slug = ?').get(params.slug) as
    | { id: string; user_id: string }
    | undefined;
  if (!store) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (store.user_id !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: { slug?: unknown };
  try {
    body = (await req.json()) as { slug?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const result = setCustomSlug(db, store.id, body.slug ?? null);
  if (!result.ok) return NextResponse.json({ error: `slug-${result.reason}` }, { status: 400 });

  const row = db.prepare('SELECT custom_slug FROM stores WHERE id = ?').get(store.id) as {
    custom_slug: string | null;
  };
  return NextResponse.json({ custom_slug: row.custom_slug });
}
