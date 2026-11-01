import type Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import AdmZip from 'adm-zip';

/**
 * v14: product signatures — anti-resale duplicate detection.
 *
 * Every uploaded file gets a content signature; the product signature is
 * derived from its files. When a seller tries to publish, a matching
 * signature on another store's product blocks the listing: a buyer cannot
 * download a product and re-list the identical files as their own.
 *
 * ZIP archives are fingerprinted by their *uncompressed* entry contents, so
 * re-zipping or renaming the outer file does not evade detection.
 *
 * SERVER ONLY — imports node:crypto.
 */

function sha256Hex(data: Buffer | string): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Content signature for one uploaded file.
 * - ZIP: 'zip:' + sha256 of sorted "entryName:sha256(content)" lines.
 * - Else: 'raw:' + sha256 of the raw bytes.
 */
export function fileSignature(buffer: Buffer, filename: string, mime: string): string {
  const isZip = mime === 'application/zip' || /\.zip$/i.test(filename || '');
  if (isZip) {
    try {
      const zip = new AdmZip(buffer);
      const parts: string[] = [];
      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;
        parts.push(`${entry.entryName}:${sha256Hex(entry.getData())}`);
      }
      if (parts.length > 0) {
        parts.sort();
        return 'zip:' + sha256Hex(parts.join('\n'));
      }
    } catch {
      // Unparseable zip — fall through to raw hashing.
    }
  }
  return 'raw:' + sha256Hex(buffer);
}

/** Product signature = sha256 of sorted file signatures. '' when no files. */
export function productSignature(fileSigs: (string | null)[]): string {
  const sigs = fileSigs.filter((s): s is string => !!s).sort();
  if (sigs.length === 0) return '';
  return sha256Hex(sigs.join('\n'));
}

/** Recompute + store the product's signature from its files. Returns it. */
export function refreshProductSignature(db: Database.Database, productId: string): string {
  const rows = db
    .prepare('SELECT sha256 FROM product_files WHERE product_id = ?')
    .all(productId) as { sha256: string | null }[];
  const sig = productSignature(rows.map((r) => r.sha256));
  db.prepare('UPDATE products SET signature = ? WHERE id = ?').run(sig, productId);
  return sig;
}

/**
 * Find another store's product with the same signature (published or
 * suspended — a taken-down listing still blocks re-uploads). Returns null
 * when there is no match or the product has no signature.
 */
export function findDuplicateProduct(
  db: Database.Database,
  productId: string,
  signature: string
): { id: string; title: string } | null {
  if (!signature) return null;
  const row = db
    .prepare(
      `SELECT p.id, p.title FROM products p
       WHERE p.signature = ? AND p.id != ?
         AND p.store_id != (SELECT store_id FROM products WHERE id = ?)
         AND p.status IN ('published', 'suspended')
       LIMIT 1`
    )
    .get(signature, productId, productId) as { id: string; title: string } | undefined;
  return row ?? null;
}
