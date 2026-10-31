import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveFile, archiveProduct, localDir } from '../lib/channelStore';
import { getDb, closeDb } from '../lib/db';
import { randomId } from '../lib/crypto';

const DB_FILE = join(tmpdir(), `mosshaw-test-archive-${process.pid}.db`);

describe('channel storage (product file archive)', () => {
  before(() => {
    rmSync(DB_FILE, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    // Ensure Telegram is NOT configured: local fallback must win.
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.STORAGE_CHANNEL_ID;
    getDb();
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
  });

  it('falls back to local disk when Telegram is not configured', async () => {
    const buffer = Buffer.from('demo product bytes');
    const result = await archiveFile({ buffer, filename: 'demo.zip', mime: 'application/zip' });
    assert.equal(result.provider, 'local');
    if (result.provider === 'local') {
      assert.ok(!result.localPath.includes('/'), `unexpected localPath ${result.localPath}`);
      assert.ok(existsSync(join(localDir(), result.localPath)), 'file not written to disk');
    }
  });

  it('stores the archived file as a product_files row', () => {
    const db = getDb();
    const product = db.prepare('SELECT id FROM products LIMIT 1').get() as { id: string };
    const buffer = Buffer.from('another demo file');
    return archiveFile({ buffer, filename: 'extra.txt', mime: 'text/plain' }).then((result) => {
      assert.equal(result.provider, 'local');
      const localPath = result.provider === 'local' ? result.localPath : '';
      const row = db
        .prepare(
          `INSERT INTO product_files (id, product_id, filename, mime, size, provider, local_path)
           VALUES (?, ?, ?, ?, ?, 'local', ?) RETURNING id`
        )
        .get(randomId(), product.id, 'extra.txt', 'text/plain', buffer.length, localPath) as { id: string };
      const saved = db.prepare('SELECT * FROM product_files WHERE id = ?').get(row.id) as any;
      assert.equal(saved.provider, 'local');
      assert.equal(saved.filename, 'extra.txt');
    });
  });

  it('falls back to local when the Telegram API rejects the token', async () => {
    // A syntactically valid but bogus token: API returns 401 → graceful local fallback.
    process.env.TELEGRAM_BOT_TOKEN = '123456:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    process.env.STORAGE_CHANNEL_ID = '-1000000000000';
    try {
      const result = await archiveFile({ buffer: Buffer.from('x'), filename: 'f.bin', mime: 'application/octet-stream' });
      assert.equal(result.provider, 'local', 'expected graceful fallback to local');
    } finally {
      delete process.env.TELEGRAM_BOT_TOKEN;
      delete process.env.STORAGE_CHANNEL_ID;
    }
  });
});

describe('product card archive (bot contract surface)', () => {
  it('reports not-configured honestly without env keys', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.STORAGE_CHANNEL_ID;
    const result = await archiveProduct({
      id: 'prod-123',
      title: 'Test Product',
      priceUsd: 19.99,
      storeName: 'Test Store',
      url: 'https://example.com/product/prod-123',
    });
    assert.equal(result.posted, false);
    assert.equal(result.reason, 'not-configured');
  });
});
