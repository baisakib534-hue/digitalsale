import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { randomId } from '../../../../../lib/crypto';
import { requireVerified } from '../../../../../lib/verify';
import { archiveFile } from '../../../../../lib/channelStore';
import { scanUpload, logScan } from '../../../../../lib/scan';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per logo/banner

function ownedStore(db: any, slug: string, uid: string) {
  const store = db.prepare('SELECT id, user_id FROM stores WHERE slug = ?').get(slug) as
    | { id: string; user_id: string }
    | undefined;
  if (!store) return null;
  if (store.user_id !== uid) return 'forbidden' as const;
  return store;
}

/**
 * Seller uploads store logo or banner: multipart form, fields "file" + "kind" (logo|banner).
 * One of each per store — re-upload replaces.
 */
export async function POST(req: Request, { params }: { params: { slug: string } }) {
  const db = getDb();
  const gated = requireVerified(db, req);
  if (gated instanceof NextResponse) return gated;
  const { uid } = gated;
  const store = ownedStore(db, params.slug, uid);
  if (!store) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (store === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid-form' }, { status: 400 });
  }
  const kind = form.get('kind') === 'banner' ? 'banner' : 'logo';
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'missing-file' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'file-too-large', maxBytes: MAX_BYTES }, { status: 413 });
  }
  const mime = file.type || 'application/octet-stream';
  if (!mime.startsWith('image/')) {
    return NextResponse.json({ error: 'not-an-image' }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name || 'image';
  const scan = scanUpload({ buffer, filename, mime });
  if (!scan.clean) {
    logScan(db, uid, filename, scan.reasons);
    return NextResponse.json({ error: 'file-blocked', reasons: scan.reasons }, { status: 400 });
  }

  const archived = await archiveFile({ buffer, filename, mime });
  const id = randomId();
  const cols =
    archived.provider === 'telegram'
      ? `VALUES (?, ?, ?, ?, ?, ?, 'telegram', ?, ?, ?, datetime('now'))`
      : `VALUES (?, ?, ?, ?, ?, ?, 'local', ?, ?, ?, datetime('now'))`;
  const vals =
    archived.provider === 'telegram'
      ? [id, store.id, kind, filename, mime, file.size, archived.telegramFileId, archived.telegramMessageId, null]
      : [id, store.id, kind, filename, mime, file.size, null, null, archived.localPath];
  db.prepare(
    `INSERT INTO store_images (id, store_id, kind, filename, mime, size, provider,
       telegram_file_id, telegram_message_id, local_path, created_at)
     ${cols}
     ON CONFLICT(store_id, kind) DO UPDATE SET
       filename = excluded.filename, mime = excluded.mime, size = excluded.size,
       provider = excluded.provider, telegram_file_id = excluded.telegram_file_id,
       telegram_message_id = excluded.telegram_message_id, local_path = excluded.local_path,
       created_at = excluded.created_at`
  ).run(...vals);

  const row = db
    .prepare('SELECT id FROM store_images WHERE store_id = ? AND kind = ?')
    .get(store.id, kind) as { id: string };
  const url = `/api/store-images/${row.id}`;
  db.prepare(
    kind === 'logo' ? 'UPDATE stores SET avatar_url = ? WHERE id = ?' : 'UPDATE stores SET banner_url = ? WHERE id = ?'
  ).run(url, store.id);
  return NextResponse.json({ image: { id: row.id, kind, url } }, { status: 201 });
}
