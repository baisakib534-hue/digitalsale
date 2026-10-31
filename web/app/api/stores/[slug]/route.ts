import { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '../../../../lib/db';
import { slugify } from '../../../../lib/format';
import { getSessionUserId } from '../../../../lib/auth';

interface StoreRow {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  bio: string;
  avatar_url: string | null;
  banner_url: string | null;
  payout_usdt_address: string;
  created_at: string;
}

function uniqueStoreSlug(db: Database.Database, base: string, excludeId: string): string {
  let slug = base || 'store';
  let n = 2;
  while (db.prepare('SELECT id FROM stores WHERE slug = ? AND id != ?').get(slug, excludeId)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

function ownedStore(req: Request, slug: string): { db: Database.Database; store: StoreRow } | NextResponse {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  const store = db
    .prepare('SELECT * FROM stores WHERE slug = ?')
    .get(slug) as StoreRow | undefined;
  if (!store) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (store.user_id !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  return { db, store };
}

/** Owner view of their store (includes payout address). */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const found = ownedStore(req, params.slug);
  if (found instanceof NextResponse) return found;
  return NextResponse.json({ store: found.store });
}

export async function PATCH(req: Request, { params }: { params: { slug: string } }) {
  const found = ownedStore(req, params.slug);
  if (found instanceof NextResponse) return found;
  const { db, store } = found;

  let body: { name?: unknown; bio?: unknown; payout_usdt_address?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; bio?: unknown; payout_usdt_address?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2) return NextResponse.json({ error: 'invalid-name' }, { status: 400 });
    updates.push('name = ?');
    values.push(name);
    if (name !== store.name) {
      const newSlug = uniqueStoreSlug(db, slugify(name), store.id);
      updates.push('slug = ?');
      values.push(newSlug);
    }
  }
  if (body.bio !== undefined) {
    updates.push('bio = ?');
    values.push(typeof body.bio === 'string' ? body.bio.trim() : '');
  }
  if (body.payout_usdt_address !== undefined) {
    updates.push('payout_usdt_address = ?');
    values.push(typeof body.payout_usdt_address === 'string' ? body.payout_usdt_address.trim() : '');
  }

  if (updates.length === 0) return NextResponse.json({ error: 'nothing-to-update' }, { status: 400 });

  db.prepare(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`).run(...values, store.id);
  const updated = db.prepare('SELECT * FROM stores WHERE id = ?').get(store.id) as StoreRow;
  return NextResponse.json({ store: updated });
}
