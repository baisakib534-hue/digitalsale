import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { randomId } from '../../../../../lib/crypto';
import { requireVerified } from '../../../../../lib/verify';
import { archiveFile } from '../../../../../lib/channelStore';
import { scanUpload, logScan } from '../../../../../lib/scan';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB per image
const MAX_IMAGES = 8;

function ownedProduct(db: any, productId: string, uid: string) {
  const product = db
    .prepare(
      `SELECT p.id, s.user_id AS owner_id
       FROM products p JOIN stores s ON s.id = p.store_id
       WHERE p.id = ?`
    )
    .get(productId) as { id: string; owner_id: string } | undefined;
  if (!product) return null;
  if (product.owner_id !== uid) return 'forbidden' as const;
  return product;
}

/** Seller uploads a gallery image: multipart form field "file". Max 8 per product. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const gated = requireVerified(db, req);
  if (gated instanceof NextResponse) return gated;
  const { uid } = gated;
  const product = ownedProduct(db, params.id, uid);
  if (!product) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (product === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const count = (
    db.prepare('SELECT COUNT(*) AS c FROM product_images WHERE product_id = ?').get(product.id) as {
      c: number;
    }
  ).c;
  if (count >= MAX_IMAGES) {
    return NextResponse.json({ error: 'too-many-images', max: MAX_IMAGES }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'invalid-form' }, { status: 400 });
  }
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
  const position = count;
  if (archived.provider === 'telegram') {
    db.prepare(
      `INSERT INTO product_images (id, product_id, filename, mime, size, provider, telegram_file_id, telegram_message_id, position, created_at)
       VALUES (?, ?, ?, ?, ?, 'telegram', ?, ?, ?, datetime('now'))`
    ).run(id, product.id, filename, mime, file.size, archived.telegramFileId, archived.telegramMessageId, position);
  } else {
    db.prepare(
      `INSERT INTO product_images (id, product_id, filename, mime, size, provider, local_path, position, created_at)
       VALUES (?, ?, ?, ?, ?, 'local', ?, ?, datetime('now'))`
    ).run(id, product.id, filename, mime, file.size, archived.localPath, position);
  }

  const row = db
    .prepare('SELECT id, filename, mime, size, position, created_at FROM product_images WHERE id = ?')
    .get(id);
  return NextResponse.json({ image: row }, { status: 201 });
}

/** Seller deletes a gallery image: ?imageId=. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const gated = requireVerified(db, req);
  if (gated instanceof NextResponse) return gated;
  const { uid } = gated;
  const product = ownedProduct(db, params.id, uid);
  if (!product) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (product === 'forbidden') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const imageId = url.searchParams.get('imageId') ?? '';
  const row = db
    .prepare('SELECT id FROM product_images WHERE id = ? AND product_id = ?')
    .get(imageId, product.id) as { id: string } | undefined;
  if (!row) return NextResponse.json({ error: 'image-not-found' }, { status: 404 });
  db.prepare('DELETE FROM product_images WHERE id = ?').run(imageId);
  return NextResponse.json({ deleted: true });
}
