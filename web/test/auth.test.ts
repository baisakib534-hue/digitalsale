import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  clearSessionCookieHeader,
  createDownloadToken,
  createSessionToken,
  getSessionUserId,
  parseCookies,
  sessionCookieHeader,
  verifyDownloadToken,
  verifySessionToken,
} from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/crypto';
import { validateInitData } from '../lib/telegram';

describe('password hashing (scrypt)', () => {
  it('round-trips and rejects wrong passwords', () => {
    const hash = hashPassword('correct-horse-123!');
    assert.ok(hash.startsWith('scrypt:'), 'unexpected hash format');
    assert.ok(verifyPassword('correct-horse-123!', hash));
    assert.ok(!verifyPassword('correct-horse-124!', hash));
    assert.ok(!verifyPassword('', hash));
  });

  it('salts uniquely', () => {
    assert.notEqual(hashPassword('same-password-1'), hashPassword('same-password-1'));
  });

  it('rejects short passwords', () => {
    assert.throws(() => hashPassword('short'), /at least 8/);
  });

  it('rejects malformed stored hashes', () => {
    assert.ok(!verifyPassword('anything', 'not-a-hash'));
    assert.ok(!verifyPassword('anything', 'scrypt:onlytwoparts'));
  });
});

describe('session cookies (HMAC-signed)', () => {
  it('creates and verifies a token', () => {
    const token = createSessionToken('user-123');
    const payload = verifySessionToken(token);
    assert.ok(payload);
    assert.equal(payload.uid, 'user-123');
  });

  it('rejects tampered tokens', () => {
    const token = createSessionToken('user-123');
    const [body] = token.split('.');
    assert.equal(verifySessionToken(`${body}.deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef`), null);
    assert.equal(verifySessionToken('garbage'), null);
    assert.equal(verifySessionToken(''), null);
  });

  it('rejects expired tokens', () => {
    const token = createSessionToken('user-123', -10);
    assert.equal(verifySessionToken(token), null);
  });

  it('round-trips through cookie parse + getSessionUserId', () => {
    const token = createSessionToken('user-abc');
    const header = sessionCookieHeader(token);
    assert.ok(header.includes('HttpOnly'), 'cookie must be HttpOnly');
    assert.ok(header.includes('SameSite=Lax'), 'cookie must be SameSite=Lax');
    const req = new Request('http://localhost/', { headers: { cookie: `other=1; mosshaw_session=${token}` } });
    assert.equal(getSessionUserId(req), 'user-abc');
  });

  it('returns null with no cookie', () => {
    const req = new Request('http://localhost/');
    assert.equal(getSessionUserId(req), null);
    assert.deepEqual(parseCookies(null), {});
  });

  it('clearSessionCookieHeader expires the cookie', () => {
    assert.ok(clearSessionCookieHeader().includes('Max-Age=0'));
  });
});

describe('download tokens (signed, expiring)', () => {
  it('creates and verifies', () => {
    const token = createDownloadToken('order-1', 'file-1');
    const v = verifyDownloadToken(token);
    assert.ok(v);
    assert.equal(v.orderId, 'order-1');
    assert.equal(v.fileId, 'file-1');
  });

  it('rejects tampered and expired tokens', () => {
    const token = createDownloadToken('order-1', 'file-1');
    const [body] = token.split('.');
    assert.equal(verifyDownloadToken(`${body}.00`), null);
    const expired = createDownloadToken('order-1', 'file-1', -5);
    assert.equal(verifyDownloadToken(expired), null);
    assert.equal(verifyDownloadToken('nope'), null);
  });
});

describe('Telegram initData validation', () => {
  const BOT_TOKEN = '123456:TEST-TELEGRAM-BOT-TOKEN';

  /** Build a valid initData independently of the implementation under test. */
  function makeInitData(overrides: Record<string, string> = {}, token: string = BOT_TOKEN): string {
    const fields: Record<string, string> = {
      auth_date: '1700000000',
      query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
      user: JSON.stringify({ id: 987654321, first_name: 'June', username: 'junefield' }),
      ...overrides,
    };
    const checkString = Object.keys(fields)
      .sort()
      .map((k) => `${k}=${fields[k]}`)
      .join('\n');
    const secret = createHmac('sha256', 'WebAppData').update(token).digest();
    const hash = createHmac('sha256', secret).update(checkString).digest('hex');
    const params = new URLSearchParams({ ...fields, hash });
    return params.toString();
  }

  it('accepts a correctly signed initData vector', () => {
    const result = validateInitData(makeInitData(), BOT_TOKEN);
    assert.equal(result.ok, true);
    assert.equal(result.user?.id, 987654321);
    assert.equal(result.user?.first_name, 'June');
  });

  it('rejects tampered data', () => {
    const tampered = makeInitData({ auth_date: '1999999999' });
    // keep the ORIGINAL hash but change a field -> build manually
    const good = makeInitData();
    const params = new URLSearchParams(good);
    params.set('auth_date', '1999999999');
    const result = validateInitData(params.toString(), BOT_TOKEN);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'hash mismatch');
    assert.equal(validateInitData(tampered, BOT_TOKEN).ok, true, 'sanity: untampered vector must pass');
  });

  it('rejects the wrong bot token', () => {
    const result = validateInitData(makeInitData(), '999999:WRONG-TOKEN');
    assert.equal(result.ok, false);
  });

  it('rejects empty / hash-less input', () => {
    assert.equal(validateInitData('', BOT_TOKEN).ok, false);
    assert.equal(validateInitData('auth_date=1', BOT_TOKEN).ok, false);
  });

  it('fails gracefully without a bot token', () => {
    const result = validateInitData(makeInitData(), '');
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'bot token not configured');
  });
});
