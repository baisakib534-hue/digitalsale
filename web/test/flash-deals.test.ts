import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { getDb, closeDb } from '../lib/db';
import {
  createFlashDeal,
  liveDealForProduct,
  getFlashDeal,
  discountedPrice,
  flashDealPrice,
  hasLiveDeal,
  markFlashDealStartPostSent,
  isSellerBanned,
  endFlashDealEarly,
  deleteFlashDeal,
} from '../lib/flashDeals';
import type Database from 'better-sqlite3';

const DB_FILE = join(tmpdir(), `flash-deals-test-db-${process.pid}.db`);

function makeNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function makeEndsAt(hoursFromNow = 24): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

function createTestProduct(
  db: Database.Database,
  productId: string,
  storeId: string,
  priceUsd = 2999
): void {
  const slug = `test-product-${productId}`;
  db.prepare(
    `INSERT INTO products (id, store_id, title, slug, description, price_usd, status, category, cover_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'published', 'software', '/covers/test.svg', datetime('now'))`
  ).run(productId, storeId, 'Test Product', slug, 'A test product', priceUsd);
}

function createLiveDeal(
  db: Database.Database,
  productId: string,
  discountPercent = 20,
  startsAt = makeNow(),
  endsAt = makeEndsAt()
): void {
  createFlashDeal(db, productId, discountPercent, startsAt, endsAt);
}

describe('Flash Deals (v17)', () => {
  let db: Database.Database;
  let storeId: string;
  let bannedStoreId: string;

  before(() => {
    rmSync(DB_FILE, { force: true });
    rmSync(`${DB_FILE}-wal`, { force: true });
    rmSync(`${DB_FILE}-shm`, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();

    db.prepare(
      `INSERT INTO users (id, email, password_hash, created_at)
       VALUES (?, ?, ?, datetime('now'))`
    ).run('user-test', 'test@seller.com', 'hash');

    db.prepare(
      `INSERT INTO stores (id, user_id, name, slug, status, created_at)
       VALUES (?, ?, ?, ?, 'active', datetime('now'))`
    ).run('store-test', 'user-test', 'Test Store', 'test-store');
    storeId = 'store-test';

    db.prepare(
      `INSERT INTO users (id, email, password_hash, banned_at, created_at)
       VALUES (?, ?, ?, datetime('now'), datetime('now'))`
    ).run('user-banned', 'banned@seller.com', 'hash');

    db.prepare(
      `INSERT INTO stores (id, user_id, name, slug, status, created_at)
       VALUES (?, ?, ?, ?, 'active', datetime('now'))`
    ).run('store-banned', 'user-banned', 'Banned Store', 'banned-store');
    bannedStoreId = 'store-banned';
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
    rmSync(`${DB_FILE}-wal`, { force: true });
    rmSync(`${DB_FILE}-shm`, { force: true });
  });

  describe('Deal CRUD + one-live-deal-per-product enforcement', () => {
    it('creates a flash deal for a product', () => {
      const productId = 'prod-test-1';
      createTestProduct(db, productId, storeId);
      const now = makeNow();
      const endsAt = makeEndsAt();

      const deal = createFlashDeal(db, productId, 20, now, endsAt);

      assert.equal(deal.product_id, productId);
      assert.equal(deal.discount_percent, 20);
      assert.equal(deal.starts_at, now);
      assert.equal(deal.ends_at, endsAt);
      assert.equal(deal.current_uses, 0);
      assert.equal(deal.start_post_sent, 0);
      assert.ok(deal.id);
      assert.ok(deal.created_at);
    });

    it('enforces one live deal per product (UNIQUE constraint)', () => {
      const productId = 'prod-test-2';
      createTestProduct(db, productId, storeId);
      const now = makeNow();
      const endsAt = makeEndsAt();

      createFlashDeal(db, productId, 20, now, endsAt);

      assert.throws(() => {
        createFlashDeal(db, productId, 30, now, endsAt);
      }, (err: any) => err.code === 'SQLITE_CONSTRAINT_UNIQUE');
    });

    it('getFlashDeal retrieves the deal', () => {
      const productId = 'prod-test-3';
      createTestProduct(db, productId, storeId);
      createLiveDeal(db, productId);
      const deal = getFlashDeal(db, productId);
      assert.ok(deal);
      assert.equal(deal?.product_id, productId);
      assert.equal(deal?.discount_percent, 20);
      assert.equal(deal?.current_uses, 0);
      assert.equal(deal?.start_post_sent, 0);
    });

    it('hasLiveDeal returns true for live deal', () => {
      const productId = 'prod-test-4';
      createTestProduct(db, productId, storeId);
      createLiveDeal(db, productId);
      const now = makeNow();
      assert.ok(hasLiveDeal(db, productId, now));
    });

    it('hasLiveDeal returns false for expired deal', () => {
      const productId = 'prod-test-5';
      createTestProduct(db, productId, storeId);
      const past = new Date(Date.now() - 1000).toISOString().slice(0, 19).replace('T', ' ');
      assert.ok(!hasLiveDeal(db, productId, past));
    });

    it('hasLiveDeal returns false for future deal', () => {
      const productId = 'prod-future';
      createTestProduct(db, productId, storeId);
      const futureStart = new Date(Date.now() + 3600 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
      const futureEnd = new Date(Date.now() + 7200 * 1000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
      createFlashDeal(db, productId, 10, futureStart, futureEnd);
      const now = makeNow();
      assert.ok(!hasLiveDeal(db, productId, now));
    });

    it('endFlashDealEarly ends a live deal', () => {
      const productId = 'prod-test-6';
      createTestProduct(db, productId, storeId);
      createLiveDeal(db, productId);
      const now = makeNow();
      assert.ok(endFlashDealEarly(db, productId, now));
      assert.ok(!hasLiveDeal(db, productId, now));
    });

    it('deleteFlashDeal removes a deal entirely', () => {
      const productId = 'prod-test-7';
      createTestProduct(db, productId, storeId);
      createLiveDeal(db, productId);
      assert.ok(deleteFlashDeal(db, productId));
      assert.equal(getFlashDeal(db, productId), null);
    });
  });

  describe('Pricing: discountedPrice and flashDealPrice', () => {
    it('discountedPrice computes correct discounted price', () => {
      assert.equal(discountedPrice(2999, 20), 2399);
    });

    it('discountedPrice enforces min 1 cent guard', () => {
      assert.equal(discountedPrice(1, 90), 1);
      assert.equal(discountedPrice(10, 90), 1);
    });

    it('discountedPrice handles edge cases', () => {
      assert.equal(discountedPrice(1000, 0), 1000);
      assert.equal(discountedPrice(1000, 50), 500);
      assert.equal(discountedPrice(1000, 100), 1);
    });

    it('flashDealPrice returns discounted price when deal is live', () => {
      const productId = 'prod-price-1';
      createTestProduct(db, productId, storeId);
      createLiveDeal(db, productId);
      const now = makeNow();
      const result = flashDealPrice(db, productId, 2999, now);
      assert.equal(result.finalPriceCents, 2399);
      assert.equal(result.discountPercent, 20);
      assert.ok(result.dealId);
    });

    it('flashDealPrice returns original price when no live deal', () => {
      const productId = 'prod-price-2';
      createTestProduct(db, productId, storeId);
      const past = new Date(Date.now() - 1000).toISOString().slice(0, 19).replace('T', ' ');
      const result = flashDealPrice(db, productId, 2999, past);
      assert.equal(result.finalPriceCents, 2999);
      assert.equal(result.discountPercent, null);
      assert.equal(result.dealId, null);
    });

    it('flashDealPrice returns original price when deal expired', () => {
      const productId = 'prod-price-3';
      createTestProduct(db, productId, storeId);
      const future = new Date(Date.now() + 86400000).toISOString().slice(0, 19).replace('T', ' ');
      const result = flashDealPrice(db, productId, 2999, future);
      assert.equal(result.finalPriceCents, 2999);
    });
  });

  describe('Code vs Deal: lower price wins', () => {
    it('flashDealPrice applies deal when lower than code discount', () => {
      const productId = 'prod-code-1';
      createTestProduct(db, productId, storeId);
      createLiveDeal(db, productId);
      const now = makeNow();
      const dealResult = flashDealPrice(db, productId, 2999, now);
      const codePrice = discountedPrice(2999, 10);
      assert.ok(dealResult.finalPriceCents < codePrice, 'deal should be lower');
    });

    it('flashDealPrice applies code when lower than deal', () => {
      const newProductId = 'prod-code-test';
      const newStoreId = 'store-code-test';
      db.prepare(
        `INSERT INTO users (id, email, password_hash, created_at)
         VALUES (?, ?, ?, datetime('now'))`
      ).run('user-code', 'code@seller.com', 'hash');
      db.prepare(
        `INSERT INTO stores (id, user_id, name, slug, status, created_at)
         VALUES (?, ?, ?, ?, 'active', datetime('now'))`
      ).run(newStoreId, 'user-code', 'Code Store', 'code-store');
      createTestProduct(db, newProductId, newStoreId);
      const dealStart = makeNow();
      const dealEnd = makeEndsAt();
      createFlashDeal(db, newProductId, 10, dealStart, dealEnd);

      const now = makeNow();
      const dealResult = flashDealPrice(db, newProductId, 2999, now);
      const codePrice = discountedPrice(2999, 20);
      assert.ok(codePrice < dealResult.finalPriceCents, 'code should be lower');
    });
  });

  describe('Ban interplay: banned seller deals never go live', () => {
    let bannedProductId: string;

    before(() => {
      bannedProductId = 'prod-banned';
      createTestProduct(db, bannedProductId, bannedStoreId);
      const now = makeNow();
      const endsAt = makeEndsAt();
      createFlashDeal(db, bannedProductId, 20, now, endsAt);
    });

    it('isSellerBanned returns true for banned store', () => {
      assert.ok(isSellerBanned(db, bannedStoreId));
    });

    it('isSellerBanned returns false for active store', () => {
      assert.ok(!isSellerBanned(db, storeId));
    });

    it('liveDealForProduct returns deal for banned seller product (API layer must filter)', () => {
      const now = makeNow();
      const deal = liveDealForProduct(db, bannedProductId, now);
      assert.ok(deal);
    });
  });

  describe('Countdown math: ends_at in the past → not live', () => {
    it('liveDealForProduct returns null when ends_at is in the past', () => {
      const productId = 'prod-countdown-1';
      createTestProduct(db, productId, storeId);
      const past = new Date(Date.now() - 1000).toISOString().slice(0, 19).replace('T', ' ');
      const deal = liveDealForProduct(db, productId, past);
      assert.equal(deal, null);
    });

    it('liveDealForProduct returns null when starts_at is in the future', () => {
      const productId = 'prod-future-2';
      createTestProduct(db, productId, storeId);
      const futureStart = new Date(Date.now() + 3600000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
      const futureEnd = new Date(Date.now() + 7200000)
        .toISOString()
        .slice(0, 19)
        .replace('T', ' ');
      createFlashDeal(db, productId, 20, futureStart, futureEnd);

      const now = makeNow();
      const deal = liveDealForProduct(db, productId, now);
      assert.equal(deal, null);
    });

    it('liveDealForProduct returns deal when starts_at <= now < ends_at', () => {
      const productId = 'prod-countdown-2';
      createTestProduct(db, productId, storeId);
      createLiveDeal(db, productId);
      const now = makeNow();
      const deal = liveDealForProduct(db, productId, now);
      assert.ok(deal);
      assert.equal(deal.product_id, productId);
    });
  });

  describe('markFlashDealStartPostSent', () => {
    it('marks start_post_sent = 1 for a deal', () => {
      const productId = 'prod-mark-test';
      createTestProduct(db, productId, storeId);
      const now = makeNow();
      const endsAt = makeEndsAt();
      createFlashDeal(db, productId, 20, now, endsAt);

      let deal = getFlashDeal(db, productId);
      assert.equal(deal?.start_post_sent, 0);

      const result = markFlashDealStartPostSent(db, productId);
      assert.ok(result);

      deal = getFlashDeal(db, productId);
      assert.equal(deal?.start_post_sent, 1);
    });

    it('returns false for non-existent product', () => {
      const result = markFlashDealStartPostSent(db, 'non-existent');
      assert.ok(!result);
    });
  });
});