import { NextRequest, NextResponse } from 'next/server';
import { pickDailyProducts, formatDailyPost } from '../../../../lib/daily-posts';

/**
 * Daily official-channel post: best sellers + discounted products.
 * Called by Vercel cron (daily). Protected by CRON_SECRET.
 *
 * Env: TELEGRAM_BOT_TOKEN, OFFICIAL_CHANNEL_ID, CRON_SECRET,
 *      TELEGRAM_BOT_USERNAME (default Digitalsale_bot)
 */
export async function GET(req: NextRequest) {
  // Vercel cron sends Authorization: Bearer <CRON_SECRET> automatically.
  const auth = req.headers.get('authorization') || '';
  const secret = req.nextUrl.searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET || '';
  const ok =
    (cronSecret && auth === `Bearer ${cronSecret}`) || (secret && secret === cronSecret);
  if (!ok) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  const channelId = process.env.OFFICIAL_CHANNEL_ID || '';
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'Digitalsale_bot';
  if (!botToken || !channelId) {
    return NextResponse.json({ error: 'not-configured' }, { status: 500 });
  }

  const picks = pickDailyProducts(3);
  if (picks.length === 0) return NextResponse.json({ ok: true, posted: 0 });

  const results: { id: string; ok: boolean }[] = [];
  for (const p of picks) {
    const { text, replyMarkup } = formatDailyPost(p, botUsername);
    try {
      const body: Record<string, unknown> = {
        chat_id: channelId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      };
      // Include the cover image when available.
      const endpoint = p.cover_url ? 'sendPhoto' : 'sendMessage';
      if (p.cover_url) {
        body.photo = p.cover_url;
        body.caption = text;
        body.parse_mode = 'HTML';
        delete body.text;
      }
      const res = await fetch(`https://api.telegram.org/bot${botToken}/${endpoint}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      results.push({ id: p.id, ok: res.ok });
    } catch {
      results.push({ id: p.id, ok: false });
    }
  }
  return NextResponse.json({ ok: true, posted: results.filter((r) => r.ok).length, results });
}
