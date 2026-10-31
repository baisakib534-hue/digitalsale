import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../lib/db';
import { normalizeStockLimit, soldCount, stockInfo } from '../lib/stock';
import { getBadges, trendingIds, bestSellerIds } from '../lib/badges';

const DB_FILE = join(tmpdir(), `mosshaw-test-stock-${process.pid}.db`);

function makeStore(db: Database.Database) {
  const uid = `u-${Math.random().toString(36).slice(2)}`;
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, datetime(\'now\'))').run(
    uid, `${uid}@gmail.com`, 'x'
  );
  const sid = `s-${Math.random().toString(36).slice(2)}`;
  db.prepare('INSERT INTO stores (id, user_id, name, slug, status, created_at) VALUES (?, ?, ?, ?, ?, datetime(\'now\'))').run(
    sid, uid, 'Test Store', `test-${sid}`, 'active'
  );
  return sid;
}

function makeProduct(db: Database.Database, storeId: string, overrides: Record<string, unknown> = {}) {
  const pid = `p-${Math.random().toString(36).slice(2)}`;
  db.prepare(
    `INSERT INTO products (id, store_id, title, slug, description, price_usd, category, tags,
       status, stock_limit, created_at)
     VALUES (?, ?, 'Test Product', ?, 'A test product description.', 1000, 'Templates', '',
       'published', ?, datetime('now'))`
  ).run(pid, storeId, `test-${pid}`, (overrides.stock_limit ?? null) as number | null);
  return pid;
}

function makeOrder(db: Database.Database, productId: string, status: string, daysAgo = 0) {
  const oid = `o-${Math.random().toString(36).slice(2)}`;
  db.prepare(
    `INSERT INTO orders (id, product_id, buyer_email, amount_usd, fee_usd, seller_usd, status, created_at)
     VALUES (?, ?, 'buyer@gmail.com', 1000, 100, 900, ?, datetime('now', ?))`
  ).run(oid, productId, status, `-${daysAgo} days`);
}

describe('normalizeStockLimit', () => {
  it('null/undefined/empty = unlimited', () => {
    assert.equal(normalizeStockLimit(null), null);
    assert.equal(normalizeStockLimit(undefined), null);
    assert.equal(normalizeStockLimit(''), null);
  });
  it('accepts positive integers', () => {
    assert.equal(normalizeStockLimit(50), 50);
    assert.equal(normalizeStockLimit('25'), 25);
  });
  it('rejects zero, negatives, fractions and junk', () => {
    assert.equal(normalizeStockLimit(0), 'invalid');
    assert.equal(normalizeStockLimit(-5), 'invalid');
    assert.equal(normalizeStockLimit(2.5), 'invalid');
    assert.equal(normalizeStockLimit('abc'), 'invalid');
  });
});

describe('stock limits', () => {
  let db: Database.Database;
  let storeId: string;

  before(() => {
    rmSync(DB_FILE, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
    storeId = makeStore(db);
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
  });

  it('unlimited product never sells out', () => {
    const pid = makeProduct(db, storeId);
    for (let i = 0; i < 5; i++) makeOrder(db, pid, 'paid');
    const info = stockInfo(db, { id: pid, stock_limit: null });
    assert.equal(info.soldOut, false);
    assert.equal(info.stockLimit, null);
  });

  it('sold out when paid orders reach the cap', () => {
    const pid = makeProduct(db, storeId, { stock_limit: 2 });
    makeOrder(db, pid, 'paid');
    let info = stockInfo(db, { id: pid, stock_limit: 2 });
    assert.equal(info.soldOut, false);
    assert.equal(info.remaining, 1);
    makeOrder(db, pid, 'paid');
    info = stockInfo(db, { id: pid, stock_limit: 2 });
    assert.equal(info.soldOut, true);
    assert.equal(info.sold, 2);
  });

  it('recent pending orders hold stock; old pending orders do not', () => {
    const pid = makeProduct(db, storeId, { stock_limit: 1 });
    makeOrder(db, pid, 'pending', 0); // just now
    assert.equal(soldCount(db, pid), 1);
    const pid2 = makeProduct(db, storeId, { stock_limit: 1 });
    makeOrder(db, pid2, 'pending', 2); // 2 days ago — invoice long expired
    assert.equal(soldCount(db, pid2), 0);
  });

  it('migration adds the stock_limit column', () => {
    const cols = db.prepare('PRAGMA table_info(products)').all() as { name: string }[];
    assert.ok(cols.some((c) => c.name === 'stock_limit'), 'stock_limit column missing');
  });
});

describe('merchandising badges', () => {
  let db: Database.Database;
  let storeId: string;

  before(() => {
    rmSync(DB_FILE, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
    storeId = makeStore(db);
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
  });

  it('best-seller goes to the top revenue product (30d)', () => {
    const rich = makeProduct(db, storeId);
    const poor = makeProduct(db, storeId);
    for (let i = 0; i < 3; i++) makeOrder(db, rich, 'paid', 2);
    makeOrder(db, poor, 'paid', 2);
    const badges = getBadges(db);
    assert.ok((badges.get(rich) ?? []).includes('best-seller'), 'rich product missing best-seller');
    assert.ok((badges.get(poor) ?? []).includes('trending'), 'poor product missing trending');
    assert.ok(bestSellerIds(db).includes(rich), 'rich product missing from bestSellerIds');
  });

  it('trending goes to recent orders (7d), not stale ones', () => {
    const hot = makeProduct(db, storeId);
    const cold = makeProduct(db, storeId);
    for (let i = 0; i < 2; i++) makeOrder(db, hot, 'paid', 1);
    for (let i = 0; i < 5; i++) makeOrder(db, cold, 'paid', 20); // 20 days ago
    const badges = getBadges(db);
    assert.ok((badges.get(hot) ?? []).includes('trending'), 'hot product missing trending');
    assert.ok(!(badges.get(cold) ?? []).includes('trending'), 'stale product wrongly trending');
    assert.ok(trendingIds(db).includes(hot), 'hot product missing from trendingIds');
  });

  it('new badge goes to recently published products', () => {
    const fresh = makeProduct(db, storeId);
    const badges = getBadges(db);
    assert.ok((badges.get(fresh) ?? []).includes('new'), 'fresh product missing new badge');
  });

  it('suspended stores are excluded from badges', () => {
    const badStore = makeStore(db);
    db.prepare('UPDATE stores SET status = ? WHERE id = ?').run('suspended', badStore);
    const pid = makeProduct(db, badStore);
    for (let i = 0; i < 5; i++) makeOrder(db, pid, 'paid', 1);
    const badges = getBadges(db);
    assert.equal(badges.get(pid), undefined, 'suspended store product should have no badges');
  });
});
