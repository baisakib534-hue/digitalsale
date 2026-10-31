import type Database from 'better-sqlite3';
import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getSessionUserId } from './auth';

/**
 * Mandatory Telegram verification (v3).
 *
 * New accounts start unverified. Selling, listing/editing products and
 * joining the affiliate program all require telegram_verified = 1.
 * Two paths prove it:
 *  a. Inside the Telegram Mini App — valid initData links the account.
 *  b. On web via @Digitalsale_bot — deep link t.me/Digitalsale_bot?start=v_<token>.
 */

export const BOT_USERNAME = 'Digitalsale_bot';
export const VERIFY_TOKEN_TTL_MINUTES = 15;

export function deepLink(token: string): string {
  return `https://t.me/${BOT_USERNAME}?start=v_${token}`;
}

/** True when the user completed Telegram verification. */
export function isVerified(db: Database.Database, userId: string): boolean {
  const row = db.prepare('SELECT telegram_verified FROM users WHERE id = ?').get(userId) as
    | { telegram_verified: number }
    | undefined;
  return !!row && row.telegram_verified === 1;
}

/**
 * Gate helper for API routes. Returns the uid when verified, otherwise a
 * 403 NextResponse with {error:'telegram-verification-required'}.
 */
export function requireVerified(
  db: Database.Database,
  req: Request
): { uid: string } | NextResponse {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!isVerified(db, uid)) {
    return NextResponse.json({ error: 'telegram-verification-required' }, { status: 403 });
  }
  return { uid };
}

/** Mint a single-use deep-link token (15 min expiry). */
export function createVerifyToken(
  db: Database.Database,
  userId: string
): { token: string; deepLink: string; expiresAt: string } {
  const token = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MINUTES * 60 * 1000).toISOString();
  // Replace any outstanding token for this user — only the newest link works.
  db.prepare('DELETE FROM verification_tokens WHERE user_id = ?').run(userId);
  db.prepare(
    `INSERT INTO verification_tokens (token, user_id, expires_at, used, created_at)
     VALUES (?, ?, ?, 0, datetime('now'))`
  ).run(token, userId, expiresAt);
  return { token, deepLink: deepLink(token), expiresAt };
}

export interface ConsumeResult {
  ok: boolean;
  reason?: 'unknown-token' | 'expired' | 'used';
  userId?: string;
}

/**
 * Consume a deep-link token: marks the user Telegram-verified and records
 * their Telegram identity. Idempotent-safe: used/expired/unknown tokens fail.
 */
export function consumeVerifyToken(
  db: Database.Database,
  token: string,
  telegramId: string,
  telegramUsername: string | null
): ConsumeResult {
  const row = db
    .prepare('SELECT token, user_id, expires_at, used FROM verification_tokens WHERE token = ?')
    .get(token) as
    | { token: string; user_id: string; expires_at: string; used: number }
    | undefined;
  if (!row) return { ok: false, reason: 'unknown-token' };
  if (row.used === 1) return { ok: false, reason: 'used' };
  if (new Date(row.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };

  db.prepare(
    `UPDATE users SET telegram_verified = 1, telegram_id = ?, telegram_username = ?
     WHERE id = ?`
  ).run(telegramId, telegramUsername, row.user_id);
  db.prepare('UPDATE verification_tokens SET used = 1 WHERE token = ?').run(token);
  return { ok: true, userId: row.user_id };
}

/**
 * Parse a `/start v_<32-hex-token>` deep-link text (from @Digitalsale_bot).
 * Returns the token, or null when the text is not a verification deep link.
 */
export function parseVerifyStart(text: string): string | null {
  const m = /^\/start\s+v_([0-9a-f]{32})$/.exec(text.trim());
  return m ? m[1] : null;
}

/** Best-effort reply via the Bot API. No-op (logged) when the token is unset. */
export async function sendTelegramMessage(chatId: number | string, text: string): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!botToken) {
    console.log(`[bot] (no token) would send to ${chatId}: ${text.slice(0, 120)}`);
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    return res.ok;
  } catch (err) {
    console.error('[bot] sendMessage failed:', (err as Error).message);
    return false;
  }
}
