import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { randomId } from '../../../../lib/crypto';
import { createSessionToken, sessionCookieHeader } from '../../../../lib/auth';
import { validateInitData } from '../../../../lib/telegram';

interface TelegramBody {
  initData?: unknown;
}

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!botToken) {
    return NextResponse.json({ error: 'telegram-not-configured' }, { status: 503 });
  }

  let body: TelegramBody;
  try {
    body = (await req.json()) as TelegramBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const initData = typeof body.initData === 'string' ? body.initData : '';
  const result = validateInitData(initData, botToken);
  if (!result.ok || !result.user) {
    return NextResponse.json({ error: 'telegram-invalid', reason: result.reason ?? 'unknown' }, { status: 401 });
  }

  const tg = result.user;
  const telegramId = String(tg.id);
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ').trim() || 'Telegram user';

  const db = getDb();
  let user = db
    .prepare('SELECT id, email, name FROM users WHERE telegram_id = ?')
    .get(telegramId) as { id: string; email: string | null; name: string } | undefined;

  if (!user) {
    const id = randomId();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, telegram_id, telegram_username, telegram_verified, name, avatar_url, created_at)
       VALUES (?, NULL, NULL, ?, ?, 1, ?, ?, datetime('now'))`
    ).run(id, telegramId, tg.username ?? null, name, tg.photo_url ?? null);
    user = { id, email: null, name };
  } else {
    // Mini App presence = proof of Telegram identity → verify + refresh username.
    db.prepare(
      'UPDATE users SET telegram_verified = 1, telegram_username = ? WHERE id = ?'
    ).run(tg.username ?? null, user.id);
  }

  const res = NextResponse.json({
    ok: true,
    verified: true,
    user: { id: user.id, name: user.name, email: user.email },
  });
  res.headers.append('Set-Cookie', sessionCookieHeader(createSessionToken(user.id)));
  return res;
}
