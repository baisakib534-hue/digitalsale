import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../../../../lib/db';
import { localDir, telegramFileUrl } from '../../../../lib/channelStore';

/**
 * Public gallery image: GET /api/images/<imageId>.
 * Serves seller-uploaded product pictures (local disk or Telegram).
 * Only for images of published, non-suspended products.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT i.filename, i.mime, i.provider, i.telegram_file_id, i.local_path,
              p.status AS pstatus, s.status AS sstatus
       FROM product_images i
       JOIN products p ON p.id = i.product_id
       JOIN stores s ON s.id = p.store_id
       WHERE i.id = ?`
    )
    .get(params.id) as
    | {
        filename: string;
        mime: string;
        provider: string;
        telegram_file_id: string | null;
        local_path: string | null;
        pstatus: string;
        sstatus: string;
      }
    | undefined;
  if (!row || row.pstatus !== 'published' || row.sstatus === 'suspended') {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  if (row.provider === 'telegram' && row.telegram_file_id) {
    const url = await telegramFileUrl(row.telegram_file_id);
    if (url) return NextResponse.redirect(url);
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  if (row.local_path) {
    const rel = row.local_path.startsWith('storage/')
      ? row.local_path.slice('storage/'.length)
      : row.local_path;
    const abs = join(localDir(), rel);
    if (!abs.startsWith(localDir()) || !existsSync(abs)) {
      return NextResponse.json({ error: 'not-found' }, { status: 404 });
    }
    const data = readFileSync(abs);
    return new NextResponse(data, {
      headers: {
        'content-type': row.mime || 'image/jpeg',
        'cache-control': 'public, max-age=86400',
        'content-disposition': `inline; filename="${encodeURIComponent(row.filename)}"`,
      },
    });
  }
  return NextResponse.json({ error: 'not-found' }, { status: 404 });
}
