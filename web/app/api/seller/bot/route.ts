import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getSessionUserId } from '../../../../lib/auth';
import { requireVerified } from '../../../../lib/verify';
import { encryptBotToken } from '../../../../lib/bot-notify';
import { randomId } from '../../../../lib/crypto';

function getStoreId(db: ReturnType<typeof getDb>, uid: string): string | null {
  const s = db.prepare('SELECT id FROM stores WHERE user_id = ?').get(uid) as { id: string } | undefined;
  return s?.id ?? null;
}

/** GET: bot connection status for this seller's store. */
export async function GET(req: NextRequest) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  const storeId = getStoreId(db, uid);
  if (!storeId) return NextResponse.json({ error: 'no-store' }, { status: 404 });
  const bot = db
    .prepare('SELECT bot_username, status, created_at FROM seller_bots WHERE store_id = ?')
    .get(storeId) as { bot_username: string; status: string; created_at: string } | undefined;
  return NextResponse.json({ bot: bot ?? null });
}

/**
 * POST: connect a seller's own Telegram bot.
 * Body: { token }. The token is validated with getMe, then encrypted at rest.
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  const v = requireVerified(db, req);
  if (v instanceof NextResponse) return v;
  const uid = v.uid;
  const storeId = getStoreId(db, uid);
  if (!storeId) return NextResponse.json({ error: 'no-store' }, { status: 404 });

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 });
  }
  const token = (body.token || '').trim();
  if (!/^\d+:[A-Za-z0-9_-]{20,}$/.test(token)) {
    return NextResponse.json({ error: 'bad-token' }, { status: 400 });
  }

  // Validate against Telegram before storing anything.
  let username = '';
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const j = (await res.json()) as { ok?: boolean; result?: { username?: string; is_bot?: boolean } };
    if (!j.ok || !j.result?.is_bot) {
      return NextResponse.json({ error: 'invalid-token' }, { status: 400 });
    }
    username = j.result.username || '';
  } catch {
    return NextResponse.json({ error: 'telegram-unreachable' }, { status: 502 });
  }

  const enc = encryptBotToken(token);
  if (!enc) return NextResponse.json({ error: 'encrypt-failed' }, { status: 500 });
  db.prepare(
    `INSERT INTO seller_bots (id, store_id, bot_token_enc, bot_username, status)
     VALUES (?, ?, ?, ?, 'active')
     ON CONFLICT(store_id) DO UPDATE SET bot_token_enc = excluded.bot_token_enc,
       bot_username = excluded.bot_username, status = 'active'`,
  ).run(randomId(), storeId, enc, username);
  return NextResponse.json({ ok: true, username });
}

/** DELETE: revoke the seller's bot. */
export async function DELETE(req: NextRequest) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  const storeId = getStoreId(db, uid);
  if (!storeId) return NextResponse.json({ error: 'no-store' }, { status: 404 });
  db.prepare(`UPDATE seller_bots SET status = 'revoked' WHERE store_id = ?`).run(storeId);
  return NextResponse.json({ ok: true });
}
