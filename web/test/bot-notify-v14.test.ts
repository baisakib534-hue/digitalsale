import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBotCommand,
  formatPurchaseMessage,
  encryptBotToken,
  decryptBotToken,
} from '../lib/bot-notify';

describe('v14 bot commands + notifications', () => {
  it('parseBotCommand handles commands', () => {
    assert.deepEqual(parseBotCommand('/purchases'), { command: 'purchases', arg: '' });
    assert.deepEqual(parseBotCommand('/help'), { command: 'help', arg: '' });
    assert.deepEqual(parseBotCommand('/start'), { command: 'start', arg: '' });
    assert.deepEqual(parseBotCommand('/start v_abc123'), { command: 'start', arg: 'v_abc123' });
    assert.equal(parseBotCommand('hello'), null);
    assert.equal(parseBotCommand(''), null);
  });

  it('formatPurchaseMessage includes details + self-delete note, escapes HTML', () => {
    const msg = formatPurchaseMessage({
      productTitle: 'Cool <Pack> & "Stuff"',
      amountUsd: 2500,
      orderId: 'ord_abcdef123456',
    });
    assert.ok(msg.includes('Payment confirmed'));
    assert.ok(msg.includes('Cool &lt;Pack&gt; &amp;'));
    assert.ok(!msg.includes('<Pack>')); // raw HTML must not leak
    assert.ok(msg.includes('$25.00'));
    assert.ok(msg.includes('1 hour'));
  });

  it('encrypt/decrypt bot token round-trips', () => {
    process.env.BOT_TOKEN_KEY = 'test-key-for-unit-tests-only-12345678';
    const enc = encryptBotToken('123456:AA-secret-token');
    assert.ok(enc.startsWith('v1:'));
    assert.equal(decryptBotToken(enc), '123456:AA-secret-token');
    assert.equal(decryptBotToken('garbage'), null);
    delete process.env.BOT_TOKEN_KEY;
    assert.equal(decryptBotToken(enc), null); // no key -> null
  });
});
