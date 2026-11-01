import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getDb } from '../../../../lib/db';
import { localDir, telegramFileUrl } from '../../../../lib/channelStore';

/**
 * Public store logo/banner: GET /api/store-images/<id>.
 * Only for active stores.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT i.filename, i.mime, i.provider, i.telegram_file_id, i.local_path,
              s.status AS sstatus
       FROM store_images i
       JOIN stores s ON s.id = i.store_id
       WHERE i.id = ?`
    )
    .get(params.id) as
    | {
        filename: string;
        mime: string;
        provider: string;
        telegram_file_id: string | null;
        local_path: string | null;
        sstatus: string;
      }
    | undefined;
  if (!row || row.sstatus === 'suspended') {
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
    const buf = readFileSync(abs);
    return new NextResponse(buf, {
      headers: {
        'content-type': row.mime,
        'cache-control': 'public, max-age=86400',
        'content-disposition': `inline; filename="${encodeURIComponent(row.filename)}"`,
      },
    });
  }
  return NextResponse.json({ error: 'not-found' }, { status: 404 });
}
