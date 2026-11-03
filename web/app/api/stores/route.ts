import { NextResponse } from 'next/server';
import type Database from 'better-sqlite3';
import { getDb } from '../../../lib/db';
import { randomId } from '../../../lib/crypto';
import { slugify } from '../../../lib/format';
import { requireVerified } from '../../../lib/verify';
import { newWhitelabelToken } from '../../../lib/stores';

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
  // v12: every store gets a unique white-label storefront token at creation.
  let whitelabelToken: string | null = null;
  for (let attempt = 0; attempt < 5 && !whitelabelToken; attempt++) {
    const candidate = newWhitelabelToken();
    try {
      db.prepare(
        `INSERT INTO stores (id, user_id, name, slug, bio, whitelabel_token, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).run(id, uid, name, slug, bio, candidate);
      whitelabelToken = candidate;
    } catch (err) {
      if (!(err as Error).message.includes('UNIQUE')) throw err;
    }
  }
  if (!whitelabelToken) {
    // Extremely unlikely: fall back to a tokenless store; migrate backfills later.
    db.prepare(
      `INSERT INTO stores (id, user_id, name, slug, bio, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    ).run(id, uid, name, slug, bio);
  }

  const store = db
    .prepare('SELECT id, name, slug, bio, payout_usdt_address, created_at FROM stores WHERE id = ?')
    .get(id);
  return NextResponse.json({ store }, { status: 201 });
}

/**
 * PATCH /api/stores — update the caller's store settings.
 * Body: { name?, bio?, payout_usdt_address?, socials? }
 * Requires: logged in + Telegram verified.
 */
export async function PATCH(req: Request) {
  const db = getDb();
  const gated = requireVerified(db, req);
  if (gated instanceof NextResponse) return gated;
  const { uid } = gated;

  let body: { name?: unknown; bio?: unknown; payout_usdt_address?: unknown; socials?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }

  const store = db
    .prepare('SELECT id FROM stores WHERE user_id = ?')
    .get(uid) as { id: string } | undefined;
  if (!store) return NextResponse.json({ error: 'no-store' }, { status: 404 });

  const updates: string[] = [];
  const params: unknown[] = [];

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name.length < 2) return NextResponse.json({ error: 'invalid-name' }, { status: 400 });
    updates.push('name = ?');
    params.push(name);
  }
  if (body.bio !== undefined) {
    const bio = typeof body.bio === 'string' ? body.bio.trim().slice(0, 500) : '';
    updates.push('bio = ?');
    params.push(bio);
  }
  if (body.payout_usdt_address !== undefined) {
    const addr = typeof body.payout_usdt_address === 'string' ? body.payout_usdt_address.trim().slice(0, 100) : '';
    updates.push('payout_usdt_address = ?');
    params.push(addr);
  }
  if (body.socials !== undefined) {
    let socialsStr = '{}';
    try {
      socialsStr = JSON.stringify(body.socials ?? {});
    } catch {
      socialsStr = '{}';
    }
    updates.push('socials = ?');
    params.push(socialsStr);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'nothing-to-update' }, { status: 400 });
  }

  params.push(store.id);
  db.prepare(`UPDATE stores SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  const updated = db
    .prepare('SELECT id, name, slug, bio, payout_usdt_address, socials FROM stores WHERE id = ?')
    .get(store.id);
  return NextResponse.json({ store: updated });
}
