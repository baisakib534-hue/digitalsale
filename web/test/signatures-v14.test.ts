import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import AdmZip from 'adm-zip';
import {
  fileSignature,
  productSignature,
  refreshProductSignature,
  findDuplicateProduct,
} from '../lib/signatures';

function makeZip(files: Record<string, string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) zip.addFile(name, Buffer.from(content));
  return zip.toBuffer();
}

describe('v14 product signatures', () => {
  it('raw files: identical bytes match, different bytes differ', () => {
    const a = fileSignature(Buffer.from('hello'), 'a.png', 'image/png');
    const b = fileSignature(Buffer.from('hello'), 'b.png', 'image/png');
    const c = fileSignature(Buffer.from('world'), 'a.png', 'image/png');
    assert.equal(a, b); // name/mime don't matter, content does
    assert.notEqual(a, c);
    assert.ok(a.startsWith('raw:'));
  });

  it('zip: re-zipping or renaming the outer file keeps the signature', () => {
    const z1 = makeZip({ 'art.png': 'pixels', 'readme.txt': 'hi' });
    const z2 = makeZip({ 'readme.txt': 'hi', 'art.png': 'pixels' }); // different order
    const s1 = fileSignature(z1, 'pack.zip', 'application/zip');
    const s2 = fileSignature(z2, 'renamed.zip', 'application/zip');
    assert.equal(s1, s2);
    assert.ok(s1.startsWith('zip:'));
    const z3 = makeZip({ 'art.png': 'different-pixels', 'readme.txt': 'hi' });
    assert.notEqual(s1, fileSignature(z3, 'pack.zip', 'application/zip'));
  });

  it('productSignature is order-independent and empty-safe', () => {
    assert.equal(productSignature(['b', 'a']), productSignature(['a', 'b']));
    assert.equal(productSignature([]), '');
    assert.equal(productSignature([null]), '');
  });

  it('findDuplicateProduct blocks cross-store, ignores own store', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE products (id TEXT PRIMARY KEY, store_id TEXT, title TEXT, status TEXT, signature TEXT NOT NULL DEFAULT '');
      CREATE TABLE product_files (id TEXT PRIMARY KEY, product_id TEXT, sha256 TEXT);
    `);
    db.prepare(`INSERT INTO products (id, store_id, title, status) VALUES ('p1','s1','Original','published')`).run();
    db.prepare(`INSERT INTO products (id, store_id, title, status) VALUES ('p2','s2','Copy','draft')`).run();
    db.prepare(`INSERT INTO products (id, store_id, title, status) VALUES ('p3','s2','Own other','draft')`).run();
    db.prepare(`INSERT INTO product_files (id, product_id, sha256) VALUES ('f1','p1','sigA'),('f2','p1','sigB')`).run();
    db.prepare(`INSERT INTO product_files (id, product_id, sha256) VALUES ('f3','p2','sigA'),('f4','p2','sigB')`).run();
    db.prepare(`INSERT INTO product_files (id, product_id, sha256) VALUES ('f5','p3','sigA'),('f6','p3','sigB')`).run();
    const sig1 = refreshProductSignature(db, 'p1');
    const sig2 = refreshProductSignature(db, 'p2');
    const sig3 = refreshProductSignature(db, 'p3');
    assert.equal(sig1, sig2);
    assert.equal(sig1, sig3);
    // p2 is another store's product matching p1 -> duplicate found
    const dupe = findDuplicateProduct(db, 'p2', sig2);
    assert.ok(dupe);
    assert.equal(dupe!.id, 'p1');
    // p3 (same store as p2) also matches p1's signature -> still blocked (p1 is another store)
    const dupe3 = findDuplicateProduct(db, 'p3', sig3);
    assert.ok(dupe3);
    assert.equal(dupe3!.id, 'p1');
    // unique signature -> no duplicate
    db.prepare(`INSERT INTO products (id, store_id, title, status) VALUES ('p4','s2','Unique','draft')`).run();
    db.prepare(`INSERT INTO product_files (id, product_id, sha256) VALUES ('f7','p4','sigZ')`).run();
    const sig4 = refreshProductSignature(db, 'p4');
    assert.equal(findDuplicateProduct(db, 'p4', sig4), null);
    // a product never matches itself
    db.prepare(`INSERT INTO products (id, store_id, title, status) VALUES ('p5','s9','Solo','draft')`).run();
    db.prepare(`INSERT INTO product_files (id, product_id, sha256) VALUES ('f8','p5','sigSolo')`).run();
    const sig5 = refreshProductSignature(db, 'p5');
    assert.equal(findDuplicateProduct(db, 'p5', sig5), null);
    // empty signature never matches
    assert.equal(findDuplicateProduct(db, 'p2', ''), null);
    db.close();
  });
});
