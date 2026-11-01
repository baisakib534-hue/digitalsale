import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  normalizeCustomSlug,
  normalizeTheme,
  parseTheme,
  DEFAULT_THEME,
} from '../lib/stores';
import { validateLoginWidget } from '../lib/telegram';

describe('normalizeCustomSlug (v13)', () => {
  it('accepts a valid slug and lowercases it', () => {
    const r = normalizeCustomSlug('My-Store1');
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value, 'my-store1');
  });
  it('rejects empty', () => {
    assert.equal(normalizeCustomSlug('').ok, false);
    assert.equal(normalizeCustomSlug('   ').ok, false);
  });
  it('rejects too short / too long / bad chars', () => {
    assert.deepEqual(normalizeCustomSlug('ab'), { ok: false, reason: 'invalid' });
    assert.deepEqual(normalizeCustomSlug('a'.repeat(31)), { ok: false, reason: 'invalid' });
    assert.deepEqual(normalizeCustomSlug('my_store'), { ok: false, reason: 'invalid' });
    assert.deepEqual(normalizeCustomSlug('-lead'), { ok: false, reason: 'invalid' });
    assert.deepEqual(normalizeCustomSlug('trail-'), { ok: false, reason: 'invalid' });
  });
  it('rejects reserved slugs', () => {
    for (const s of ['api', 'auth', 'market', 'dashboard', 'checkout', 'store']) {
      assert.deepEqual(normalizeCustomSlug(s), { ok: false, reason: 'reserved' });
    }
  });
});

describe('store theme (v13)', () => {
  it('returns defaults for null/invalid JSON', () => {
    assert.deepEqual(parseTheme(null), DEFAULT_THEME);
    assert.deepEqual(parseTheme('not-json'), DEFAULT_THEME);
  });
  it('sanitizes accent to a valid hex', () => {
    assert.equal(normalizeTheme({ accent: '#ff0000' }).accent, '#FF0000');
    assert.equal(normalizeTheme({ accent: 'red' }).accent, DEFAULT_THEME.accent);
    assert.equal(normalizeTheme({ accent: '#fff' }).accent, DEFAULT_THEME.accent);
  });
  it('constrains mode and layout to known values', () => {
    const t = normalizeTheme({ mode: 'neon', layout: 'masonry' });
    assert.equal(t.mode, 'auto');
    assert.equal(t.layout, 'grid');
  });
  it('round-trips a valid theme', () => {
    const t = normalizeTheme({ accent: '#2563EB', mode: 'dark', layout: 'list', showBanner: false, showSocials: false });
    assert.deepEqual(parseTheme(JSON.stringify(t)), t);
  });
});

describe('validateLoginWidget (v13)', () => {
  const BOT = 'test-bot-token-123';
  function sign(fields: Record<string, string | number>): Record<string, string | number> {
    const pairs = Object.entries(fields)
      .filter(([k]) => k !== 'hash')
      .map(([k, v]) => `${k}=${v}`)
      .sort();
    const secret = createHmac('sha256', BOT).digest();
    const hash = createHmac('sha256', secret).update(pairs.join('\n')).digest('hex');
    return { ...fields, hash };
  }
  const base = {
    id: 123456789,
    first_name: 'June',
    username: 'junepark',
    auth_date: Math.floor(Date.now() / 1000),
  };

  it('accepts a correctly signed payload', () => {
    const r = validateLoginWidget(sign(base), BOT);
    assert.equal(r.ok, true);
    assert.equal(r.user?.id, 123456789);
  });
  it('rejects a tampered payload', () => {
    const tampered = sign(base);
    tampered.first_name = 'Mallory';
    assert.equal(validateLoginWidget(tampered, BOT).ok, false);
  });
  it('rejects a stale auth_date', () => {
    const old = { ...base, auth_date: Math.floor(Date.now() / 1000) - 25 * 3600 };
    assert.deepEqual(validateLoginWidget(sign(old), BOT).ok, false);
  });
  it('rejects a wrong bot token', () => {
    assert.equal(validateLoginWidget(sign(base), 'wrong-token').ok, false);
  });
});
