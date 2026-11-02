import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBotCommand, encryptBotToken } from '../lib/bot-notify';
import { setupSellerBot } from '../lib/seller-bot-setup';

describe('seller bot setup (v16.1)', () => {
  it('parseBotCommand recognizes /setupbot', () => {
    const r = parseBotCommand('/setupbot');
    assert.ok(r);
    assert.equal(r!.command, 'setupbot');
  });

  it('setupSellerBot fails gracefully with undecryptable token', async () => {
    process.env.BOT_TOKEN_KEY = 'test-key-for-unit-tests-only-12345678';
    const result = await setupSellerBot('garbage-not-encrypted', {
      storeName: 'Test Store',
      storeBio: '',
      storeSlug: 'test-store',
      whitelabelToken: null,
      botUsername: 'testbot',
    });
    assert.equal(result.ok, false);
    assert.ok(result.error);
    delete process.env.BOT_TOKEN_KEY;
  });

  it('setupSellerBot fails gracefully with invalid token (no network call crash)', async () => {
    process.env.BOT_TOKEN_KEY = 'test-key-for-unit-tests-only-12345678';
    const enc = encryptBotToken('000000:invalid-token-for-test');
    const result = await setupSellerBot(enc, {
      storeName: 'Test Store',
      storeBio: 'A test store',
      storeSlug: 'test-store',
      whitelabelToken: 'st_test123',
      botUsername: 'testbot',
    });
    // Telegram API will reject the fake token (or network fails) — must not throw.
    assert.equal(result.ok, false);
    delete process.env.BOT_TOKEN_KEY;
  });
});
