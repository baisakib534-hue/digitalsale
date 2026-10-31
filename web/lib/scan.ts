import type Database from 'better-sqlite3';
import AdmZip from 'adm-zip';
import { randomId } from './crypto';

/**
 * Malware / scam file scanning (v4).
 *
 * scanUpload() runs on EVERY product file upload BEFORE channel archiving.
 * Layers: extension blocklist (+ double extensions), magic-byte verification,
 * and ZIP content inspection (nested zips, zip-bomb caps, path traversal,
 * encrypted entries). .rar/.7z and friends are rejected with a "use ZIP" message.
 */

export interface ScanInput {
  buffer: Buffer;
  filename: string;
  mime?: string;
}

export interface ScanResult {
  clean: boolean;
  reasons: string[];
}

/** Executable / dangerous payload extensions (as product files). */
const BLOCKED_EXTENSIONS = new Set([
  'exe', 'dll', 'msi', 'bat', 'cmd', 'ps1', 'vbs', 'vbe', 'jse', 'ws', 'wsf',
  'scr', 'com', 'pif', 'reg', 'lnk', 'jar', 'apk', 'dmg', 'gadget', 'hta',
  'cpl', 'msc', 'application',
]);

/** Archive formats we do NOT inspect — ask the seller for a ZIP instead. */
const NON_ZIP_ARCHIVES = new Set(['rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'cab', 'iso']);

const MAX_ZIP_ENTRIES = 500;
const MAX_ZIP_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // 500 MB zip-bomb cap
const MAX_NESTED_ZIP_BYTES = 25 * 1024 * 1024;
const MAX_ZIP_DEPTH = 3;

function extOf(filename: string): string {
  const base = filename.split('/').pop() ?? filename;
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx + 1).toLowerCase();
}

/** All extension segments, e.g. "doc.pdf.exe" → ["doc","pdf","exe"]. */
function extSegments(filename: string): string[] {
  const base = (filename.split('/').pop() ?? filename).toLowerCase();
  const parts = base.split('.');
  if (parts.length < 2) return [];
  return parts.slice(1);
}

function hasDoubleExtension(filename: string): string | null {
  const segs = extSegments(filename);
  for (let i = 0; i < segs.length - 1; i++) {
    if (BLOCKED_EXTENSIONS.has(segs[i])) return segs[i];
  }
  return null;
}

function startsWith(buf: Buffer, bytes: number[]): boolean {
  if (buf.length < bytes.length) return false;
  return bytes.every((b, i) => buf[i] === b);
}

/** Verify the file's magic bytes match its extension (for known types). */
function magicMatches(ext: string, buf: Buffer): boolean | null {
  // null = unknown type, no opinion.
  switch (ext) {
    case 'pdf':
      return startsWith(buf, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'zip':
    case 'docx':
    case 'xlsx':
    case 'pptx':
    case 'epub':
    case 'odt':
      return (
        startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) ||
        startsWith(buf, [0x50, 0x4b, 0x05, 0x06]) ||
        startsWith(buf, [0x50, 0x4b, 0x07, 0x08])
      ); // PK..
    case 'png':
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47]);
    case 'jpg':
    case 'jpeg':
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case 'gif':
      return startsWith(buf, [0x47, 0x49, 0x46, 0x38]); // GIF8
    case 'mp3':
      return (
        startsWith(buf, [0x49, 0x44, 0x33]) || // ID3
        (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) // frame sync
      );
    case 'wav':
      return startsWith(buf, [0x52, 0x49, 0x46, 0x46]); // RIFF
    case 'ogg':
    case 'oga':
      return startsWith(buf, [0x4f, 0x67, 0x67, 0x53]); // OggS
    case 'mp4':
    case 'm4v':
    case 'mov':
      return buf.length >= 8 && startsWith(buf.subarray(4, 8), [0x66, 0x74, 0x79, 0x70]); // ftyp
    case 'webm':
    case 'mkv':
      return startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3]);
    case 'ttf':
      return startsWith(buf, [0x00, 0x01, 0x00, 0x00]);
    case 'otf':
      return startsWith(buf, [0x4f, 0x54, 0x54, 0x4f]); // OTTO
    case 'woff':
      return startsWith(buf, [0x77, 0x4f, 0x46, 0x46]); // wOFF
    case 'woff2':
      return startsWith(buf, [0x77, 0x4f, 0x46, 0x32]); // wOF2
    case 'svg': {
      const head = buf.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
      return head.startsWith('<svg') || head.startsWith('<?xml');
    }
    case 'txt':
    case 'md':
    case 'csv':
    case 'json': {
      // Text files: reject NUL bytes / heavy control chars in the first KB.
      const sample = buf.subarray(0, Math.min(buf.length, 1024));
      for (const b of sample) {
        if (b === 0) return false;
        if (b < 9 || (b > 13 && b < 32)) return false;
      }
      return true;
    }
    default:
      return null;
  }
}

/** Catch executables hiding behind an innocent or missing extension. */
function looksExecutable(buf: Buffer): boolean {
  return (
    startsWith(buf, [0x4d, 0x5a]) || // MZ (Windows PE)
    startsWith(buf, [0x7f, 0x45, 0x4c, 0x46]) || // ELF
    startsWith(buf, [0xca, 0xfe, 0xba, 0xbe]) || // Mach-O fat
    startsWith(buf, [0xfe, 0xed, 0xfa, 0xce]) ||
    startsWith(buf, [0xfe, 0xed, 0xfa, 0xcf])
  );
}

function entryName(entry: { entryName: string }): string {
  return entry.entryName;
}

function inspectZip(buf: Buffer, depth: number, reasons: string[]): void {
  let zip: AdmZip;
  try {
    zip = new AdmZip(buf);
  } catch {
    reasons.push('ZIP file could not be parsed — it may be corrupt.');
    return;
  }
  let entries: AdmZip.IZipEntry[];
  try {
    entries = zip.getEntries();
  } catch {
    reasons.push('ZIP file could not be parsed — it may be corrupt.');
    return;
  }

  if (entries.length > MAX_ZIP_ENTRIES) {
    reasons.push(
      `Archive has ${entries.length} files (limit ${MAX_ZIP_ENTRIES}) — split it into smaller archives.`
    );
    return;
  }

  let totalUncompressed = 0;
  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const name = entryName(entry);
    totalUncompressed += entry.header.size;
    if (totalUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
      reasons.push(
        'Archive expands to more than 500 MB uncompressed — rejected as a possible zip bomb.'
      );
      return;
    }
    // Path traversal.
    if (name.includes('..') || name.startsWith('/') || name.startsWith('\\') || name.includes(':\\')) {
      reasons.push(`Archive contains a suspicious path: "${name.slice(0, 80)}".`);
      continue;
    }
    // Encrypted entries are not allowed (can't be inspected).
    const encrypted =
      (entry.header as unknown as { encrypted?: boolean }).encrypted === true ||
      ((entry.header as unknown as { flags?: number }).flags !== undefined &&
        (((entry.header as unknown as { flags: number }).flags & 0x1) === 0x1));
    if (encrypted) {
      reasons.push(`Archive contains an encrypted file ("${name.slice(0, 60)}") — encrypted archives are not allowed.`);
      continue;
    }
    // Blocked / double extensions inside the archive.
    const ext = extOf(name);
    if (BLOCKED_EXTENSIONS.has(ext)) {
      reasons.push(`Archive contains a blocked file type: "${name.slice(0, 80)}".`);
      continue;
    }
    const dbl = hasDoubleExtension(name);
    if (dbl) {
      reasons.push(`Archive contains a double-extension file: "${name.slice(0, 80)}".`);
      continue;
    }
    // Recurse into nested zips (bounded).
    if (ext === 'zip' && depth < MAX_ZIP_DEPTH && entry.header.size <= MAX_NESTED_ZIP_BYTES) {
      try {
        const inner = entry.getData();
        if (inner && inner.length > 0) inspectZip(Buffer.from(inner), depth + 1, reasons);
      } catch {
        reasons.push(`Could not read nested archive "${name.slice(0, 60)}".`);
      }
    }
  }
}

export function scanUpload(input: ScanInput): ScanResult {
  const reasons: string[] = [];
  const { buffer, filename } = input;
  const ext = extOf(filename);

  if (buffer.length === 0) {
    return { clean: false, reasons: ['The file is empty.'] };
  }

  // 1. Extension blocklist.
  if (BLOCKED_EXTENSIONS.has(ext)) {
    reasons.push(
      `Files ending in .${ext} are not allowed as product downloads (executable / risky type).`
    );
  }
  // 2. Double extensions.
  const dbl = hasDoubleExtension(filename);
  if (dbl) {
    reasons.push(
      `Double extension detected (.${dbl} before the final extension) — rename the file and re-upload.`
    );
  }
  // 3. Non-ZIP archives.
  if (NON_ZIP_ARCHIVES.has(ext)) {
    reasons.push('Please upload a ZIP file — .rar, .7z and other archive formats are not supported.');
  }
  // 4. Executable masquerading behind any extension.
  if (looksExecutable(buffer)) {
    reasons.push('The file looks like an executable program, which is not allowed as a product download.');
  }
  // 5. Magic-byte verification for known types.
  if (reasons.length === 0) {
    const match = magicMatches(ext, buffer);
    if (match === false) {
      reasons.push('The file content does not match its extension — it may be renamed or corrupt.');
    }
  }
  // 6. ZIP content inspection.
  if (reasons.length === 0 && ext === 'zip') {
    inspectZip(buffer, 0, reasons);
  }

  return { clean: reasons.length === 0, reasons };
}

/** Append a blocked-upload record for admin review (best effort). */
export function logScan(
  db: Database.Database,
  userId: string | null,
  filename: string,
  reasons: string[]
): void {
  try {
    db.prepare(
      `INSERT INTO scan_logs (id, user_id, filename, reasons, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).run(randomId(), userId, filename, JSON.stringify(reasons));
  } catch {
    /* logging must never break the upload path */
  }
}
