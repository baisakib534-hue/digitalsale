import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import {
  BOT_USERNAME,
  consumeVerifyToken,
  parseVerifyStart,
  sendTelegramMessage,
} from '../../../../lib/verify';
import { parseBotCommand, cleanupExpiredNotifications } from '../../../../lib/bot-notify';
import { setupSellerBot } from '../../../../lib/seller-bot-setup';
import { formatUsd, shortId, timeAgo } from '../../../../lib/format';
import { BRAND } from '../../../../lib/brand';

/**
 * Telegram webhook receiver for @Digitalsale_bot.
 *
 * Commands (v14):
 *   /start            — welcome + command list
 *   /start v_<token>  — Telegram verification deep link (consumes the token)
 *   /help             — command list
 *   /purchases        — the buyer's order history (paid orders)
 *
 * The `x-telegram-bot-api-secret-token` header is validated against
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

const HELP_TEXT =
  `🛍 <b>Digitalsale bot commands</b>\n\n` +
  `/purchases — your order history\n` +
  `/setupbot — configure your own seller bot (commands + Open Shop button)\n` +
  `/help — this list\n\n` +
  `Verify your account from the website to unlock selling.`;

const WELCOME_TEXT =
  `👋 Welcome to <b>Digitalsale</b>!\n\n` +
  `The borderless marketplace for digital goods — buy from creators anywhere, pay with crypto, download instantly.\n\n` +
  `🛍 Browse the market\n` +
  `❤️ Save favorites to your wishlist\n` +
  `⚡ Instant downloads after payment\n\n` +
  `Tap below to open the app 👇`;

const WELCOME_MARKUP = {
  inline_keyboard: [
    [{ text: '🛍 Open Digitalsale', web_app: { url: BRAND.siteUrl } }],
  ],
};

async function handlePurchases(chatId: number, telegramId: string): Promise<void> {
  const db = getDb();
  const user = db
    .prepare('SELECT id FROM users WHERE telegram_id = ?')
    .get(telegramId) as { id: string } | undefined;
  if (!user) {
    await sendTelegramMessage(
      chatId,
      `I don't see a Digitalsale account linked to this Telegram yet.\n\nOpen the mini app or website and verify to link it.`
    );
    return;
  }
  const orders = db
    .prepare(
      `SELECT o.id, o.amount_usd, o.status, o.created_at, p.title
       FROM orders o JOIN products p ON p.id = o.product_id
       WHERE o.buyer_id = ? AND o.status = 'paid'
       ORDER BY o.created_at DESC LIMIT 20`
    )
    .all(user.id) as {
    id: string;
    amount_usd: number;
    status: string;
    created_at: string;
    title: string;
  }[];
  if (orders.length === 0) {
    await sendTelegramMessage(chatId, `No purchases yet — your order history will appear here.`);
    return;
  }
  const lines = orders.map(
    (o) =>
      `🎁 <b>${escapeHtml(o.title)}</b>\n   ${formatUsd(o.amount_usd)} · <code>${shortId(o.id)}</code> · ${timeAgo(o.created_at)}`
  );
  await sendTelegramMessage(
    chatId,
    `🧾 <b>Your purchases</b> (${orders.length})\n\n${lines.join('\n\n')}`
  );
}

/**
 * /setupbot — configure the seller's OWN connected bot via the Bot API.
 * Looks up the sender's store + connected seller_bots row, then sets the
 * bot's commands, descriptions and menu button ("Open Shop" -> storefront).
 */
async function handleSetupBot(chatId: number, telegramId: string): Promise<void> {
  const db = getDb();
  const user = db
    .prepare('SELECT id FROM users WHERE telegram_id = ?')
    .get(telegramId) as { id: string } | undefined;
  if (!user) {
    await sendTelegramMessage(
      chatId,
      `I don't see a Digitalsale account linked to this Telegram yet.\n\nOpen the mini app or website and verify to link it first.`
    );
    return;
  }
  const store = db
    .prepare(
      `SELECT id, name, slug, bio, whitelabel_token FROM stores WHERE user_id = ? AND status = 'active' LIMIT 1`
    )
    .get(user.id) as
    | { id: string; name: string; slug: string; bio: string; whitelabel_token: string | null }
    | undefined;
  if (!store) {
    await sendTelegramMessage(
      chatId,
      `You don't have an active store yet.\n\nCreate one from the dashboard first, then run /setupbot again.`
    );
    return;
  }
  const sellerBot = db
    .prepare(`SELECT bot_token_enc, bot_username FROM seller_bots WHERE store_id = ? AND status = 'active' LIMIT 1`)
    .get(store.id) as { bot_token_enc: string; bot_username: string } | undefined;
  if (!sellerBot) {
    await sendTelegramMessage(
      chatId,
      `No seller bot connected to <b>${escapeHtml(store.name)}</b> yet.\n\n` +
        `Connect your own bot from the dashboard → Telegram tab first, then run /setupbot — I'll install its commands and the "Open Shop" button for you.`
    );
    return;
  }

  await sendTelegramMessage(chatId, `⚙️ Setting up @${escapeHtml(sellerBot.bot_username || 'your bot')}…`);
  const result = await setupSellerBot(sellerBot.bot_token_enc, {
    storeName: store.name,
    storeBio: store.bio,
    storeSlug: store.slug,
    whitelabelToken: store.whitelabel_token,
    botUsername: sellerBot.bot_username,
  });

  if (result.ok) {
    await sendTelegramMessage(
      chatId,
      `✅ <b>@${escapeHtml(sellerBot.bot_username || 'your bot')}</b> is ready!\n\n` +
        `• Commands installed: /start, /shop, /help\n` +
        `• "Open Shop" button added (opens your storefront)\n` +
        `• Store description set\n\n` +
        `Open your bot and try it.`
    );
  } else {
    await sendTelegramMessage(chatId, `⚠️ Setup failed: ${escapeHtml(result.error ?? 'unknown error')}`);
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
  if (!msg?.from || !msg?.chat || !text) return NextResponse.json({ ok: true });

  const telegramId = String(msg.from.id);
  const telegramUsername = msg.from.username ?? null;
  const chatId = msg.chat.id;

  // Verification deep link: /start v_<32-hex>
  const verifyToken = parseVerifyStart(text);
  if (verifyToken) {
    const db = getDb();
    const result = consumeVerifyToken(db, verifyToken, telegramId, telegramUsername);
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

  // Plain commands.
  const cmd = parseBotCommand(text);
  if (!cmd) {
    // v14.1: lazy cleanup of expired self-deleting notifications (Hobby plan
    // only allows a daily Vercel cron, so we sweep on bot activity too).
    try {
      await cleanupExpiredNotifications(getDb());
    } catch {
      /* best-effort */
    }
    return NextResponse.json({ ok: true }); // not a command — ignore
  }

  if (cmd.command === 'start') {
    await sendTelegramMessage(chatId, WELCOME_TEXT, WELCOME_MARKUP);
  } else if (cmd.command === 'help') {
    await sendTelegramMessage(chatId, HELP_TEXT);
  } else if (cmd.command === 'purchases') {
    await handlePurchases(chatId, telegramId);
  } else if (cmd.command === 'setupbot') {
    await handleSetupBot(chatId, telegramId);
  } else {
    await sendTelegramMessage(chatId, `Unknown command. Try /help.`);
  }
  try {
    await cleanupExpiredNotifications(getDb());
  } catch {
    /* best-effort */
  }
  return NextResponse.json({ ok: true });
}
