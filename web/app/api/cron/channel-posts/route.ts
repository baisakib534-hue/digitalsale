import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { decryptBotToken } from '../../../../lib/bot-notify';
import { formatUsd } from '../../../../lib/format';

const SITE_URL = 'https://digitalsale-pi.vercel.app';

/**
 * Drain the channel post queue: for each pending item, post the product
 * to the seller's linked channels through the SELLER'S OWN bot.
 *
 * NEVER uses @Digitalsale_bot — that bot only posts to our own official
 * channel (via /api/cron/daily-posts). Sellers' products go out only
 * through their own connected bot, only to their own linked channels.
 *
 * Called by Vercel cron (every 10 min). Protected by CRON_SECRET.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET || '';
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const db = getDb();

  const pending = db
    .prepare(
      `SELECT q.id AS qid, q.store_id, q.product_id, q.kind,
              p.title, p.price_usd, p.cover_url, p.description,
              s.name AS store_name
       FROM channel_post_queue q
       JOIN products p ON p.id = q.product_id
       JOIN stores s ON s.id = q.store_id
       WHERE q.status = 'pending' AND p.status = 'published' AND s.status != 'suspended'
       ORDER BY q.created_at ASC LIMIT 20`,
    )
    .all() as {
    qid: string;
    store_id: string;
    product_id: string;
    kind: string;
    title: string;
    price_usd: number;
    cover_url: string | null;
    description: string;
    store_name: string;
  }[];

  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      // Seller's own bot token — never fall back to the official bot.
      const bot = db
        .prepare(`SELECT bot_token_enc FROM seller_bots WHERE store_id = ? AND status = 'active'`)
        .get(item.store_id) as { bot_token_enc: string } | undefined;
      const token = bot ? decryptBotToken(bot.bot_token_enc) : null;
      const channels = db
        .prepare(`SELECT channel_id FROM store_channels WHERE store_id = ? AND auto_post = 1`)
        .all(item.store_id) as { channel_id: string }[];

      if (!token || channels.length === 0) {
        db.prepare(`UPDATE channel_post_queue SET status = 'skipped' WHERE id = ?`).run(item.qid);
        continue;
      }

      const desc = (item.description || '').slice(0, 120);
      const isMilestone = item.kind === 'milestone';
      const text =
        (isMilestone ? `🏆 <b>BEST SELLER</b> 🏆\n\n` : `🆕 <b>${esc(item.title)}</b>\n`) +
        (isMilestone ? `<b>${esc(item.title)}</b>\n` : ``) +
        `from ${esc(item.store_name)}\n\n` +
        `💰 ${formatUsd(item.price_usd)}\n` +
        (desc ? `${esc(desc)}\n\n` : `\n`) +
        `Tap below to buy instantly 👇`;

      let okAll = true;
      for (const ch of channels) {
        const body: Record<string, unknown> = {
          chat_id: ch.channel_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛍 Buy now', url: `${SITE_URL}/product/${item.product_id}` }],
            ],
          },
        };
        const endpoint = item.cover_url ? 'sendPhoto' : 'sendMessage';
        if (item.cover_url) {
          body.photo = item.cover_url;
          body.caption = text;
          delete body.text;
        } else {
          body.text = text;
        }
        try {
          const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
          });
          if (!res.ok) okAll = false;
        } catch {
          okAll = false;
        }
      }
      db.prepare(`UPDATE channel_post_queue SET status = ? WHERE id = ?`).run(
        okAll ? 'sent' : 'failed',
        item.qid,
      );
      if (okAll) sent++;
      else failed++;
    } catch {
      db.prepare(`UPDATE channel_post_queue SET status = 'failed' WHERE id = ?`).run(item.qid);
      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed: pending.length, sent, failed });
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
