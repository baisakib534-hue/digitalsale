import { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '../../../lib/db';
import { randomId } from '../../../lib/crypto';
import { slugify } from '../../../lib/format';
import { requireVerified } from '../../../lib/verify';

function uniqueStoreSlug(db: Database.Database, base: string): string {
  let slug = base || 'store';
  let n = 2;
  while (db.prepare('SELECT id FROM stores WHERE slug = ?').get(slug)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export async function POST(req: Request) {
  const db = getDb();
  const gated = requireVerified(db, req);
  if (gated instanceof NextResponse) return gated;
  const { uid } = gated;

  let body: { name?: unknown; bio?: unknown };
  try {
    body = (await req.json()) as { name?: unknown; bio?: unknown };
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const bio = typeof body.bio === 'string' ? body.bio.trim() : '';
  if (name.length < 2) return NextResponse.json({ error: 'invalid-name' }, { status: 400 });

  const existing = db.prepare('SELECT id FROM stores WHERE user_id = ?').get(uid);
  if (existing) return NextResponse.json({ error: 'store-exists' }, { status: 409 });

  const id = randomId();
  const slug = uniqueStoreSlug(db, slugify(name));
  db.prepare(
    `INSERT INTO stores (id, user_id, name, slug, bio, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'))`
  ).run(id, uid, name, slug, bio);

  const store = db
    .prepare('SELECT id, name, slug, bio, payout_usdt_address, created_at FROM stores WHERE id = ?')
    .get(id);
  return NextResponse.json({ store }, { status: 201 });
}
