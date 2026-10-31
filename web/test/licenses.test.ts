import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../lib/db';
import {
  generateLicenseKey,
  issueLicenseKey,
  verifyLicenseKey,
  revokeLicenseKey,
} from '../lib/licenses';

const DB_FILE = join(tmpdir(), `mosshaw-test-licenses-${process.pid}.db`);

function seed(db: Database.Database) {
  const uid = 'u-lic';
  db.prepare(
    "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(uid, 'lic@gmail.com', 'x');
  const sid = 's-lic';
  db.prepare(
    "INSERT INTO stores (id, user_id, name, slug, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
  ).run(sid, uid, 'Lic Store', 'lic-store', 'active');
  const pid = 'p-lic';
  db.prepare(
    `INSERT INTO products (id, store_id, title, slug, description, price_usd, category, tags,
       status, license_keys, created_at)
     VALUES (?, ?, 'Lic Software', 'lic-software', 'A licensed software product.', 5000,
       'Software & Bots', '', 'published', 1, datetime('now'))`
  ).run(pid, sid);
  const oid = 'o-lic';
  db.prepare(
    `INSERT INTO orders (id, product_id, buyer_email, amount_usd, fee_usd, seller_usd, status, created_at)
     VALUES (?, ?, 'buyer@gmail.com', 5000, 500, 4500, 'paid', datetime('now'))`
  ).run(oid, pid);
  return { pid, oid };
}

describe('license keys', () => {
  let db: Database.Database;
  let pid: string;
  let oid: string;

  before(() => {
    rmSync(DB_FILE, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
    ({ pid, oid } = seed(db));
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
  });

  it('generates keys in XXXX-XXXX-XXXX-XXXX form from an unambiguous alphabet', () => {
    for (let i = 0; i < 20; i++) {
      const k = generateLicenseKey();
      assert.match(k, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}){3}$/);
    }
    const a = generateLicenseKey();
    const b = generateLicenseKey();
    assert.notEqual(a, b, 'keys should be unique');
  });

  it('issues one key per paid order, idempotently', () => {
    const first = issueLicenseKey(db, pid, oid);
    const second = issueLicenseKey(db, pid, oid);
    assert.equal(first.id, second.id, 're-issue must return the same key');
    assert.equal(first.license_key, second.license_key);
    const n = (db.prepare('SELECT COUNT(*) AS c FROM license_keys').get() as { c: number }).c;
    assert.equal(n, 1, 'duplicate rows created');
  });

  it('verifies a valid key and counts activations', () => {
    const issued = issueLicenseKey(db, pid, oid);
    const r1 = verifyLicenseKey(db, issued.license_key);
    assert.equal(r1.valid, true);
    if (r1.valid) assert.equal(r1.activations, 1);
    const r2 = verifyLicenseKey(db, issued.license_key.toLowerCase(), pid);
    assert.equal(r2.valid, true, 'lowercase + product scoping should work');
  });

  it('rejects unknown keys and product mismatches', () => {
    const bad = verifyLicenseKey(db, 'ZZZZ-ZZZZ-ZZZZ-ZZZZ');
    assert.equal(bad.valid, false);
    if (!bad.valid) assert.equal(bad.reason, 'not-found');
    const issued = issueLicenseKey(db, pid, oid);
    const mm = verifyLicenseKey(db, issued.license_key, 'p-other');
    assert.equal(mm.valid, false);
    if (!mm.valid) assert.equal(mm.reason, 'product-mismatch');
  });

  it('revoked keys stop verifying', () => {
    const issued = issueLicenseKey(db, pid, oid);
    assert.equal(revokeLicenseKey(db, issued.id), true);
    const r = verifyLicenseKey(db, issued.license_key);
    assert.equal(r.valid, false);
    if (!r.valid) assert.equal(r.reason, 'revoked');
    assert.equal(revokeLicenseKey(db, issued.id), false, 'double revoke is a no-op');
  });

  it('migration adds the license_keys column and table', () => {
    const cols = db.prepare('PRAGMA table_info(products)').all() as { name: string }[];
    assert.ok(cols.some((c) => c.name === 'license_keys'), 'products.license_keys missing');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'license_keys'")
      .all() as { name: string }[];
    assert.equal(tables.length, 1, 'license_keys table missing');
  });
});
