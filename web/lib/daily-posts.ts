import { getDb } from './db';
import { formatUsd } from './format';

export interface DailyPick {
  id: string;
  title: string;
  price_usd: number;
  cover_url: string | null;
  sold: number;
  discount_pct: number | null;
}

/**
 * Pick products for the daily channel post: best sellers (by paid orders)
 * mixed with discounted products. Returns up to `limit` picks.
 */
export function pickDailyProducts(limit = 3): DailyPick[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.price_usd, p.cover_url,
              COUNT(o.id) AS sold,
              (SELECT MAX(d.percent_off) FROM discounts d
                 WHERE d.product_id = p.id AND d.active = 1
                 AND (d.expires_at IS NULL OR d.expires_at > datetime('now'))) AS discount_pct
       FROM products p
       LEFT JOIN orders o ON o.product_id = p.id AND o.status = 'paid'
       JOIN stores s ON s.id = p.store_id
       WHERE p.status = 'published' AND s.status != 'suspended'
       GROUP BY p.id
       ORDER BY sold DESC, p.created_at DESC
       LIMIT ?`,
    )
    .all(limit * 2) as DailyPick[];

  // Prefer a mix: best sellers first, then discounted items not already picked.
  const best = rows.filter((r) => r.sold > 0);
  const discounted = rows.filter((r) => r.discount_pct && r.discount_pct > 0 && !best.includes(r));
  const picks: DailyPick[] = [...best, ...discounted, ...rows.filter((r) => !best.includes(r) && !discounted.includes(r))];
  return picks.slice(0, limit);
}

export function formatDailyPost(p: DailyPick, botUsername: string): { text: string; replyMarkup: object } {
  const lines = ['🔥 <b>' + escapeHtml(p.title) + '</b>'];
  if (p.discount_pct && p.discount_pct > 0) {
    const was = p.price_usd;
    const now = Math.round(was * (1 - p.discount_pct / 100));
    lines.push(`💰 ${formatUsd(now)} <s>${formatUsd(was)}</s> — ${p.discount_pct}% off`);
  } else {
    lines.push(`💰 ${formatUsd(p.price_usd)}`);
  }
  if (p.sold > 0) lines.push(`⭐ ${p.sold} sold`);
  lines.push('', 'Tap below to buy instantly in the app 👇');
  return {
    text: lines.join('\n'),
    replyMarkup: {
      inline_keyboard: [
        [{ text: '🛍 Buy now', url: `https://t.me/${botUsername}/app?startapp=product_${p.id}` }],
      ],
    },
  };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
