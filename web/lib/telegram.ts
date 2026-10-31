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
