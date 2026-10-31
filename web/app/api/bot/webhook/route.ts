import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import {
  BOT_USERNAME,
  consumeVerifyToken,
  parseVerifyStart,
  sendTelegramMessage,
} from '../../../../lib/verify';

/**
 * Telegram webhook receiver for @Digitalsale_bot.
 *
 * Documented update schema (Telegram Bot API):
 * {
 *   "update_id": 123,
 *   "message": {
 *     "message_id": 1,
 *     "from": { "id": 12345, "username": "someone", "first_name": "..." },
 *     "chat": { "id": 12345, "type": "private" },
 *     "text": "/start v_<32-hex-token>"
 *   }
 * }
 *
 * On `/start v_<token>` the token is consumed: the linked Digitalsale account is
 * marked Telegram-verified and the bot replies with a confirmation. The
 * `x-telegram-bot-api-secret-token` header is validated against
 * TELEGRAM_WEBHOOK_SECRET when set.
 */
interface TgUser {
  id: number;
  username?: string;
  first_name?: string;
}

interface TgMessage {
  message_id: number;
  from?: TgUser;
  chat?: { id: number; type: string };
  text?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

export async function POST(req: Request) {
  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET || '';
  if (configuredSecret) {
    const received = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
    if (received !== configuredSecret) {
      return NextResponse.json({ error: 'invalid-secret' }, { status: 401 });
    }
  }

  let update: TgUpdate | null = null;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (!update || typeof update !== 'object') return NextResponse.json({ ok: true });

  const msg = update.message;
  const text = typeof msg?.text === 'string' ? msg.text : '';
  const token = parseVerifyStart(text);
  if (!token || !msg?.from || !msg?.chat) {
    // Not a verification deep link — acknowledge, nothing to do.
    return NextResponse.json({ ok: true });
  }
  const telegramId = String(msg.from.id);
  const telegramUsername = msg.from.username ?? null;
  const chatId = msg.chat.id;

  const db = getDb();
  const result = consumeVerifyToken(db, token, telegramId, telegramUsername);

  if (result.ok) {
    await sendTelegramMessage(
      chatId,
      `✅ Your Digitalsale account is <b>verified</b>.\n\nYou can now open your store, list products and join the affiliate program. Head back to <b>${BOT_USERNAME}</b>'s mini app or the website to continue.`
    );
  } else {
    const reason =
      result.reason === 'used'
        ? 'This verification link was already used — request a fresh one from the website.'
        : result.reason === 'expired'
          ? 'This verification link expired — request a fresh one from the website.'
          : 'Unknown verification link — request a fresh one from the website.';
    await sendTelegramMessage(chatId, `⚠️ Verification failed: ${reason}`);
  }

  return NextResponse.json({ ok: true, verified: result.ok });
}
