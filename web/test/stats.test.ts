import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getDb, closeDb } from '../lib/db';
import { seedIfEmpty } from '../db/seed';
import { GET } from '../app/api/stats/route';
import type Database from 'better-sqlite3';

const DB_FILE = join(tmpdir(), `mosshaw-test-stats-${process.pid}.db`);

describe('GET /api/stats', () => {
  let db: Database.Database;

  before(() => {
    rmSync(DB_FILE, { force: true });
    rmSync(`${DB_FILE}-wal`, { force: true });
    rmSync(`${DB_FILE}-shm`, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
    seedIfEmpty(db);
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
  });

  it('returns real counts from the seeded DB', async () => {
    const res = await GET();
    assert.equal(res.status, 200);
    const j = (await res.json()) as Record<string, number>;
    assert.equal(j.productsLive, 10, 'seed has 10 published products');
    assert.equal(j.sellersVerified, 2, 'demo seller + buyer are telegram-verified');
    assert.ok(typeof j.filesScanned === 'number');
    assert.ok(typeof j.reportsResolved === 'number');
  });

  it('reflects rows inserted after seeding', async () => {
    const reporter = (db.prepare('SELECT id FROM users LIMIT 1').get() as { id: string }).id;
    db.prepare(
      `INSERT INTO reports (id, reporter_user_id, target_type, target_id, reason, details, status, created_at)
       VALUES ('r1', ?, 'product', 'p1', 'scam', 'x', 'actioned', datetime('now'))`
    ).run(reporter);
    const j = (await (await GET()).json()) as Record<string, number>;
    assert.equal(j.reportsResolved, 1);
  });
});
