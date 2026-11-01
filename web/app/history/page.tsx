import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db';
import { createDownloadToken, getSessionUserId } from '../../lib/auth';
import { formatUsd, shortId, timeAgo } from '../../lib/format';
import EmptyState, { BasketGlyph } from '../../components/EmptyState';
import LicenseKeyBox from '../../components/LicenseKeyBox';
import ReviewForm from '../../components/ReviewForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Purchase history' };

interface HistoryRow {
  order_id: string;
  product_id: string;
  product_title: string;
  product_cover: string | null;
  store_name: string;
  store_slug: string;
  amount_usd: number;
  status: string;
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

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  paid: { label: 'Paid', color: 'var(--ok, #16a34a)' },
  pending: { label: 'Pending payment', color: 'var(--warn, #d97706)' },
  failed: { label: 'Failed', color: 'var(--danger, #dc2626)' },
};

/**
 * v14: buyer-facing purchase history — every order the buyer ever placed
 * (paid, pending, failed), with dates, amounts, status, downloads and
 * license keys for paid orders.
 */
export default function HistoryPage() {
  const uid = currentUserId();
  if (!uid) redirect('/auth');

  const db = getDb();
  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(uid) as
    | { id: string; email: string | null }
    | undefined;
  if (!user) redirect('/auth');

  const orders = db
    .prepare(
      `SELECT o.id AS order_id, o.product_id, o.created_at, o.amount_usd, o.status,
              p.title AS product_title, p.cover_url AS product_cover,
              s.name AS store_name, s.slug AS store_slug,
              lk.license_key AS license_key
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN license_keys lk ON lk.order_id = o.id
       WHERE o.buyer_id = ? OR (o.buyer_email != '' AND o.buyer_email = ?)
       ORDER BY o.created_at DESC`
    )
    .all(uid, user.email ?? '') as HistoryRow[];

  const filesByOrder = new Map<string, { file: FileRow; token: string }[]>();
  const filesStmt = db.prepare('SELECT id, filename, size FROM product_files WHERE product_id = ?');
  for (const o of orders) {
    if (o.status !== 'paid') continue;
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
          <h1>Purchase history</h1>
          <p>Everything you&apos;ve ever bought — orders, payments and downloads in one place.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 48, paddingBottom: 88, maxWidth: 900 }}>
        {orders.length === 0 ? (
          <EmptyState
            glyph={<BasketGlyph />}
            title="No orders yet"
            body="When you buy something, it will show up here with its payment status and download links."
            action={{ label: 'Browse the market', href: '/market' }}
          />
        ) : (
          <div style={{ display: 'grid', gap: 16 }}>
            {orders.map((o) => {
              const st = STATUS_LABEL[o.status] ?? { label: o.status, color: 'var(--muted)' };
              const files = filesByOrder.get(o.order_id) ?? [];
              return (
                <div className="order-line" key={o.order_id} style={{ padding: 20 }}>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    {o.product_cover && (
                      <img
                        src={o.product_cover}
                        alt=""
                        style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <strong>{o.product_title}</strong>
                        <span
                          className="chip"
                          style={{ color: st.color, borderColor: st.color }}
                        >
                          {st.label}
                        </span>
                      </div>
                      <p style={{ color: 'var(--muted)', fontSize: 14, margin: '6px 0 0' }}>
                        {formatUsd(o.amount_usd)} · <code>{shortId(o.order_id)}</code> ·{' '}
                        {timeAgo(o.created_at)} ·{' '}
                        <Link href={`/store/${o.store_slug}`}>{o.store_name}</Link>
                      </p>
                      {o.status === 'paid' && (
                        <div style={{ marginTop: 12 }}>
                          {files.map(({ file, token }) => (
                            <div key={file.id} style={{ marginBottom: 6 }}>
                              <a
                                className="btn btn-dark btn-sm"
                                href={`/api/download/${token}`}
                              >
                                ⬇ {file.filename}
                              </a>
                            </div>
                          ))}
                          {o.license_key && (
                            <div style={{ marginTop: 8 }}>
                              <LicenseKeyBox licenseKey={o.license_key} />
                            </div>
                          )}
                          <div style={{ marginTop: 8 }}>
                            <ReviewForm productId={o.product_id} orderId={o.order_id} productTitle={o.product_title} />
                          </div>
                        </div>
                      )}
                      {o.status === 'pending' && (
                        <p style={{ fontSize: 14, color: 'var(--muted)', margin: '8px 0 0' }}>
                          Waiting for payment confirmation — it will appear here automatically
                          once the crypto arrives.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
