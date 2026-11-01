import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../lib/db';
import {
  REPORT_REASONS,
  AUTO_SUSPEND_THRESHOLD,
  distinctReporterCount,
  hasOpenReport,
  maybeAutoSuspend,
} from '../lib/reports';

const DB_FILE = join(tmpdir(), `mosshaw-test-reports-${process.pid}.db`);

function addReport(
  db: Database.Database,
  reporter: string,
  targetType: string,
  targetId: string,
  reason = 'scam',
  status = 'open'
) {
  db.prepare(
    `INSERT INTO reports (id, reporter_user_id, target_type, target_id, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
  ).run(`r-${reporter}-${targetId}-${Math.random().toString(36).slice(2, 8)}`, reporter, targetType, targetId, reason, status);
}

describe('report system (db)', () => {
  let db: Database.Database;

  before(() => {
    rmSync(DB_FILE, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
    for (const u of ['rep1', 'rep2', 'rep3', 'rep4']) {
      db.prepare("INSERT INTO users (id, email, name) VALUES (?, ?, ?)").run(u, `${u}@gmail.com`, u);
    }
    db.prepare("INSERT INTO stores (id, user_id, name, slug) VALUES ('st1', 'rep1', 'Store', 'store')").run();
    db.prepare(
      "INSERT INTO products (id, store_id, title, slug, price_usd, category, status) VALUES ('prod1', 'st1', 'P1', 'p1', 1000, 'Presets', 'published')"
    ).run();
    db.prepare(
      "INSERT INTO products (id, store_id, title, slug, price_usd, category, status) VALUES ('prod2', 'st1', 'P2', 'p2', 1000, 'Presets', 'published')"
    ).run();
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
    rmSync(`${DB_FILE}-wal`, { force: true });
    rmSync(`${DB_FILE}-shm`, { force: true });
  });

  it('exposes the expected reason enum', () => {
    assert.deepEqual([...REPORT_REASONS], ['scam', 'malware', 'fake', 'copyright', 'prohibited', 'illegal', 'other']);
    assert.equal(AUTO_SUSPEND_THRESHOLD, 3);
  });

  it('detects duplicate open reports per user per target', () => {
    assert.equal(hasOpenReport(db, 'rep1', 'product', 'prod1'), false);
    addReport(db, 'rep1', 'product', 'prod1', 'scam');
    assert.equal(hasOpenReport(db, 'rep1', 'product', 'prod1'), true);
    assert.equal(hasOpenReport(db, 'rep2', 'product', 'prod1'), false, 'other users unaffected');
    assert.equal(hasOpenReport(db, 'rep1', 'store', 'st1'), false, 'other targets unaffected');
  });

  it('does not auto-suspend below 3 distinct reporters', () => {
    addReport(db, 'rep2', 'product', 'prod2', 'fake');
    assert.equal(maybeAutoSuspend(db, 'product', 'prod2'), false);
    const st = (db.prepare('SELECT status FROM products WHERE id = ?').get('prod2') as any).status;
    assert.equal(st, 'published');
  });

  it('auto-suspends a product at 3 distinct reporters', () => {
    addReport(db, 'rep2', 'product', 'prod1', 'malware');
    assert.equal(distinctReporterCount(db, 'product', 'prod1'), 2);
    addReport(db, 'rep3', 'product', 'prod1', 'scam');
    assert.equal(maybeAutoSuspend(db, 'product', 'prod1'), true);
    const st = (db.prepare('SELECT status FROM products WHERE id = ?').get('prod1') as any).status;
    assert.equal(st, 'suspended');
  });

  it('counts the same reporter only once toward the threshold', () => {
    // rep1 already reported prod1 (open); a second open report from rep1 must not
    // push a fresh product over the line.
    addReport(db, 'rep1', 'product', 'prod2', 'scam');
    addReport(db, 'rep1', 'product', 'prod2', 'malware');
    assert.equal(distinctReporterCount(db, 'product', 'prod2'), 2, 'rep1 counted once');
    assert.equal(maybeAutoSuspend(db, 'product', 'prod2'), false);
    addReport(db, 'rep3', 'product', 'prod2', 'scam');
    assert.equal(maybeAutoSuspend(db, 'product', 'prod2'), true, 'third distinct reporter suspends');
  });

  it('never auto-suspends stores (admin decision only)', () => {
    addReport(db, 'rep1', 'store', 'st1');
    addReport(db, 'rep2', 'store', 'st1');
    addReport(db, 'rep3', 'store', 'st1');
    addReport(db, 'rep4', 'store', 'st1');
    assert.equal(maybeAutoSuspend(db, 'store', 'st1'), false);
    const st = (db.prepare('SELECT status FROM stores WHERE id = ?').get('st1') as any).status;
    assert.equal(st, 'active');
  });

  it('dismissed reports do not count toward the threshold', () => {
    db.prepare(
      "INSERT INTO products (id, store_id, title, slug, price_usd, category, status) VALUES ('prod3', 'st1', 'P3', 'p3', 1000, 'Presets', 'published')"
    ).run();
    addReport(db, 'rep1', 'product', 'prod3', 'scam', 'dismissed');
    addReport(db, 'rep2', 'product', 'prod3', 'scam', 'dismissed');
    addReport(db, 'rep3', 'product', 'prod3', 'scam', 'dismissed');
    assert.equal(distinctReporterCount(db, 'product', 'prod3'), 0);
    assert.equal(maybeAutoSuspend(db, 'product', 'prod3'), false);
  });
});
