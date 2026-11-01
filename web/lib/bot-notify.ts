import type Database from 'better-sqlite3';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { randomId } from './crypto';
import { shortId, formatUsd } from './format';

/**
 * v14: purchase-confirmation bot notifications.
 *
 * When a payment confirms, the buyer gets a Telegram message with the product
 * details — via @Digitalsale_bot AND via the seller's own bot (when the seller
 * registered one). Each message self-deletes after 1 hour (privacy: no
 * lingering purchase receipts in chat history).
 *
 * SERVER ONLY — imports node:crypto.
 */

const NOTIFICATION_TTL = '+1 hour';

/* ------------------------------------------------------------------ */
/* Bot token crypto (seller bots at rest)                              */
/* ------------------------------------------------------------------ */

function botTokenKey(): Buffer | null {
  const raw = process.env.BOT_TOKEN_KEY || '';
  if (!raw) return null;
  // Accept a 64-hex-char key or any passphrase (hashed to 32 bytes).
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  return createHash('sha256').update(raw).digest();
}

/** Encrypt a seller bot token for storage. Format: v1:iv:ciphertext:tag (hex). */
export function encryptBotToken(token: string): string {
  const key = botTokenKey();
  if (!key) throw new Error('BOT_TOKEN_KEY is not configured');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${enc.toString('hex')}:${cipher.getAuthTag().toString('hex')}`;
}

/** Decrypt a seller bot token. Returns null on bad format/key. */
export function decryptBotToken(enc: string): string | null {
  try {
    const key = botTokenKey();
    if (!key) return null;
    const [v, ivHex, ctHex, tagHex] = enc.split(':');
    if (v !== 'v1' || !ivHex || !ctHex || !tagHex) return null;
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return Buffer.concat([
      decipher.update(Buffer.from(ctHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Raw Bot API helpers                                                 */
/* ------------------------------------------------------------------ */

/** Send a message with an explicit bot token. Returns the message_id or null. */
export async function sendBotMessageRaw(
  botToken: string,
  chatId: number | string,
  text: string
): Promise<number | null> {
  if (!botToken) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ok?: boolean; result?: { message_id?: number } };
    return typeof json.result?.message_id === 'number' ? json.result.message_id : null;
  } catch {
    return null;
  }
}

/** Best-effort deleteMessage. True when Telegram confirmed the delete. */
export async function deleteBotMessageRaw(
  botToken: string,
  chatId: number | string,
  messageId: number
): Promise<boolean> {
  if (!botToken) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_id: messageId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Message text (pure — unit tested)                                   */
/* ------------------------------------------------------------------ */

export function formatPurchaseMessage(opts: {
  productTitle: string;
  amountUsd: number;
  orderId: string;
}): string {
  const { productTitle, amountUsd, orderId } = opts;
  // Escape HTML in the seller-provided title.
  const safe = productTitle
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return (
    `✅ <b>Payment confirmed!</b>\n\n` +
    `🎁 <b>${safe}</b>\n` +
    `💰 ${formatUsd(amountUsd)}\n` +
    `🧾 Order <code>${shortId(orderId)}</code>\n\n` +
    `Your download is ready in <b>Purchases</b>.\n` +
    `<i>This message deletes itself in 1 hour.</i>`
  );
}

/** Parse "/command arg" text. Returns null for non-commands. */
export function parseBotCommand(text: string): { command: string; arg: string } | null {
  const m = /^\/([a-zA-Z0-9_]+)(?:\s+(.*))?$/.exec(text.trim());
  if (!m) return null;
  return { command: m[1].toLowerCase(), arg: (m[2] ?? '').trim() };
}

/* ------------------------------------------------------------------ */
/* Purchase notification                                               */
/* ------------------------------------------------------------------ */

interface OrderRow {
  id: string;
  product_id: string;
  buyer_id: string | null;
  amount_usd: number;
}

/**
 * Send the payment-confirmed notification for a paid order, via the main bot
 * and (when registered) the seller's own bot. Queues both messages for
 * auto-delete in 1 hour. Never throws — notification failures must not break
 * the payment flow.
 */
export async function notifyPurchaseConfirmed(
  db: Database.Database,
  orderId: string
): Promise<void> {
  try {
    const order = db
      .prepare('SELECT id, product_id, buyer_id, amount_usd FROM orders WHERE id = ?')
      .get(orderId) as OrderRow | undefined;
    if (!order || !order.buyer_id) return;

    const product = db
      .prepare('SELECT title, store_id FROM products WHERE id = ?')
      .get(order.product_id) as { title: string; store_id: string } | undefined;
    if (!product) return;

    const buyer = db
      .prepare('SELECT telegram_id FROM users WHERE id = ?')
      .get(order.buyer_id) as { telegram_id: string | null } | undefined;
    const chatId = buyer?.telegram_id;
    if (!chatId) return; // buyer never linked Telegram — nothing to notify

    const text = formatPurchaseMessage({
      productTitle: product.title,
      amountUsd: order.amount_usd,
      orderId: order.id,
    });

    const mainToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const mainMsgId = await sendBotMessageRaw(mainToken, chatId, text);
    if (mainMsgId !== null) {
      db.prepare(
        `INSERT INTO bot_notifications (id, chat_id, message_id, bot, bot_token_enc, delete_at)
         VALUES (?, ?, ?, 'main', NULL, datetime('now', '${NOTIFICATION_TTL}'))`
      ).run(randomId(), String(chatId), mainMsgId);
    }

    // Seller's own bot (when registered). Best-effort: Telegram 403s when the
    // buyer never started the seller's bot — that send is skipped silently.
    const sellerBot = db
      .prepare(
        `SELECT bot_token_enc FROM seller_bots WHERE store_id = ? AND status = 'active'`
      )
      .get(product.store_id) as { bot_token_enc: string } | undefined;
    if (sellerBot?.bot_token_enc) {
      const sellerToken = decryptBotToken(sellerBot.bot_token_enc);
      if (sellerToken) {
        const sellerMsgId = await sendBotMessageRaw(sellerToken, chatId, text);
        if (sellerMsgId !== null) {
          db.prepare(
            `INSERT INTO bot_notifications (id, chat_id, message_id, bot, bot_token_enc, delete_at)
             VALUES (?, ?, ?, 'seller', ?, datetime('now', '${NOTIFICATION_TTL}'))`
          ).run(randomId(), String(chatId), sellerMsgId, sellerBot.bot_token_enc);
        }
      }
    }
  } catch (err) {
    console.error('[bot-notify] notifyPurchaseConfirmed failed:', (err as Error).message);
  }
}

interface NotificationRow {
  id: string;
  chat_id: string;
  message_id: number;
  bot: string;
  bot_token_enc: string | null;
}

/**
 * Delete every queued notification whose time has come. Best-effort per row:
 * a row is removed from the queue whether or not Telegram confirms (the
 * message may already be gone).
 */
export async function cleanupExpiredNotifications(db: Database.Database): Promise<number> {
  const rows = db
    .prepare(
      `SELECT id, chat_id, message_id, bot, bot_token_enc FROM bot_notifications
       WHERE delete_at <= datetime('now')`
    )
    .all() as NotificationRow[];
  const mainToken = process.env.TELEGRAM_BOT_TOKEN || '';
  let done = 0;
  for (const row of rows) {
    try {
      const token =
        row.bot === 'seller' && row.bot_token_enc
          ? (decryptBotToken(row.bot_token_enc) ?? '')
          : mainToken;
      if (token) {
        await deleteBotMessageRaw(token, row.chat_id, row.message_id);
      }
    } catch (err) {
      console.error('[bot-notify] cleanup row failed:', (err as Error).message);
    } finally {
      db.prepare('DELETE FROM bot_notifications WHERE id = ?').run(row.id);
      done++;
    }
  }
  return done;
}
