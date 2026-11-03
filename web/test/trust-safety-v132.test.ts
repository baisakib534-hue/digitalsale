import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { banUser, isBanned } from '../lib/admin';
import { REPORT_REASONS } from '../lib/reports';

function freshDb(): Database.Database {
  const db = new Database(':memory:');
  // NOTE: matches the REAL schema (db/schema.sql + migrations) — users has
  // banned_at/ban_reason, there is no users.status column. Do not re-add it.
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, banned_at TEXT, ban_reason TEXT);
    CREATE TABLE stores (id TEXT PRIMARY KEY, user_id TEXT NOT NULL);
    CREATE TABLE products (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft');
  `);
  return db;
}

describe('v13.2 trust & safety', () => {
  it('banUser permanently bans + suspends published products', () => {
    const db = freshDb();
    db.prepare(`INSERT INTO users (id) VALUES ('u1')`).run();
    db.prepare(`INSERT INTO stores (id, user_id) VALUES ('s1', 'u1')`).run();
    db.prepare(`INSERT INTO products (id, store_id, status) VALUES ('p1', 's1', 'published'), ('p2', 's1', 'draft')`).run();
    assert.equal(banUser(db, 'u1', 'illegal content'), true);
    const u = db.prepare(`SELECT banned_at, ban_reason FROM users WHERE id='u1'`).get() as any;
    assert.ok(u.banned_at);
    assert.equal(u.ban_reason, 'illegal content');
    assert.equal(isBanned(db, 'u1'), true);
    const p1 = db.prepare(`SELECT status FROM products WHERE id='p1'`).get() as any;
    assert.equal(p1.status, 'suspended');
    const p2 = db.prepare(`SELECT status FROM products WHERE id='p2'`).get() as any;
    assert.equal(p2.status, 'draft'); // drafts untouched
    assert.equal(banUser(db, 'u1', 'again'), false); // double-ban no-op
    assert.equal(banUser(db, 'nope', 'x'), false); // unknown user no-op
    db.close();
  });

  it('illegal is a valid report reason', () => {
    assert.ok((REPORT_REASONS as readonly string[]).includes('illegal'));
  });
});
