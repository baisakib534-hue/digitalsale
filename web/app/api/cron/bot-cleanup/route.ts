import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { cleanupExpiredNotifications } from '../../../../lib/bot-notify';

/**
 * v14: Vercel Cron (every 10 min, see vercel.json) — deletes bot notification
 * messages whose 1-hour self-destruct timer has expired.
 *
 * When CRON_SECRET is set, Vercel sends `Authorization: Bearer <CRON_SECRET>`
 * and we require it. Without the secret the endpoint still runs (dev).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET || '';
  if (secret) {
    const auth = req.headers.get('authorization') ?? '';
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  }
  try {
    const db = getDb();
    const deleted = await cleanupExpiredNotifications(db);
    return NextResponse.json({ ok: true, deleted });
  } catch (err) {
    console.error('[cron/bot-cleanup] failed:', (err as Error).message);
    return NextResponse.json({ error: 'cleanup-failed' }, { status: 500 });
  }
}
