import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CATEGORIES } from '../lib/categories';
import { getDb, closeDb } from '../lib/db';
import { localDir } from '../lib/channelStore';
import { seedIfEmpty } from '../db/seed';
import type Database from 'better-sqlite3';

const DB_FILE = join(tmpdir(), `mosshaw-test-db-${process.pid}.db`);

describe('database schema + seed integrity', () => {
  let db: Database.Database;

  before(() => {
    rmSync(DB_FILE, { force: true });
    rmSync(`${DB_FILE}-wal`, { force: true });
    rmSync(`${DB_FILE}-shm`, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
  });

  it('creates all required tables', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all()
      .map((r: any) => r.name);
    for (const t of ['users', 'stores', 'products', 'product_files', 'orders']) {
      assert.ok(tables.includes(t), `missing table ${t}`);
    }
  });

  it('seeds a demo seller, store and buyer', () => {
    const users = db.prepare('SELECT email FROM users').all() as { email: string }[];
    const emails = users.map((u) => u.email);
    assert.ok(emails.includes('june.fernfield@gmail.com'), 'demo seller missing');
    assert.ok(emails.includes('buyer.demo@gmail.com'), 'demo buyer missing');
    const store = db.prepare('SELECT * FROM stores WHERE slug = ?').get('fern-and-field') as any;
    assert.ok(store, 'demo store missing');
    assert.equal(store.name, 'Fern & Field');
  });

  it('seeds 10 published products across the real categories', () => {
    const products = db.prepare("SELECT * FROM products WHERE status = 'published'").all() as any[];
    assert.equal(products.length, 10);
    const cats = new Set(products.map((p) => p.category));
    for (const c of CATEGORIES) assert.ok(cats.has(c), `category ${c} missing`);
    for (const p of products) {
      assert.ok(p.title.length > 10, 'title too short');
      assert.ok(p.description.length > 50, 'description too thin');
      assert.ok(p.price_usd > 0, 'price must be positive');
      assert.ok(p.cover_url, 'cover_url missing');
    }
  });

  it('generates SVG cover art files for every product', () => {
    const products = db.prepare('SELECT slug, cover_url FROM products').all() as any[];
    for (const p of products) {
      assert.ok(p.cover_url.startsWith('/covers/'), `bad cover_url ${p.cover_url}`);
      const abs = join(process.cwd(), 'public', p.cover_url);
      assert.ok(existsSync(abs), `cover file missing: ${abs}`);
      const svg = readFileSync(abs, 'utf8');
      assert.ok(svg.startsWith('<svg'), 'cover is not SVG');
      assert.ok(svg.includes('</svg>'), 'cover SVG truncated');
    }
  });

  it('seeds downloadable local files for every product', () => {
    const products = db.prepare('SELECT id FROM products').all() as any[];
    for (const p of products) {
      const files = db.prepare('SELECT * FROM product_files WHERE product_id = ?').all(p.id) as any[];
      assert.ok(files.length >= 1, `no files for product ${p.id}`);
      for (const f of files) {
        assert.equal(f.provider, 'local');
        assert.ok(f.local_path, 'local_path missing');
        // Same resolution as the download route: bare filename via localDir(),
        // with backward compat for old "storage/<file>" rows.
        const rel = f.local_path.startsWith('storage/')
          ? f.local_path.slice('storage/'.length)
          : f.local_path;
        assert.ok(existsSync(join(localDir(), rel)), `file missing on disk: ${f.local_path}`);
      }
    }
  });

  it('keeps the 10% fee math exact on every order', () => {
    const orders = db.prepare('SELECT amount_usd, fee_usd, seller_usd, affiliate_usd, status FROM orders').all() as any[];
    assert.ok(orders.length >= 4, 'expected demo orders');
    for (const o of orders) {
      assert.equal(o.fee_usd, Math.round((o.amount_usd * 10) / 100), 'fee must be 10% rounded');
      assert.equal(o.seller_usd, o.amount_usd - o.fee_usd - (o.affiliate_usd ?? 0), 'seller share must be amount - fee - affiliate');
      assert.equal(o.status, 'paid');
    }
  });

  it('demo buyer owns at least one paid order', () => {
    const buyer = db.prepare('SELECT id FROM users WHERE email = ?').get('buyer.demo@gmail.com') as any;
    const n = db
      .prepare("SELECT COUNT(*) AS c FROM orders WHERE buyer_id = ? AND status = 'paid'")
      .get(buyer.id) as { c: number };
    assert.ok(n.c >= 1, 'demo buyer has no paid orders');
  });

  it('seed is idempotent', () => {
    const beforeCount = (db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c;
    seedIfEmpty(db);
    const afterCount = (db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c;
    assert.equal(beforeCount, afterCount, 're-seed changed product count');
  });
});
