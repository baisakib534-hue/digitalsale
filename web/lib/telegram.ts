import { createHmac, timingSafeEqual } from 'node:crypto';
import type { TelegramUser } from './telegram-client';

export type { TelegramUser };

export interface InitDataValidation {
  ok: boolean;
  user?: TelegramUser;
  reason?: string;
}

/**
 * Validate Telegram Mini App initData per official docs:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * data_check_string = "\n"-joined "key=<value>" pairs, sorted by key,
 * excluding "hash". secret_key = HMAC_SHA256(key="WebAppData", msg=botToken).
 * hash = hex(HMAC_SHA256(secret_key, data_check_string)).
 *
 * SERVER ONLY — imports node:crypto. Browser code must use lib/telegram-client.
 */
export function validateInitData(initData: string, botToken: string): InitDataValidation {
  if (!initData) return { ok: false, reason: 'empty initData' };
  if (!botToken) return { ok: false, reason: 'bot token not configured' };

  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) return { ok: false, reason: 'missing hash' };

  const pairs: string[] = [];
  const userRaw = params.get('user');
  params.forEach((value, key) => {
    if (key === 'hash') return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest();

  let received: Buffer;
  try {
    received = Buffer.from(receivedHash, 'hex');
  } catch {
    return { ok: false, reason: 'bad hash encoding' };
  }
  if (received.length !== computed.length || !timingSafeEqual(received, computed)) {
    return { ok: false, reason: 'hash mismatch' };
  }

  if (!userRaw) return { ok: false, reason: 'missing user' };
  try {
    const user = JSON.parse(userRaw) as TelegramUser;
    if (typeof user.id !== 'number') return { ok: false, reason: 'bad user payload' };
    return { ok: true, user };
  } catch {
    return { ok: false, reason: 'bad user payload' };
  }
}

export interface LoginWidgetData {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

/**
 * Validate Telegram Login Widget data (website flow):
 * https://core.telegram.org/widgets/login#checking-authorization
 *
 * data_check_string = "\n"-joined "key=<value>" pairs sorted by key, excluding
 * "hash". secret_key = SHA256(botToken). hash = hex(HMAC_SHA256(secret, data_check_string)).
 * auth_date must be recent (24h) to prevent replay.
 *
 * SERVER ONLY — imports node:crypto.
 */
export function validateLoginWidget(data: unknown, botToken: string): InitDataValidation {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'empty data' };
  if (!botToken) return { ok: false, reason: 'bot token not configured' };
  const d = data as Record<string, unknown>;
  const receivedHash = typeof d.hash === 'string' ? d.hash : '';
  if (!receivedHash) return { ok: false, reason: 'missing hash' };
  if (typeof d.id !== 'number' || typeof d.auth_date !== 'number') {
    return { ok: false, reason: 'bad payload' };
  }
  // Replay protection: auth must be from the last 24h.
  if (Math.abs(Date.now() / 1000 - d.auth_date) > 24 * 60 * 60) {
    return { ok: false, reason: 'stale auth_date' };
  }

  const pairs: string[] = [];
  for (const [key, value] of Object.entries(d)) {
    if (key === 'hash' || value === undefined || value === null) continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join('\n');

  const secretKey = createHmac('sha256', botToken).digest();
  const computed = createHmac('sha256', secretKey).update(dataCheckString).digest();

  let received: Buffer;
  try {
    received = Buffer.from(receivedHash, 'hex');
  } catch {
    return { ok: false, reason: 'bad hash encoding' };
  }
  if (received.length !== computed.length || !timingSafeEqual(received, computed)) {
    return { ok: false, reason: 'hash mismatch' };
  }

  return {
    ok: true,
    user: {
      id: d.id,
      first_name: typeof d.first_name === 'string' ? d.first_name : '',
      last_name: typeof d.last_name === 'string' ? d.last_name : undefined,
      username: typeof d.username === 'string' ? d.username : undefined,
      photo_url: typeof d.photo_url === 'string' ? d.photo_url : undefined,
    } as TelegramUser,
  };
}
