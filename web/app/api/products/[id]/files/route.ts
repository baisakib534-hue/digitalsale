import { NextResponse } from 'next/server';
import { getDb } from '../../../../../lib/db';
import { randomId } from '../../../../../lib/crypto';
import { requireVerified } from '../../../../../lib/verify';
import { archiveFile } from '../../../../../lib/channelStore';
import { scanUpload, logScan } from '../../../../../lib/scan';
import { fileSignature, refreshProductSignature, findDuplicateProduct } from '../../../../../lib/signatures';

const MAX_BYTES = 100 * 1024 * 1024; // 100 MB

/** Seller uploads a product file: multipart form field "file". Archived via channelStore. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const db = getDb();
  const gated = requireVerified(db, req);
  if (gated instanceof NextResponse) return gated;
  const { uid } = gated;
  const product = db
    .prepare(
      `SELECT p.id, p.title, s.user_id AS owner_id
       FROM products p JOIN stores s ON s.id = p.store_id
       WHERE p.id = ?`
    )
    .get(params.id) as { id: string; title: string; owner_id: string } | undefined;
  if (!product) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (product.owner_id !== uid) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

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

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = file.name || 'file';
  const mime = file.type || 'application/octet-stream';

  // v4: scan BEFORE archiving — blocked files never reach the channel.
  const scan = scanUpload({ buffer, filename, mime });
  if (!scan.clean) {
    logScan(db, uid, filename, scan.reasons);
    return NextResponse.json({ error: 'file-blocked', reasons: scan.reasons }, { status: 400 });
  }

  const archived = await archiveFile({ buffer, filename, mime });

  // v14: content signature for anti-resale duplicate detection.
  const sig = fileSignature(buffer, filename, mime);

  const id = randomId();
  if (archived.provider === 'telegram') {
    db.prepare(
      `INSERT INTO product_files (id, product_id, filename, mime, size, provider, telegram_file_id, telegram_message_id, sha256, created_at)
       VALUES (?, ?, ?, ?, ?, 'telegram', ?, ?, ?, datetime('now'))`
    ).run(id, product.id, filename, mime, file.size, archived.telegramFileId, archived.telegramMessageId, sig);
  } else {
    db.prepare(
      `INSERT INTO product_files (id, product_id, filename, mime, size, provider, local_path, sha256, created_at)
       VALUES (?, ?, ?, ?, ?, 'local', ?, ?, datetime('now'))`
    ).run(id, product.id, filename, mime, file.size, archived.localPath, sig);
  }
  refreshProductSignature(db, product.id);
  // v14: a file added to an already-published product can also complete a
  // duplicate — auto-suspend instead of letting it go live.
  const pubStatus = db
    .prepare('SELECT status, signature FROM products WHERE id = ?')
    .get(product.id) as { status: string; signature: string };
  if (pubStatus.status === 'published') {
    const dupe = findDuplicateProduct(db, product.id, pubStatus.signature);
    if (dupe) {
      db.prepare("UPDATE products SET status = 'suspended' WHERE id = ?").run(product.id);
      return NextResponse.json({ error: 'duplicate-product', suspended: true }, { status: 409 });
    }
  }

  const row = db
    .prepare('SELECT id, filename, mime, size, provider, created_at FROM product_files WHERE id = ?')
    .get(id);
  return NextResponse.json({ file: row }, { status: 201 });
}
