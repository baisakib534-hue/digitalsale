import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db';
import { createDownloadToken, getSessionUserId } from '../../../lib/auth';
import { formatUsd, timeAgo } from '../../../lib/format';
import EmptyState, { BasketGlyph } from '../../../components/EmptyState';
import LicenseKeyBox from '../../../components/LicenseKeyBox';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My purchases' };

interface PurchaseRow {
  order_id: string;
  product_id: string;
  product_title: string;
  product_cover: string | null;
  store_name: string;
  store_slug: string;
  license_key: string | null;
  created_at: string;
}

interface FileRow {
  id: string;
  filename: string;
  size: number;
}

function currentUserId(): string | null {
  const header = cookies().toString();
  return getSessionUserId(new Request('http://internal/', { headers: { cookie: header } }));
}

export default function PurchasesPage() {
  const uid = currentUserId();
  if (!uid) redirect('/auth');

  const db = getDb();
  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(uid) as
    | { id: string; email: string | null }
    | undefined;
  if (!user) redirect('/auth');

  const orders = db
    .prepare(
      `SELECT o.id AS order_id, o.product_id, o.created_at,
              p.title AS product_title, p.cover_url AS product_cover,
              s.name AS store_name, s.slug AS store_slug,
              lk.license_key AS license_key
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN license_keys lk ON lk.order_id = o.id
       WHERE o.status = 'paid' AND (o.buyer_id = ? OR (o.buyer_email != '' AND o.buyer_email = ?))
       ORDER BY o.created_at DESC`
    )
    .all(uid, user.email ?? '') as PurchaseRow[];

  const filesByOrder = new Map<string, { file: FileRow; token: string }[]>();
  const filesStmt = db.prepare('SELECT id, filename, size FROM product_files WHERE product_id = ?');
  for (const o of orders) {
    const files = filesStmt.all(o.product_id) as FileRow[];
    filesByOrder.set(
      o.order_id,
      files.map((f) => ({ file: f, token: createDownloadToken(o.order_id, f.id) }))
    );
  }

  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <h1>My purchases</h1>
          <p>Everything you&apos;ve bought, with lifetime download links. Keep this page bookmarked.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 48, paddingBottom: 88, maxWidth: 900 }}>
        {orders.length === 0 ? (
          <EmptyState
            glyph={<BasketGlyph />}
            title="No purchases yet"
            body="When you buy a product on Digitalsale, it lands here with instant download links — forever."
            action={{ href: '/market', label: 'Browse the market' }}
          />
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            {orders.map((o) => (
              <div className="order-line" key={o.order_id} style={{ padding: 20 }}>
                {o.product_cover && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.product_cover}
                    alt=""
                    style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, flex: 'none' }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/product/${o.product_id}`} style={{ fontWeight: 700, fontSize: 17 }}>
                    {o.product_title}
                  </Link>
                  <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
                    from <Link href={`/store/${o.store_slug}`}>{o.store_name}</Link>
                    {' '}· bought {timeAgo(o.created_at)}
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                    {(filesByOrder.get(o.order_id) ?? []).map(({ file, token }) => (
                      <a
                        key={file.id}
                        href={`/api/download/${token}`}
                        className="btn btn-outline btn-sm"
                        title={file.filename}
                      >
                        Download {file.filename.length > 28 ? `${file.filename.slice(0, 26)}…` : file.filename}
                      </a>
                    ))}
                    {(filesByOrder.get(o.order_id) ?? []).length === 0 && (
                      <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
                        The seller hasn&apos;t attached files yet — check back soon.
                      </span>
                    )}
                  </div>
                  {o.license_key && <LicenseKeyBox licenseKey={o.license_key} />}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
