import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';
import { scanUpload } from '../lib/scan';
import { scanListingText } from '../lib/scamPatterns';

const MZ = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // Windows PE header
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\n');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

interface CraftEntry {
  name: string;
  data: Buffer;
  flags?: number; // general-purpose bit flag
  sizeOverride?: number; // lie about uncompressed size (zip-bomb fixture)
}

/** Tiny CRC32 (adm-zip verifies it on getData()). */
function crc32(buf: Buffer): number {
  let table = (crc32 as unknown as { t?: number[] }).t;
  if (!table) {
    table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    (crc32 as unknown as { t: number[] }).t = table;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Build a minimal *stored* (uncompressed) ZIP by hand so tests control
 * entry names, flags and header sizes exactly.
 */
function craftZip(entries: CraftEntry[]): Buffer {
  const chunks: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8');
    const flags = e.flags ?? 0;
    const size = e.sizeOverride ?? e.data.length;
    const crc = crc32(e.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(10, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(0, 8); // stored
    // 12 mod time, 14 mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed size
    local.writeUInt32LE(size, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    chunks.push(local, name, e.data);

    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0);
    cen.writeUInt16LE(20, 4); // version made by
    cen.writeUInt16LE(10, 6); // version needed
    cen.writeUInt16LE(flags, 8);
    cen.writeUInt16LE(0, 10); // stored
    // 12 mod time, 14 mod date
    cen.writeUInt32LE(crc, 16);
    cen.writeUInt32LE(size, 20); // compressed size
    cen.writeUInt32LE(size, 24); // uncompressed size
    cen.writeUInt16LE(name.length, 28); // filename length
    // 30 extra len, 32 comment len, 34 disk, 36 int attrs, 38 ext attrs (zero)
    cen.writeUInt32LE(offset, 42); // local header offset
    central.push(cen, name);
    offset += 30 + name.length + e.data.length;
  }
  const centralStart = offset;
  const centralSize = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  return Buffer.concat([...chunks, ...central, end]);
}

function realZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content));
  return zip.toBuffer();
}

describe('scanUpload — clean files pass', () => {
  it('accepts a real PDF', () => {
    const r = scanUpload({ buffer: PDF, filename: 'guide.pdf' });
    assert.equal(r.clean, true, JSON.stringify(r.reasons));
  });
  it('accepts a real PNG', () => {
    const r = scanUpload({ buffer: PNG, filename: 'cover.png' });
    assert.equal(r.clean, true, JSON.stringify(r.reasons));
  });
  it('accepts a clean ZIP', () => {
    const r = scanUpload({ buffer: realZip({ 'readme.txt': 'hello' }), filename: 'pack.zip' });
    assert.equal(r.clean, true, JSON.stringify(r.reasons));
  });
});

describe('scanUpload — blocked types', () => {
  it('rejects .exe', () => {
    const r = scanUpload({ buffer: MZ, filename: 'setup.exe' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.includes('.exe')), JSON.stringify(r.reasons));
  });
  it('rejects double extensions (doc.pdf.exe)', () => {
    const r = scanUpload({ buffer: MZ, filename: 'doc.pdf.exe' });
    assert.equal(r.clean, false, JSON.stringify(r.reasons));
  });
  it('rejects sneaky double extensions (report.exe.pdf)', () => {
    // .exe hidden before a harmless final extension + MZ bytes inside.
    const r = scanUpload({ buffer: MZ, filename: 'report.exe.pdf' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.toLowerCase().includes('double extension')));
  });
  it('rejects magic-byte mismatch (.pdf holding PNG bytes)', () => {
    const r = scanUpload({ buffer: PNG, filename: 'guide.pdf' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.includes('does not match its extension')));
  });
  it('rejects executables hiding behind innocent extensions', () => {
    const r = scanUpload({ buffer: MZ, filename: 'notes.txt' });
    assert.equal(r.clean, false);
  });
  it('rejects empty files', () => {
    const r = scanUpload({ buffer: Buffer.alloc(0), filename: 'empty.pdf' });
    assert.equal(r.clean, false);
  });
  it('rejects .rar with the use-ZIP message', () => {
    const r = scanUpload({ buffer: Buffer.from('Rar!\x1a\x07'), filename: 'pack.rar' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.includes('Please upload a ZIP file')));
  });
});

describe('scanUpload — ZIP inspection', () => {
  it('rejects a ZIP containing an .exe', () => {
    const r = scanUpload({ buffer: craftZip([{ name: 'evil.exe', data: MZ }]), filename: 'pack.zip' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.includes('blocked file type')));
  });
  it('rejects a nested ZIP containing a .bat', () => {
    const inner = craftZip([{ name: 'run.bat', data: Buffer.from('@echo off') }]);
    const outer = craftZip([{ name: 'inner.zip', data: inner }]);
    const r = scanUpload({ buffer: outer, filename: 'pack.zip' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.includes('blocked file type')));
  });
  it('rejects a zip bomb (huge uncompressed size in headers)', () => {
    const bomb = craftZip([
      { name: 'huge.bin', data: Buffer.from('x'), sizeOverride: 600 * 1024 * 1024 },
    ]);
    const r = scanUpload({ buffer: bomb, filename: 'pack.zip' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.toLowerCase().includes('zip bomb')));
  });
  it('rejects encrypted entries', () => {
    const enc = craftZip([{ name: 'secret.txt', data: Buffer.from('x'), flags: 0x0001 }]);
    const r = scanUpload({ buffer: enc, filename: 'pack.zip' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.toLowerCase().includes('encrypted')));
  });
  it('rejects path traversal entries', () => {
    const evil = craftZip([{ name: '../evil.txt', data: Buffer.from('x') }]);
    const r = scanUpload({ buffer: evil, filename: 'pack.zip' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.toLowerCase().includes('suspicious path')));
  });
  it('rejects archives with more than 500 entries', () => {
    const entries: CraftEntry[] = [];
    for (let i = 0; i < 600; i++) entries.push({ name: `f${i}.txt`, data: Buffer.from('x') });
    const r = scanUpload({ buffer: craftZip(entries), filename: 'pack.zip' });
    assert.equal(r.clean, false);
    assert.ok(r.reasons.some((x) => x.includes('600 files')));
  });
  it('rejects double extensions inside ZIPs', () => {
    const r = scanUpload({
      buffer: craftZip([{ name: 'invoice.pdf.exe', data: MZ }]),
      filename: 'pack.zip',
    });
    assert.equal(r.clean, false);
  });
});

describe('scanListingText — scam phrases', () => {
  it('flags guaranteed-profit copy', () => {
    const hits = scanListingText('Crypto Signals', 'Join now for guaranteed profit every week!');
    assert.ok(hits.length > 0, 'expected a hit');
    assert.ok(hits.some((h) => h.label === 'guaranteed profit'));
  });
  it('flags double-your-crypto patterns', () => {
    const hits = scanListingText('Bot', 'Send 1 BTC, double your crypto back in 24h');
    assert.ok(hits.length > 0);
  });
  it('flags risk-free investment claims', () => {
    const hits = scanListingText('Course', 'A risk-free investment system, 100% guaranteed returns');
    assert.ok(hits.length >= 2, JSON.stringify(hits));
  });
  it('leaves clean copy alone', () => {
    const hits = scanListingText(
      'Evergreen — 24 Lightroom Presets',
      'A pack of 24 moody presets for Lightroom. Works with RAW and JPEG.'
    );
    assert.equal(hits.length, 0, JSON.stringify(hits));
  });
});
