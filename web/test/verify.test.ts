import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { getDb, closeDb } from '../lib/db';
import { normalizeGmail, isDisposable } from '../lib/email';
import { checkSignupRateLimit } from '../lib/rateLimit';
import { isAdmin } from '../lib/admin';
import {
  createVerifyToken,
  consumeVerifyToken,
  isVerified,
  parseVerifyStart,
} from '../lib/verify';

const DB_FILE = join(tmpdir(), `mosshaw-test-verify-${process.pid}.db`);

describe('normalizeGmail', () => {
  it('lowercases and trims', () => {
    assert.equal(normalizeGmail('  June@Gmail.Com ')?.canonical, 'june@gmail.com');
  });
  it('removes dots from the local part', () => {
    assert.equal(normalizeGmail('j.ohn.doe@gmail.com')?.canonical, 'johndoe@gmail.com');
  });
  it('strips +tags', () => {
    assert.equal(normalizeGmail('john+shop@gmail.com')?.canonical, 'john@gmail.com');
  });
  it('normalizes googlemail.com to gmail.com', () => {
    assert.equal(normalizeGmail('john@googlemail.com')?.canonical, 'john@gmail.com');
  });
  it('rejects non-gmail addresses', () => {
    assert.equal(normalizeGmail('john@yahoo.com'), null);
    assert.equal(normalizeGmail('john@gmail.com.evil.com'), null);
    assert.equal(normalizeGmail('not-an-email'), null);
    assert.equal(normalizeGmail(''), null);
    assert.equal(normalizeGmail(undefined), null);
  });
  it('treats dotted and + variants as the same canonical address', () => {
    const a = normalizeGmail('j.ohn+shop@gmail.com')?.canonical;
    const b = normalizeGmail('john@gmail.com')?.canonical;
    assert.ok(a && b && a === b);
  });
});

describe('isDisposable', () => {
  it('blocks known temp-mail domains', () => {
    assert.equal(isDisposable('x@tempmail.com'), true);
    assert.equal(isDisposable('x@mailinator.com'), true);
    assert.equal(isDisposable('x@10minutemail.com'), true);
  });
  it('allows real domains', () => {
    assert.equal(isDisposable('x@gmail.com'), false);
    assert.equal(isDisposable('x@company.com'), false);
  });
});

describe('verification tokens + gating (db)', () => {
  let db: Database.Database;

  before(() => {
    rmSync(DB_FILE, { force: true });
    process.env.MOSSHAW_DB_PATH = DB_FILE;
    db = getDb();
    db.prepare(
      "INSERT INTO users (id, email, email_canonical, name, telegram_verified) VALUES ('u1', 'a@gmail.com', 'a@gmail.com', 'A', 0)"
    ).run();
    db.prepare(
      "INSERT INTO users (id, email, email_canonical, name, telegram_verified) VALUES ('u2', 'b@gmail.com', 'b@gmail.com', 'B', 0)"
    ).run();
  });

  after(() => {
    closeDb();
    rmSync(DB_FILE, { force: true });
    rmSync(`${DB_FILE}-wal`, { force: true });
    rmSync(`${DB_FILE}-shm`, { force: true });
  });

  it('new accounts start unverified', () => {
    assert.equal(isVerified(db, 'u1'), false);
  });

  it('consumeVerifyToken verifies the user on a valid token', () => {
    const { token, deepLink } = createVerifyToken(db, 'u1');
    assert.match(token, /^[0-9a-f]{32}$/);
    assert.ok(deepLink.includes('t.me/Digitalsale_bot?start=v_'));
    const r = consumeVerifyToken(db, token, '12345', 'someone');
    assert.equal(r.ok, true);
    assert.equal(isVerified(db, 'u1'), true);
    const row = db.prepare('SELECT telegram_id, telegram_username FROM users WHERE id = ?').get('u1') as any;
    assert.equal(row.telegram_id, '12345');
    assert.equal(row.telegram_username, 'someone');
  });

  it('rejects unknown, used and expired tokens', () => {
    assert.deepEqual(consumeVerifyToken(db, 'f'.repeat(32), '1', null), {
      ok: false,
      reason: 'unknown-token',
    });
    const { token } = createVerifyToken(db, 'u2');
    assert.equal(consumeVerifyToken(db, token, '9', null).ok, true);
    assert.deepEqual(consumeVerifyToken(db, token, '9', null), { ok: false, reason: 'used' });
    const { token: t2 } = createVerifyToken(db, 'u2');
    db.prepare("UPDATE verification_tokens SET expires_at = '2000-01-01T00:00:00Z' WHERE token = ?").run(t2);
    assert.deepEqual(consumeVerifyToken(db, t2, '9', null), { ok: false, reason: 'expired' });
  });

  it('minting a new token invalidates the previous one', () => {
    const first = createVerifyToken(db, 'u2');
    const second = createVerifyToken(db, 'u2');
    assert.notEqual(first.token, second.token);
    // The first token row was deleted — unknown now.
    assert.deepEqual(consumeVerifyToken(db, first.token, '9', null), {
      ok: false,
      reason: 'unknown-token',
    });
  });

  it('rate-limits signups: 5 per IP per 24h', () => {
    const ip = '9.9.9.9';
    for (let i = 0; i < 5; i++) assert.equal(checkSignupRateLimit(db, ip), true, `attempt ${i + 1}`);
    assert.equal(checkSignupRateLimit(db, ip), false, '6th attempt blocked');
    assert.equal(checkSignupRateLimit(db, '8.8.8.8'), true, 'other IP unaffected');
  });

  it('parseVerifyStart extracts tokens from /start deep links', () => {
    const tok = 'a'.repeat(32);
    assert.equal(parseVerifyStart(`/start v_${tok}`), tok);
    assert.equal(parseVerifyStart('/start'), null);
    assert.equal(parseVerifyStart('/start v_short'), null);
    assert.equal(parseVerifyStart('hello'), null);
  });

  it('isAdmin honors ADMIN_EMAILS on canonical gmail', () => {
    const saved = process.env.ADMIN_EMAILS;
    process.env.ADMIN_EMAILS = 'Admin@Gmail.com';
    try {
      db.prepare("INSERT INTO users (id, email, email_canonical, name) VALUES ('u-admin', 'Admin@Gmail.com', 'admin@gmail.com', 'Admin')").run();
      assert.equal(isAdmin(db, 'u-admin'), true);
      assert.equal(isAdmin(db, 'u1'), false);
    } finally {
      if (saved === undefined) delete process.env.ADMIN_EMAILS;
      else process.env.ADMIN_EMAILS = saved;
    }
  });
});
