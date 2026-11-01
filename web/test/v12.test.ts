import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../lib/db';
import {
  parseSocials,
  normalizeSocials,
  socialUrl,
  newWhitelabelToken,
  getStoreByToken,
  getStoreByApiToken,
  createStoreApiToken,
  revokeStoreApiToken,
  queueChannelPost,
} from '../lib/stores';

const DB_FILE = join(tmpdir(), `mosshaw-test-v12-${process.pid}.db`);

describe('v12: seller profiles + white-label + seller API', () => {
  let db: Database.Database;
  let storeId: string;

  before(() => {
    rmSync(DB_FILE, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
    db.prepare(
      "INSERT INTO users (id, email, password_hash, created_at) VALUES ('u-v12', 'v12@gmail.com', 'x', datetime('now'))"
    ).run();
    storeId = 's-v12';
    db.prepare(
      `INSERT INTO stores (id, user_id, name, slug, whitelabel_token, status, created_at)
       VALUES (?, 'u-v12', 'V12 Store', 'v12-store', ?, 'active', datetime('now'))`
    ).run(storeId, newWhitelabelToken());
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
  });

  it('backfills a unique whitelabel token per store', () => {
    // Simulate a pre-v12 store without a token, then run the backfill step.
    db.prepare(
      `INSERT INTO stores (id, user_id, name, slug, status, created_at)
       VALUES ('s-v12-legacy', 'u-v12', 'Legacy', 'v12-legacy', 'active', datetime('now'))`
    ).run();
    const before = db.prepare('SELECT whitelabel_token FROM stores WHERE id = ?').get('s-v12-legacy') as {
      whitelabel_token: string | null;
    };
    assert.equal(before.whitelabel_token, null);
    // Same logic as migrate.ts step 14.
    const { randomBytes } = require('node:crypto') as typeof import('node:crypto');
    db.prepare('UPDATE stores SET whitelabel_token = ? WHERE id = ?').run(
      `st_${randomBytes(18).toString('base64url')}`,
      's-v12-legacy'
    );
    const row = db.prepare('SELECT whitelabel_token FROM stores WHERE id = ?').get('s-v12-legacy') as {
      whitelabel_token: string | null;
    };
    assert.ok(row.whitelabel_token?.startsWith('st_'), 'token missing or malformed');
    assert.match(row.whitelabel_token!, /^st_[A-Za-z0-9_-]{16,64}$/);
  });

  it('newWhitelabelToken generates unique tokens', () => {
    const a = newWhitelabelToken();
    const b = newWhitelabelToken();
    assert.notEqual(a, b);
    assert.match(a, /^st_[A-Za-z0-9_-]{16,64}$/);
  });

  it('getStoreByToken finds active stores, rejects junk', () => {
    const row = db.prepare('SELECT whitelabel_token FROM stores WHERE id = ?').get(storeId) as {
      whitelabel_token: string;
    };
    const found = getStoreByToken(db, row.whitelabel_token);
    assert.equal(found?.id, storeId);
    assert.equal(getStoreByToken(db, 'st_nonexistent123456'), undefined);
    assert.equal(getStoreByToken(db, 'not-a-token'), undefined);
    assert.equal(getStoreByToken(db, ''), undefined);
  });

  it('normalizes socials (drops junk, keeps handles and urls)', () => {
    const out = normalizeSocials({
      website: 'https://example.com',
      x: '@maker',
      instagram: 'maker.studio',
      youtube: 'not a url',
      telegram: 'mychannel',
      evil: '1; DROP TABLE stores',
    });
    assert.equal(out.website, 'https://example.com');
    assert.equal(out.x, '@maker');
    assert.equal(out.instagram, 'maker.studio');
    assert.equal(out.youtube, undefined);
    assert.equal(out.telegram, 'mychannel');
    assert.deepEqual(parseSocials(JSON.stringify(out)), out);
    assert.deepEqual(parseSocials('garbage'), {});
  });

  it('builds social urls from handles', () => {
    assert.equal(socialUrl('x', '@maker'), 'https://x.com/maker');
    assert.equal(socialUrl('instagram', 'maker'), 'https://instagram.com/maker');
    assert.equal(socialUrl('telegram', '@ch'), 'https://t.me/ch');
    assert.equal(socialUrl('website', 'https://example.com'), 'https://example.com');
  });

  it('creates, authenticates and revokes API tokens', () => {
    const { token } = createStoreApiToken(db, storeId, 'My mini app');
    assert.ok(token.startsWith('dst_'));
    const store = getStoreByApiToken(db, token);
    assert.equal(store?.id, storeId);
    assert.equal(getStoreByApiToken(db, 'dst_bogus'), undefined);
    assert.equal(getStoreByApiToken(db, null), undefined);
    const row = db.prepare('SELECT id FROM store_api_tokens WHERE token = ?').get(token) as { id: string };
    assert.equal(revokeStoreApiToken(db, storeId, row.id), true);
    assert.equal(getStoreByApiToken(db, token), undefined, 'revoked token must not auth');
  });

  it('queues channel posts only for stores with auto-post channels', () => {
    db.prepare(
      `INSERT INTO products (id, store_id, title, slug, description, price_usd, category, status, created_at)
       VALUES ('p-v12', ?, 'V12 Product', 'v12-product', '', 1000, 'Presets', 'published', datetime('now'))`
    ).run(storeId);
    // no channels linked → no queue
    assert.equal(queueChannelPost(db, storeId, 'p-v12'), false);
    db.prepare(
      `INSERT INTO store_channels (id, store_id, channel_id, channel_title, auto_post, created_at)
       VALUES ('ch-v12', ?, '-100123', 'My channel', 1, datetime('now'))`
    ).run(storeId);
    assert.equal(queueChannelPost(db, storeId, 'p-v12'), true);
    const q = db.prepare("SELECT status FROM channel_post_queue WHERE product_id = 'p-v12'").get() as {
      status: string;
    };
    assert.equal(q.status, 'pending');
    // idempotent
    assert.equal(queueChannelPost(db, storeId, 'p-v12'), true);
    const n = (db.prepare("SELECT COUNT(*) AS c FROM channel_post_queue WHERE product_id = 'p-v12'").get() as {
      c: number;
    }).c;
    assert.equal(n, 1);
  });

  it('migration created the v12 tables and columns', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('store_images', 'store_api_tokens', 'seller_bots', 'store_channels', 'channel_post_queue')"
      )
      .all() as { name: string }[];
    assert.equal(tables.length, 5);
    const cols = db.prepare('PRAGMA table_info(stores)').all() as { name: string }[];
    assert.ok(cols.some((c) => c.name === 'socials'));
    assert.ok(cols.some((c) => c.name === 'whitelabel_token'));
  });
});
