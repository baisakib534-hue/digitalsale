import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '../../../lib/db';
import { createDownloadToken, getSessionUserId } from '../../../lib/auth';
import { formatUsd, timeAgo } from '../../../lib/format';
import EmptyState, { BasketGlyph } from '../../../components/EmptyState';
import LicenseKeyBox from '../../../components/LicenseKeyBox';
import ReviewForm from '../../../components/ReviewForm';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My purchases' };

interface PurchaseItemRow {
  order_id: string;
  product_id: string;
  product_title: string;
  product_cover: string | null;
  store_name: string;
  store_slug: string;
  license_key: string | null;
  created_at: string;
  bundle_id: string | null;
  price_winner: string | null;
  price_cents: number;
}

interface FileRow {
  id: string;
  filename: string;
  size: number;
}

interface GroupedOrder {
  order_id: string;
  created_at: string;
  bundle_id: string | null;
  price_winner: string | null;
  items: PurchaseItemRow[];
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

  // Fetch all order items for the user (both single product and bundle orders)
  const orderItems = db
    .prepare(
      `SELECT o.id AS order_id, oi.product_id, oi.price_cents, o.created_at, o.bundle_id, o.price_winner,
              p.title AS product_title, p.cover_url AS product_cover,
              s.name AS store_name, s.slug AS store_slug,
              lk.license_key AS license_key
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN products p ON p.id = oi.product_id
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN license_keys lk ON lk.order_id = o.id AND lk.product_id = oi.product_id
       WHERE o.status = 'paid' AND (o.buyer_id = ? OR (o.buyer_email != '' AND o.buyer_email = ?))
       ORDER BY o.created_at DESC`
    )
    .all(uid, user.email ?? '') as PurchaseItemRow[];

  // Group items by order_id
  const ordersById = new Map<string, GroupedOrder>();
  for (const item of orderItems) {
    if (!ordersById.has(item.order_id)) {
      ordersById.set(item.order_id, {
        order_id: item.order_id,
        created_at: item.created_at,
        bundle_id: item.bundle_id,
        price_winner: item.price_winner,
        items: [],
      });
    }
    ordersById.get(item.order_id)!.items.push(item);
  }

  const orders = Array.from(ordersById.values());

  // Fetch files for all products
  const filesStmt = db.prepare('SELECT id, filename, size FROM product_files WHERE product_id = ?');
  const filesByOrder = new Map<string, { file: FileRow; token: string; productTitle: string }[]>();
  for (const o of orders) {
    for (const item of o.items) {
      const files = filesStmt.all(item.product_id) as FileRow[];
      for (const f of files) {
        const token = createDownloadToken(o.order_id, f.id);
        if (!filesByOrder.has(o.order_id)) filesByOrder.set(o.order_id, []);
        filesByOrder.get(o.order_id)!.push({ file: f, token, productTitle: item.product_title });
      }
    }
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
                {o.bundle_id ? (
                  <div style={{ marginBottom: 16 }}>
                    <span className="badge badge-info" style={{ fontSize: 12, padding: '4px 10px' }}>
                      Bundle of {o.items.length}
                      {o.price_winner && <span style={{ marginLeft: 8 }}>Price: {o.price_winner}</span>}
                    </span>
                  </div>
                ) : null}
                {o.items.map((item, idx) => (
                  <div key={item.product_id} style={{ display: 'flex', gap: 16, alignItems: 'flex-start', marginTop: idx > 0 ? 16 : 0, paddingTop: idx > 0 ? 16 : 0, borderTop: idx > 0 ? '1px solid var(--border)' : 'none' }}>
                    {item.product_cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.product_cover}
                        alt=""
                        style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 12, flex: 'none' }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Link href={`/product/${item.product_id}`} style={{ fontWeight: 700, fontSize: 17 }}>
                        {item.product_title}
                      </Link>
                      <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
                        from <Link href={`/store/${item.store_slug}`}>{item.store_name}</Link>
                        {' '}· bought {timeAgo(o.created_at)}
                        {o.bundle_id && <span> · Bundle order</span>}
                      </p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
                        {(filesByOrder.get(o.order_id) ?? [])
                          .filter((f) => f.productTitle === item.product_title)
                          .map(({ file, token }) => (
                            <a
                              key={file.id}
                              href={`/api/download/${token}`}
                              className="btn btn-outline btn-sm"
                              title={file.filename}
                            >
                              Download {file.filename.length > 28 ? `${file.filename.slice(0, 26)}…` : file.filename}
                            </a>
                          ))}
                        {(filesByOrder.get(o.order_id) ?? [])
                          .filter((f) => f.productTitle === item.product_title).length === 0 && (
                            <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>
                              The seller hasn&apos;t attached files yet — check back soon.
                            </span>
                          )}
                      </div>
                      {item.license_key && <LicenseKeyBox licenseKey={item.license_key} />}
                      <ReviewForm productId={item.product_id} orderId={o.order_id} productTitle={item.product_title} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}