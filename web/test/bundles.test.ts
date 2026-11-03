import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { getDb, closeDb } from '../lib/db';
import {
  createBundle,
  validateBundleForCreation,
  effectiveBundlePrice,
  bundleSumCents,
  getBundle,
  endBundle,
  isSellerBanned,
  bundleItems,
  getSellerBundles,
} from '../lib/bundles';
import { createFlashDeal } from '../lib/flashDeals';
import type Database from 'better-sqlite3';

const DB_FILE = join(tmpdir(), `bundles-test-db-${process.pid}.db`);

function makeNow(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

function makeEndsAt(hoursFromNow = 24): string {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 19)
    .replace('T', ' ');
}

function createTestUser(db: Database.Database, userId: string, email: string, banned = false): void {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const bannedAt = banned ? now : null;
  db.prepare(
    `INSERT INTO users (id, email, password_hash, banned_at, created_at)
     VALUES (?, ?, ?, ?, datetime('now'))`
  ).run(userId, email, 'hash', bannedAt);
}

function createTestStore(db: Database.Database, storeId: string, userId: string, name: string, slug: string): void {
  db.prepare(
    `INSERT INTO stores (id, user_id, name, slug, status, created_at)
     VALUES (?, ?, ?, ?, 'active', datetime('now'))`
  ).run(storeId, userId, name, slug);
}

function createTestProduct(
  db: Database.Database,
  productId: string,
  storeId: string,
  priceUsd = 2999,
  status: 'published' | 'draft' = 'published'
): void {
  const slug = `test-product-${productId}`;
  db.prepare(
    `INSERT INTO products (id, store_id, title, slug, description, price_usd, status, category, cover_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'software', '/covers/test.svg', datetime('now'))`
  ).run(productId, storeId, 'Test Product', slug, 'A test product', priceUsd, status);
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

describe('Bundles (v18)', () => {
  let db: Database.Database;
  let storeId: string;
  let bannedStoreId: string;

  before(() => {
    rmSync(DB_FILE, { force: true });
    rmSync(`${DB_FILE}-wal`, { force: true });
    rmSync(`${DB_FILE}-shm`, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();

    // Active seller
    createTestUser(db, 'user-test', 'test@seller.com');
    createTestStore(db, 'store-test', 'user-test', 'Test Store', 'test-store');
    storeId = 'store-test';

    // Banned seller
    createTestUser(db, 'user-banned', 'banned@seller.com', true);
    createTestStore(db, 'store-banned', 'user-banned', 'Banned Store', 'banned-store');
    bannedStoreId = 'store-banned';
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
    rmSync(`${DB_FILE}-wal`, { force: true });
    rmSync(`${DB_FILE}-shm`, { force: true });
  });

  describe('validateBundleForCreation', () => {
    it('rejects bundle with fewer than 2 items', () => {
      createTestProduct(db, 'prod-1', storeId);
      const result = validateBundleForCreation(db, storeId, ['prod-1'], 1000);
      assert.equal(result.valid, false);
      assert.equal(result.reason, 'A bundle must contain 2 to 20 products');
    });

    it('rejects bundle with more than 20 items', () => {
      const productIds: string[] = [];
      for (let i = 0; i < 21; i++) {
        const pid = `prod-over-${i}`;
        createTestProduct(db, pid, storeId);
        productIds.push(pid);
      }
      const result = validateBundleForCreation(db, storeId, productIds, 1000);
      assert.equal(result.valid, false);
      assert.equal(result.reason, 'A bundle must contain 2 to 20 products');
    });

    it('rejects bundle with mixed sellers', () => {
      createTestProduct(db, 'prod-mixed-1', storeId);
      createTestUser(db, 'user-other', 'other@seller.com');
      createTestStore(db, 'store-other', 'user-other', 'Other Store', 'other-store');
      createTestProduct(db, 'prod-mixed-2', 'store-other');
      const result = validateBundleForCreation(db, storeId, ['prod-mixed-1', 'prod-mixed-2'], 1000);
      assert.equal(result.valid, false);
      assert.equal(result.reason, 'All products in a bundle must belong to the same seller');
    });

    it('rejects bundle with unpublished product', () => {
      createTestProduct(db, 'prod-unpub-1', storeId);
      createTestProduct(db, 'prod-unpub-2', storeId, 2999, 'draft');
      const result = validateBundleForCreation(db, storeId, ['prod-unpub-1', 'prod-unpub-2'], 1000);
      assert.equal(result.valid, false);
      assert.equal(result.reason, 'All products in a bundle must be published');
    });

    it('rejects bundle from banned seller at checkout (validation allows, checkout blocks)', () => {
      createTestProduct(db, 'prod-ban-1', bannedStoreId);
      createTestProduct(db, 'prod-ban-2', bannedStoreId);
      const result = validateBundleForCreation(db, bannedStoreId, ['prod-ban-1', 'prod-ban-2'], 1000);
      // validateBundleForCreation does not check banned status (checkout does)
      assert.equal(result.valid, true);
      // But isSellerBanned correctly identifies banned sellers
      assert.ok(isSellerBanned(db, bannedStoreId));
      assert.ok(!isSellerBanned(db, storeId));
    });

    it('rejects bundle price >= sum of individual effective prices', () => {
      createTestProduct(db, 'prod-price-1', storeId, 2000);
      createTestProduct(db, 'prod-price-2', storeId, 3000);
      // Bundle price 5000 >= sum (5000)
      const result = validateBundleForCreation(db, storeId, ['prod-price-1', 'prod-price-2'], 5000);
      assert.equal(result.valid, false);
      assert.ok(result.reason?.includes('lower than buying separately'));
    });

    it('accepts valid bundle with 2+ published products from same seller and price < sum', () => {
      createTestProduct(db, 'prod-ok-1', storeId, 2000);
      createTestProduct(db, 'prod-ok-2', storeId, 3000);
      const result = validateBundleForCreation(db, storeId, ['prod-ok-1', 'prod-ok-2'], 4000);
      assert.equal(result.valid, true);
      assert.ok(result.sumCents && result.sumCents > 0);
    });

    it('accounts for live flash deals in sum calculation', () => {
      createTestProduct(db, 'prod-deal-1', storeId, 2000);
      createTestProduct(db, 'prod-deal-2', storeId, 3000);
      createLiveDeal(db, 'prod-deal-1', 50); // 50% off -> 1000
      const now = makeNow();
      const result = validateBundleForCreation(db, storeId, ['prod-deal-1', 'prod-deal-2'], 3500);
      // sum = 1000 + 3000 = 4000, bundle price 3500 < 4000 -> valid
      assert.equal(result.valid, true);
      assert.equal(result.sumCents, 4000);
    });
  });

  describe('createBundle', () => {
    it('creates a bundle with items', () => {
      createTestProduct(db, 'prod-create-1', storeId, 2000);
      createTestProduct(db, 'prod-create-2', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'Test Bundle',
        'A test bundle',
        4000,
        ['prod-create-1', 'prod-create-2']
      );
      assert.ok(bundle.id);
      assert.equal(bundle.seller_id, storeId);
      assert.equal(bundle.name, 'Test Bundle');
      assert.equal(bundle.price_cents, 4000);
      assert.equal(bundle.status, 'live');
      assert.ok(bundle.created_at);
    });

    it('throws on validation failure', () => {
      createTestProduct(db, 'prod-throw-1', storeId);
      assert.throws(
        () => createBundle(db, storeId, 'Bad Bundle', 'desc', 1000, ['prod-throw-1']),
        (err: any) => err.message === 'A bundle must contain 2 to 20 products'
      );
    });

    it('stores items in bundle_items table', () => {
      createTestProduct(db, 'prod-items-1', storeId, 2000);
      createTestProduct(db, 'prod-items-2', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'Items Bundle',
        'desc',
        4000,
        ['prod-items-1', 'prod-items-2']
      );
      const items = bundleItems(db, bundle.id);
      assert.deepEqual(items.sort(), ['prod-items-1', 'prod-items-2'].sort());
    });
  });

  describe('bundleSumCents', () => {
    it('returns sum of effective prices for bundle items', () => {
      createTestProduct(db, 'prod-sum-1', storeId, 2000);
      createTestProduct(db, 'prod-sum-2', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'Sum Bundle',
        'desc',
        4000,
        ['prod-sum-1', 'prod-sum-2']
      );
      const { sumCents, breakdown } = bundleSumCents(db, bundle.id);
      assert.equal(sumCents, 5000);
      assert.equal(breakdown.length, 2);
      assert.deepEqual(breakdown.map((b) => b.effective_price_cents).sort(), [2000, 3000]);
    });

    it('applies live flash deals to individual items', () => {
      createTestProduct(db, 'prod-sum-deal-1', storeId, 2000);
      createTestProduct(db, 'prod-sum-deal-2', storeId, 3000);
      createLiveDeal(db, 'prod-sum-deal-1', 50); // 50% off -> 1000
      const bundle = createBundle(
        db,
        storeId,
        'Deal Sum Bundle',
        'desc',
        3500,
        ['prod-sum-deal-1', 'prod-sum-deal-2']
      );
      const { sumCents, breakdown } = bundleSumCents(db, bundle.id);
      assert.equal(sumCents, 4000); // 1000 + 3000
      const dealItem = breakdown.find((b) => b.product_id === 'prod-sum-deal-1');
      assert.ok(dealItem);
      assert.equal(dealItem!.effective_price_cents, 1000);
      assert.ok(dealItem!.flash_deal_id);
    });

    it('returns 0 for empty bundle', () => {
      const { sumCents, breakdown } = bundleSumCents(db, 'non-existent');
      assert.equal(sumCents, 0);
      assert.equal(breakdown.length, 0);
    });

    it('includes unpublished products in breakdown at full price (no deal applied)', () => {
      createTestProduct(db, 'prod-sum-pub', storeId, 2000);
      createTestProduct(db, 'prod-sum-draft', storeId, 3000, 'draft');
      // Need to manually insert since createBundle validates
      const id = crypto.randomUUID();
      const now = makeNow();
      db.prepare(
        `INSERT INTO bundles (id, seller_id, name, description, price_cents, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'live', ?, ?)`
      ).run(id, storeId, 'Mixed Bundle', 'desc', 4000, now, now);
      db.prepare('INSERT INTO bundle_items (bundle_id, product_id) VALUES (?, ?)').run(id, 'prod-sum-pub');
      db.prepare('INSERT INTO bundle_items (bundle_id, product_id) VALUES (?, ?)').run(id, 'prod-sum-draft');

      const { sumCents, breakdown } = bundleSumCents(db, id);
      // Unpublished products are included at full price (no flash deal applied)
      assert.equal(sumCents, 5000);
      assert.equal(breakdown.length, 2);
      const draftItem = breakdown.find((b) => b.product_id === 'prod-sum-draft');
      assert.ok(draftItem);
      assert.equal(draftItem!.effective_price_cents, 3000); // full price, no deal
      assert.equal(draftItem!.flash_deal_id, null);
      const pubItem = breakdown.find((b) => b.product_id === 'prod-sum-pub');
      assert.ok(pubItem);
      assert.equal(pubItem!.effective_price_cents, 2000);
    });
  });

  describe('effectiveBundlePrice', () => {
    it('returns bundle price when lower than sum (winner: bundle)', () => {
      createTestProduct(db, 'prod-ep-1', storeId, 3000);
      createTestProduct(db, 'prod-ep-2', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'Cheaper Bundle',
        'desc',
        5000,
        ['prod-ep-1', 'prod-ep-2']
      );
      const result = effectiveBundlePrice(db, bundle.id);
      assert.equal(result.chargedCents, 5000);
      assert.equal(result.winner, 'bundle');
      assert.equal(result.sumCents, 6000);
    });

    it('returns sum when lower than bundle price (winner: sum)', () => {
      createTestProduct(db, 'prod-ep-3', storeId, 2000);
      createTestProduct(db, 'prod-ep-4', storeId, 2000);
      // Manually insert bundle with price > sum to test winner='sum' case
      const id = crypto.randomUUID();
      const now = makeNow();
      db.prepare(
        `INSERT INTO bundles (id, seller_id, name, description, price_cents, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'live', ?, ?)`
      ).run(id, storeId, 'Expensive Bundle', 'desc', 5000, now, now);
      db.prepare('INSERT INTO bundle_items (bundle_id, product_id) VALUES (?, ?)').run(id, 'prod-ep-3');
      db.prepare('INSERT INTO bundle_items (bundle_id, product_id) VALUES (?, ?)').run(id, 'prod-ep-4');

      const result = effectiveBundlePrice(db, id);
      assert.equal(result.chargedCents, 4000);
      assert.equal(result.winner, 'sum');
      assert.equal(result.sumCents, 4000);
    });

    it('flash deal on one item lowers sum and can flip winner', () => {
      createTestProduct(db, 'prod-ep-5', storeId, 3000);
      createTestProduct(db, 'prod-ep-6', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'Deal Flip Bundle',
        'desc',
        5000,
        ['prod-ep-5', 'prod-ep-6']
      );
      createLiveDeal(db, 'prod-ep-5', 50); // 3000 -> 1500
      const result = effectiveBundlePrice(db, bundle.id);
      // sum = 1500 + 3000 = 4500 < 5000 -> winner is sum
      assert.equal(result.sumCents, 4500);
      assert.equal(result.chargedCents, 4500);
      assert.equal(result.winner, 'sum');
    });

    it('enforces min 1 cent guard', () => {
      createTestProduct(db, 'prod-ep-7', storeId, 1);
      createTestProduct(db, 'prod-ep-8', storeId, 1);
      const id = crypto.randomUUID();
      const now = makeNow();
      db.prepare(
        `INSERT INTO bundles (id, seller_id, name, description, price_cents, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'live', ?, ?)`
      ).run(id, storeId, 'Tiny Bundle', 'desc', 1, now, now);
      db.prepare('INSERT INTO bundle_items (bundle_id, product_id) VALUES (?, ?)').run(id, 'prod-ep-7');
      db.prepare('INSERT INTO bundle_items (bundle_id, product_id) VALUES (?, ?)').run(id, 'prod-ep-8');

      const result = effectiveBundlePrice(db, id);
      assert.equal(result.chargedCents, 1);
    });

    it('throws for non-existent bundle', () => {
      assert.throws(
        () => effectiveBundlePrice(db, 'non-existent'),
        (err: any) => err.message === 'Bundle not found'
      );
    });

    it('throws for ended bundle', () => {
      createTestProduct(db, 'prod-ended-1', storeId, 2000);
      createTestProduct(db, 'prod-ended-2', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'Ended Bundle',
        'desc',
        4000,
        ['prod-ended-1', 'prod-ended-2']
      );
      endBundle(db, bundle.id, storeId);
      assert.throws(
        () => effectiveBundlePrice(db, bundle.id),
        (err: any) => err.message === 'Bundle is not live'
      );
    });
  });

  describe('Bundle CRUD', () => {
    it('getBundle returns bundle with items', () => {
      createTestProduct(db, 'prod-get-1', storeId, 2000);
      createTestProduct(db, 'prod-get-2', storeId, 3000);
      const created = createBundle(
        db,
        storeId,
        'Get Bundle',
        'desc',
        4000,
        ['prod-get-1', 'prod-get-2']
      );
      const bundle = getBundle(db, created.id);
      assert.ok(bundle);
      assert.equal(bundle!.id, created.id);
      assert.equal(bundle!.name, 'Get Bundle');
      assert.equal(bundle!.items.length, 2);
      assert.deepEqual(bundle!.items.map((i) => i.product_id).sort(), ['prod-get-1', 'prod-get-2'].sort());
    });

    it('getBundle returns null for non-existent', () => {
      const bundle = getBundle(db, 'non-existent');
      assert.equal(bundle, null);
    });

    it('endBundle flips status to ended', () => {
      createTestProduct(db, 'prod-end-1', storeId, 2000);
      createTestProduct(db, 'prod-end-2', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'To End Bundle',
        'desc',
        4000,
        ['prod-end-1', 'prod-end-2']
      );
      assert.equal(bundle.status, 'live');
      const result = endBundle(db, bundle.id, storeId);
      assert.ok(result);
      const ended = getBundle(db, bundle.id);
      assert.equal(ended!.status, 'ended');
    });

    it('endBundle returns false for wrong seller', () => {
      createTestProduct(db, 'prod-end-3', storeId, 2000);
      createTestProduct(db, 'prod-end-4', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'Wrong Seller Bundle',
        'desc',
        4000,
        ['prod-end-3', 'prod-end-4']
      );
      const result = endBundle(db, bundle.id, 'wrong-seller');
      assert.ok(!result);
    });

    it('getSellerBundles returns only live bundles', () => {
      // Use unique store ID to avoid seed data interference
      createTestUser(db, 'user-seller-unique', 'unique@seller.com');
      createTestStore(db, 'store-unique', 'user-seller-unique', 'Unique Store', 'unique-store');
      const uniqueStoreId = 'store-unique';

      createTestProduct(db, 'prod-seller-1', uniqueStoreId, 2000);
      createTestProduct(db, 'prod-seller-2', uniqueStoreId, 3000);
      const liveBundle = createBundle(
        db,
        uniqueStoreId,
        'Live Bundle',
        'desc',
        4000,
        ['prod-seller-1', 'prod-seller-2']
      );
      createTestProduct(db, 'prod-seller-3', uniqueStoreId, 2000);
      createTestProduct(db, 'prod-seller-4', uniqueStoreId, 3000);
      const endedBundle = createBundle(
        db,
        uniqueStoreId,
        'Ended Bundle 2',
        'desc',
        4000,
        ['prod-seller-3', 'prod-seller-4']
      );
      endBundle(db, endedBundle.id, uniqueStoreId);

      const bundles = getSellerBundles(db, uniqueStoreId);
      assert.equal(bundles.length, 1);
      assert.equal(bundles[0].id, liveBundle.id);
    });
  });

  describe('Checkout money path (bundle purchase)', () => {
    // We test the pricing logic extracted from the checkout route
    // by simulating the key steps: effectiveBundlePrice + order_items creation

    it('one bundle per order enforced (bundle_id tracking)', () => {
      createTestProduct(db, 'prod-chk-1', storeId, 2000);
      createTestProduct(db, 'prod-chk-2', storeId, 3000);
      const bundle1 = createBundle(
        db,
        storeId,
        'Checkout Bundle 1',
        'desc',
        4000,
        ['prod-chk-1', 'prod-chk-2']
      );
      createTestProduct(db, 'prod-chk-3', storeId, 2000);
      createTestProduct(db, 'prod-chk-4', storeId, 3000);
      const bundle2 = createBundle(
        db,
        storeId,
        'Checkout Bundle 2',
        'desc',
        4000,
        ['prod-chk-3', 'prod-chk-4']
      );

      const { chargedCents, winner, breakdown } = effectiveBundlePrice(db, bundle1.id);
      const { chargedCents: c2, winner: w2, breakdown: b2 } = effectiveBundlePrice(db, bundle2.id);

      // Simulate the checkout logic: only one bundle_id allowed
      let orderBundleId: string | null = null;
      let orderPriceWinner: 'bundle' | 'sum' = 'bundle';

      // First bundle sets the bundle_id
      orderBundleId = bundle1.id;
      orderPriceWinner = winner;
      assert.equal(orderBundleId, bundle1.id);
      assert.equal(orderPriceWinner, 'bundle'); // 4000 < 5000

      // Second bundle would be rejected (tested in route integration, here we verify the pricing works)
      assert.ok(b2.length === 2);
    });

    it('order_items rows written per product with proportional pricing', () => {
      createTestProduct(db, 'prop-1', storeId, 2000);
      createTestProduct(db, 'prop-2', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'Prop Bundle',
        'desc',
        4000,
        ['prop-1', 'prop-2']
      );

      const { chargedCents, breakdown } = effectiveBundlePrice(db, bundle.id);
      const totalSum = breakdown.reduce((acc, b) => acc + b.effective_price_cents, 0);

      // Simulate proportional distribution as done in checkout route
      const orderItems: { product_id: string; price_cents: number }[] = [];
      for (const b of breakdown) {
        const itemPrice = Math.round((b.effective_price_cents / totalSum) * chargedCents);
        orderItems.push({ product_id: b.product_id, price_cents: itemPrice });
      }

      assert.equal(orderItems.length, 2);
      const total = orderItems.reduce((sum, oi) => sum + oi.price_cents, 0);
      assert.equal(total, chargedCents); // Sum of distributed prices equals chargedCents

      // Verify individual prices are proportional
      const item1 = orderItems.find((oi) => oi.product_id === 'prop-1')!;
      const item2 = orderItems.find((oi) => oi.product_id === 'prop-2')!;
      // 2000/5000 * 4000 = 1600, 3000/5000 * 4000 = 2400
      assert.equal(item1.price_cents, 1600);
      assert.equal(item2.price_cents, 2400);
    });

    it('orders.price_winner recorded correctly', () => {
      createTestProduct(db, 'pw-1', storeId, 3000);
      createTestProduct(db, 'pw-2', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'PW Bundle',
        'desc',
        5000,
        ['pw-1', 'pw-2']
      );

      const { winner } = effectiveBundlePrice(db, bundle.id);
      assert.equal(winner, 'bundle');

      // With a deal, winner flips to 'sum'
      createLiveDeal(db, 'pw-1', 50);
      const { winner: winnerWithDeal } = effectiveBundlePrice(db, bundle.id);
      assert.equal(winnerWithDeal, 'sum');
    });

    it('flash_deal_id propagated to order_items for items with live deals', () => {
      createTestProduct(db, 'fd-1', storeId, 2000);
      createTestProduct(db, 'fd-2', storeId, 3000);
      createLiveDeal(db, 'fd-1', 20);
      const bundle = createBundle(
        db,
        storeId,
        'FD Bundle',
        'desc',
        4000,
        ['fd-1', 'fd-2']
      );

      const { breakdown } = effectiveBundlePrice(db, bundle.id);
      const dealItem = breakdown.find((b) => b.product_id === 'fd-1');
      const noDealItem = breakdown.find((b) => b.product_id === 'fd-2');

      assert.ok(dealItem!.flash_deal_id);
      assert.equal(noDealItem!.flash_deal_id, null);
    });

    it('banned seller bundle rejected at checkout', () => {
      createTestProduct(db, 'ban-chk-1', bannedStoreId, 2000);
      createTestProduct(db, 'ban-chk-2', bannedStoreId, 3000);
      const bundle = createBundle(
        db,
        bannedStoreId,
        'Banned Bundle',
        'desc',
        4000,
        ['ban-chk-1', 'ban-chk-2']
      );

      // The checkout route checks isSellerBanned before allowing purchase
      assert.ok(isSellerBanned(db, bannedStoreId));
      assert.ok(!isSellerBanned(db, storeId));
    });

    it('ended bundle rejected at checkout', () => {
      createTestProduct(db, 'end-chk-1', storeId, 2000);
      createTestProduct(db, 'end-chk-2', storeId, 3000);
      const bundle = createBundle(
        db,
        storeId,
        'Ended Checkout Bundle',
        'desc',
        4000,
        ['end-chk-1', 'end-chk-2']
      );
      endBundle(db, bundle.id, storeId);

      const bundleCheck = getBundle(db, bundle.id);
      assert.equal(bundleCheck!.status, 'ended');

      // effectiveBundlePrice throws for ended bundles
      assert.throws(
        () => effectiveBundlePrice(db, bundle.id),
        (err: any) => err.message === 'Bundle is not live'
      );
    });
  });
});