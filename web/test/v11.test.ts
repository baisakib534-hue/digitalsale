import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../lib/db';
import {
  normalizeCode,
  validateDiscount,
  createDiscount,
  incrementDiscountUse,
  deactivateDiscount,
} from '../lib/discounts';
import { canReview, createReview, productRating } from '../lib/reviews';
import { toggleWishlist, isWishlisted, wishlistFor } from '../lib/wishlist';

const DB_FILE = join(tmpdir(), `mosshaw-test-v11-${process.pid}.db`);

function seed(db: Database.Database, suffix: string) {
  const uid = `u-v11-${suffix}`;
  db.prepare(
    "INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(uid, `v11-${suffix}@gmail.com`, 'x');
  const sid = `s-v11-${suffix}`;
  db.prepare(
    "INSERT INTO stores (id, user_id, name, slug, status, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
  ).run(sid, uid, 'V11 Store', `v11-store-${suffix}`, 'active');
  const pid = `p-v11-${suffix}`;
  db.prepare(
    `INSERT INTO products (id, store_id, title, slug, description, price_usd, category, tags,
       status, created_at)
     VALUES (?, ?, 'V11 Software', 'v11-software-' || ?, 'A product.', 10000,
       'Software & Bots', '', 'published', datetime('now'))`
  ).run(pid, sid, suffix);
  const oid = `o-v11-${suffix}`;
  db.prepare(
    `INSERT INTO orders (id, product_id, buyer_id, buyer_email, amount_usd, fee_usd, seller_usd, status, created_at)
     VALUES (?, ?, ?, 'v11@gmail.com', 10000, 1000, 9000, 'paid', datetime('now'))`
  ).run(oid, pid, uid);
  return { uid, pid, oid };
}

describe('v11: discount codes', () => {
  let db: Database.Database;
  let pid: string;

  before(() => {
    rmSync(DB_FILE, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
    ({ pid } = seed(db, 'disc'));
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
  });

  it('normalizes codes (uppercase, trims)', () => {
    assert.equal(normalizeCode('  save20 '), 'SAVE20');
    assert.equal(normalizeCode('ab'), null, 'too short');
    assert.equal(normalizeCode('has space'), null);
    assert.equal(normalizeCode(123), null);
  });

  it('validates a percent code and computes the price', () => {
    createDiscount(db, pid, 'SAVE20', 'percent', 20, null, null);
    const r = validateDiscount(db, pid, 10000, 'save20');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.finalPriceCents, 8000);
      assert.equal(r.discountCents, 2000);
    }
  });

  it('validates a fixed code with a floor', () => {
    createDiscount(db, pid, 'FLAT50', 'fixed', 5000, null, null);
    const r = validateDiscount(db, pid, 10000, 'FLAT50');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.finalPriceCents, 5000);
    // fixed bigger than price → floor at 1 cent
    createDiscount(db, pid, 'FLATBIG', 'fixed', 99999, null, null);
    const r2 = validateDiscount(db, pid, 10000, 'FLATBIG');
    assert.equal(r2.ok, true);
    if (r2.ok) assert.equal(r2.finalPriceCents, 1);
  });

  it('rejects unknown, inactive, exhausted codes', () => {
    assert.equal(validateDiscount(db, pid, 10000, 'NOPE').ok, false);
    const d = createDiscount(db, pid, 'ONCE', 'percent', 10, 1, null);
    incrementDiscountUse(db, d.id);
    const r = validateDiscount(db, pid, 10000, 'ONCE');
    assert.equal(r.ok, false);
    if (!r.ok) assert.equal(r.reason, 'exhausted');
    assert.equal(deactivateDiscount(db, d.id), true);
    const r2 = validateDiscount(db, pid, 10000, 'ONCE');
    assert.equal(r2.ok, false);
    if (!r2.ok) assert.equal(r2.reason, 'inactive');
  });
});

describe('v11: reviews', () => {
  let db: Database.Database;
  let uid: string;
  let pid: string;
  let oid: string;

  before(() => {
    db = getDb();
    ({ uid, pid, oid } = seed(db, 'rev'));
  });

  it('allows a verified buyer one review per paid order', () => {
    const check = canReview(db, pid, oid, uid, 'v11@gmail.com');
    assert.deepEqual(check, { ok: true });
    const review = createReview(db, pid, oid, uid, 5, 'Excellent product!');
    assert.equal(review.rating, 5);
    const again = canReview(db, pid, oid, uid, 'v11@gmail.com');
    assert.deepEqual(again, { ok: false, reason: 'already-reviewed' });
  });

  it('rejects non-buyers and unpaid orders', () => {
    const r = canReview(db, pid, oid, 'u-stranger', 'stranger@gmail.com');
    assert.deepEqual(r, { ok: false, reason: 'not-buyer' });
    const oid2 = 'o-v11-pending';
    db.prepare(
      `INSERT INTO orders (id, product_id, buyer_id, buyer_email, amount_usd, fee_usd, seller_usd, status, created_at)
       VALUES (?, ?, ?, 'v11@gmail.com', 10000, 1000, 9000, 'pending', datetime('now'))`
    ).run(oid2, pid, uid);
    const r2 = canReview(db, pid, oid2, uid, 'v11@gmail.com');
    assert.deepEqual(r2, { ok: false, reason: 'not-paid' });
  });

  it('computes the average rating', () => {
    const rating = productRating(db, pid);
    assert.equal(rating.count, 1);
    assert.equal(rating.avg, 5);
  });
});

describe('v11: wishlist', () => {
  let db: Database.Database;
  let uid: string;
  let pid: string;

  before(() => {
    db = getDb();
    ({ uid, pid } = seed(db, 'wish'));
  });

  it('toggles wishlist state', () => {
    assert.equal(isWishlisted(db, uid, pid), false);
    assert.equal(toggleWishlist(db, uid, pid), true);
    assert.equal(isWishlisted(db, uid, pid), true);
    assert.equal(toggleWishlist(db, uid, pid), false);
    assert.equal(isWishlisted(db, uid, pid), false);
  });

  it('lists wishlisted product ids', () => {
    toggleWishlist(db, uid, pid);
    const set = wishlistFor(db, uid, [pid, 'p-other']);
    assert.ok(set.has(pid));
    assert.ok(!set.has('p-other'));
    toggleWishlist(db, uid, pid);
  });

  it('migration created the v11 tables and order columns', () => {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('discount_codes', 'reviews', 'wishlists')"
      )
      .all() as { name: string }[];
    assert.equal(tables.length, 3);
    const cols = db.prepare('PRAGMA table_info(orders)').all() as { name: string }[];
    assert.ok(cols.some((c) => c.name === 'discount_code'));
    assert.ok(cols.some((c) => c.name === 'discount_usd'));
  });
});
