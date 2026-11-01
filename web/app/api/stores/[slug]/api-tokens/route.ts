import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { getSessionUserId } from '../../../../../lib/auth';
import { createStoreApiToken, revokeStoreApiToken } from '../../../../../lib/stores';

function ownedStore(req: Request, slug: string) {
  const db = getDb();
  const uid = getSessionUserId(req);
  if (!uid) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  const store = db.prepare('SELECT id, user_id FROM stores WHERE slug = ?').get(slug) as
    | { id: string; user_id: string }
    | undefined;
  if (!store) return { error: NextResponse.json({ error: 'not-found' }, { status: 404 }) };
  if (store.user_id !== uid)
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  return { db, store };
}

/** Seller: list their API tokens (token values never returned after creation). */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const found = ownedStore(req, params.slug);
  if ('error' in found) return found.error;
  const tokens = found.db
    .prepare(
      `SELECT id, name, revoked, last_used_at, created_at
       FROM store_api_tokens WHERE store_id = ? ORDER BY created_at DESC`
    )
    .all(found.store.id);
  return NextResponse.json({ tokens });
}

/** Seller: create an API token. The token value is shown ONCE. */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const found = ownedStore(req, params.slug);
  if ('error' in found) return found.error;
  let body: { name?: unknown };
  try {
    body = (await req.json()) as { name?: unknown };
  } catch {
    body = {};
  }
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : '';
  const { id, token } = createStoreApiToken(found.db, found.store.id, name || 'My app');
  return NextResponse.json({ token: { id, token, name: name || 'My app' } }, { status: 201 });
}
