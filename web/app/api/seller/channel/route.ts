import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getSessionUserId } from '../../../../lib/auth';
import { requireVerified } from '../../../../lib/verify';
import { decryptBotToken } from '../../../../lib/bot-notify';
import { randomId } from '../../../../lib/crypto';

function getStoreId(db: ReturnType<typeof getDb>, uid: string): string | null {
  const s = db.prepare('SELECT id FROM stores WHERE user_id = ?').get(uid) as { id: string } | undefined;
  return s?.id ?? null;
}

function getSellerToken(db: ReturnType<typeof getDb>, storeId: string): string | null {
  const b = db
    .prepare(`SELECT bot_token_enc FROM seller_bots WHERE store_id = ? AND status = 'active'`)
    .get(storeId) as { bot_token_enc: string } | undefined;
  return b ? decryptBotToken(b.bot_token_enc) : null;
}

/** GET: linked channels for this seller's store. */
export async function GET(req: NextRequest) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  const storeId = getStoreId(db, uid);
  if (!storeId) return NextResponse.json({ error: 'no-store' }, { status: 404 });
  const channels = db
    .prepare('SELECT id, channel_id, channel_title, auto_post, created_at FROM store_channels WHERE store_id = ? ORDER BY created_at DESC')
    .all(storeId);
  return NextResponse.json({ channels });
}

/**
 * POST: link a Telegram channel for auto-posting.
 * Body: { channel_id, channel_title? }. Verifies the seller's bot is an admin
 * of the channel via getChatMember before linking.
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  const v = requireVerified(db, req);
  if (v instanceof NextResponse) return v;
  const uid = v.uid;
  const storeId = getStoreId(db, uid);
  if (!storeId) return NextResponse.json({ error: 'no-store' }, { status: 404 });

  const token = getSellerToken(db, storeId);
  if (!token) return NextResponse.json({ error: 'no-bot' }, { status: 400 });

  let body: { channel_id?: string; channel_title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 });
  }
  const channelId = (body.channel_id || '').trim();
  if (!channelId) return NextResponse.json({ error: 'bad-channel' }, { status: 400 });

  // Verify the bot can post: it must be an administrator of the channel.
  try {
    const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const me = (await meRes.json()) as { ok?: boolean; result?: { id?: number } };
    if (!me.ok || !me.result?.id) return NextResponse.json({ error: 'bad-bot' }, { status: 400 });
    const cmRes = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: channelId, user_id: me.result.id }),
    });
    const cm = (await cmRes.json()) as { ok?: boolean; result?: { status?: string; can_post_messages?: boolean } };
    const st = cm.result?.status;
    if (!cm.ok || (st !== 'administrator' && st !== 'creator') || cm.result?.can_post_messages === false) {
      return NextResponse.json({ error: 'bot-not-admin' }, { status: 400 });
    }
    // Fetch the channel title for display.
    let title = (body.channel_title || '').trim();
    if (!title) {
      const chRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: channelId }),
      });
      const ch = (await chRes.json()) as { ok?: boolean; result?: { title?: string } };
      if (ch.ok && ch.result?.title) title = ch.result.title;
    }
    db.prepare(
      `INSERT INTO store_channels (id, store_id, channel_id, channel_title, auto_post)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(store_id, channel_id) DO UPDATE SET channel_title = excluded.channel_title, auto_post = 1`,
    ).run(randomId(), storeId, channelId, title);
    return NextResponse.json({ ok: true, channel_title: title });
  } catch {
    return NextResponse.json({ error: 'telegram-unreachable' }, { status: 502 });
  }
}

/** DELETE: unlink a channel. Body: { channel_id }. */
export async function DELETE(req: NextRequest) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  const storeId = getStoreId(db, uid);
  if (!storeId) return NextResponse.json({ error: 'no-store' }, { status: 404 });
  let body: { channel_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad-json' }, { status: 400 });
  }
  db.prepare('DELETE FROM store_channels WHERE store_id = ? AND channel_id = ?').run(
    storeId,
    (body.channel_id || '').trim(),
  );
  return NextResponse.json({ ok: true });
}
