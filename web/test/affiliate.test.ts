import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../lib/db';
import { BRAND } from '../lib/brand';
import {
  REF_COOKIE,
  REF_TTL_SECONDS,
  MIN_COMMISSION,
  MAX_COMMISSION,
  splitSale,
  validateCommission,
  genAffiliateCode,
  recordClick,
  resolveAffiliate,
  setRefCookieHeader,
  clearRefCookieHeader,
  getRefCode,
} from '../lib/affiliate';

const DB_FILE = join(tmpdir(), `mosshaw-test-affiliate-${process.pid}.db`);

describe('affiliate money math', () => {
  it('splits $100 at 20% commission exactly (platform 10 / affiliate 20 / seller 70)', () => {
    assert.deepEqual(splitSale(10000, 20), { platform: 1000, affiliate: 2000, seller: 7000 });
  });

  it('platform + affiliate + seller always equals the amount', () => {
    for (const cents of [1, 99, 100, 333, 1999, 10000, 99999]) {
      for (const pct of [MIN_COMMISSION, 20, MAX_COMMISSION]) {
        const s = splitSale(cents, pct);
        assert.equal(s.platform + s.affiliate + s.seller, cents, `split broken for ${cents}@${pct}%`);
      }
    }
  });

  it('uses the 10% platform fee by default', () => {
    assert.equal(BRAND.feePercent, 10);
    assert.equal(splitSale(10000, 20).platform, 1000);
  });

  it('throws on out-of-range commission', () => {
    assert.throws(() => splitSale(10000, 4), /commission/);
    assert.throws(() => splitSale(10000, 61), /commission/);
  });
});

describe('validateCommission', () => {
  it('accepts 5–60 inclusive', () => {
    assert.equal(validateCommission(5), true);
    assert.equal(validateCommission(20), true);
    assert.equal(validateCommission(60), true);
  });
  it('rejects outside 5–60 and non-numbers', () => {
    assert.equal(validateCommission(4), false);
    assert.equal(validateCommission(61), false);
    assert.equal(validateCommission(NaN), false);
    assert.equal(validateCommission('20'), false);
    assert.equal(validateCommission(undefined), false);
  });
});

describe('genAffiliateCode', () => {
  it('generates 8-char URL-safe codes', () => {
    const code = genAffiliateCode();
    assert.equal(code.length, 8);
    assert.match(code, /^[A-Za-z0-9]{8}$/);
    assert.notEqual(code, genAffiliateCode(), 'two codes should differ');
  });
});

describe('ref cookie helpers', () => {
  it('sets a 30-day httpOnly cookie', () => {
    const h = setRefCookieHeader('ABC123XY');
    assert.ok(h.startsWith(`${REF_COOKIE}=ABC123XY`), 'cookie name/value');
    assert.ok(h.includes('HttpOnly'), 'httpOnly');
    assert.ok(h.includes(`Max-Age=${REF_TTL_SECONDS}`), '30-day TTL');
    assert.equal(REF_TTL_SECONDS, 30 * 24 * 60 * 60);
  });
  it('clears the cookie with Max-Age=0', () => {
    assert.ok(clearRefCookieHeader().includes('Max-Age=0'));
  });
  it('reads the code back from a request', () => {
    const req = new Request('https://x.test/', { headers: { cookie: `${REF_COOKIE}=GROVE7Q2A` } });
    assert.equal(getRefCode(req), 'GROVE7Q2A');
    const empty = new Request('https://x.test/');
    assert.equal(getRefCode(empty), null);
  });
});

describe('click tracking + attribution (db)', () => {
  let db: Database.Database;

  before(() => {
    rmSync(DB_FILE, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
    db.prepare("INSERT INTO users (id, email, name) VALUES ('u-aff', 'aff@gmail.com', 'Aff')").run();
    db.prepare("INSERT INTO affiliates (id, user_id, code) VALUES ('a1', 'u-aff', 'PROMO123')").run();
    db.prepare(
      "INSERT INTO stores (id, user_id, name, slug) VALUES ('s1', 'u-aff', 'Store', 'store')"
    ).run();
    db.prepare(
      "INSERT INTO products (id, store_id, title, slug, price_usd, category, status) VALUES ('p-on', 's1', 'On', 'on', 10000, 'Presets', 'published')"
    ).run();
    db.prepare(
      "INSERT INTO products (id, store_id, title, slug, price_usd, category, status) VALUES ('p-off', 's1', 'Off', 'off', 10000, 'Presets', 'published')"
    ).run();
    db.prepare(
      "INSERT INTO product_affiliates (product_id, enabled, commission_percent, updated_at) VALUES ('p-on', 1, 25, datetime('now'))"
    ).run();
    db.prepare(
      "INSERT INTO product_affiliates (product_id, enabled, commission_percent, updated_at) VALUES ('p-off', 0, 20, datetime('now'))"
    ).run();
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
    rmSync(`${DB_FILE}-wal`, { force: true });
    rmSync(`${DB_FILE}-shm`, { force: true });
  });

  it('dedupes clicks: one per code+product+ip per 24h', () => {
    assert.equal(recordClick(db, 'PROMO123', 'p-on', '1.2.3.4'), true);
    assert.equal(recordClick(db, 'PROMO123', 'p-on', '1.2.3.4'), false, 'same ip within 24h not counted');
    assert.equal(recordClick(db, 'PROMO123', 'p-on', '5.6.7.8'), true, 'different ip counts');
    assert.equal(recordClick(db, 'PROMO123', 'p-off', '1.2.3.4'), true, 'different product counts');
    assert.equal(recordClick(db, 'PROMO123', null, '1.2.3.4'), true, 'storefront click counts');
  });

  it('attributes a valid code on an enabled product', () => {
    const r = resolveAffiliate(db, 'p-on', 10000, 'PROMO123');
    assert.ok(r, 'expected attribution');
    assert.equal(r.code, 'PROMO123');
    assert.equal(r.commissionPercent, 25);
    assert.equal(r.affiliateUsd, 2500, '25% of $100');
  });

  it('ignores invalid codes silently', () => {
    assert.equal(resolveAffiliate(db, 'p-on', 10000, 'NOPE1234'), null);
    assert.equal(resolveAffiliate(db, 'p-on', 10000, null), null);
  });

  it('ignores codes when the product has affiliates off', () => {
    assert.equal(resolveAffiliate(db, 'p-off', 10000, 'PROMO123'), null);
  });

  it('ignores codes for unknown products', () => {
    assert.equal(resolveAffiliate(db, 'p-missing', 10000, 'PROMO123'), null);
  });
});
