import { NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../../../../lib/db';
import { verifyDownloadToken } from '../../../../lib/auth';
import { telegramFileUrl, localDir } from '../../../../lib/channelStore';

interface FileRow {
  id: string;
  filename: string;
  mime: string;
  size: number;
  provider: string;
  telegram_file_id: string | null;
  local_path: string | null;
}

/** Signed, expiring download links for paid orders. */
export async function GET(_req: Request, { params }: { params: { token: string } }) {
  const verified = verifyDownloadToken(params.token);
  if (!verified) {
    return NextResponse.json({ error: 'expired-or-invalid' }, { status: 410 });
  }

  const db = getDb();
  const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(verified.orderId) as
    | { id: string; status: string }
    | undefined;
  if (!order || order.status !== 'paid') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const file = db
    .prepare('SELECT id, filename, mime, size, provider, telegram_file_id, local_path FROM product_files WHERE id = ?')
    .get(verified.fileId) as FileRow | undefined;
  if (!file) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  const safeName = file.filename.replace(/["\r\n]/g, '_');

  if (file.provider === 'telegram' && file.telegram_file_id) {
    const url = await telegramFileUrl(file.telegram_file_id);
    if (!url) {
      return NextResponse.json({ error: 'telegram-not-configured' }, { status: 503 });
    }
    return NextResponse.redirect(url, 302);
  }

  // Local provider (or telegram file that lost its file_id): stream from disk.
  if (!file.local_path) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  const dir = localDir();
  // Backward compat: very old rows stored "storage/<file>"; new rows store the bare name.
  const rel = file.local_path.startsWith('storage/')
    ? file.local_path.slice('storage/'.length)
    : file.local_path;
  const abs = join(dir, rel);
  if (!abs.startsWith(dir + '/') || !existsSync(abs)) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }
  const data = readFileSync(abs);
  return new NextResponse(data, {
    headers: {
      'content-type': file.mime || 'application/octet-stream',
      'content-disposition': `attachment; filename="${safeName}"`,
      'content-length': String(data.length),
    },
  });
}
