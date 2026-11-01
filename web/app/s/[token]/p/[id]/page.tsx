import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDb } from '../../../../../lib/db';
import { getStoreByToken } from '../../../../../lib/stores';
import { stockInfo } from '../../../../../lib/stock';
import { formatUsd, timeAgo } from '../../../../../lib/format';
import BuyPanel from '../../../../../components/BuyPanel';
import ProductMedia from '../../../../../components/ProductMedia';
import { WhitelabelBack } from '../../../../../components/Whitelabel';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { token: string; id: string };
}): Promise<Metadata> {
  const db = getDb();
  const store = getStoreByToken(db, params.token);
  if (!store) return { title: { absolute: 'Store' } };
  const row = db.prepare('SELECT title FROM products WHERE id = ? AND store_id = ?').get(
    params.id,
    store.id
  ) as { title: string } | undefined;
  return { title: { absolute: row ? `${row.title} — ${store.name}` : store.name } };
}

/** White-label product page: seller branding only, our payment gateway at checkout. */
export default function WhitelabelProduct({ params }: { params: { token: string; id: string } }) {
  const db = getDb();
  const store = getStoreByToken(db, params.token);
  if (!store) notFound();

  const row = db
    .prepare(
      `SELECT id, title, description, price_usd, category, cover_url, video_url, stock_limit, status
       FROM products WHERE id = ? AND store_id = ?`
    )
    .get(params.id, store.id) as
    | {
        id: string;
        title: string;
        description: string;
        price_usd: number;
        category: string;
        cover_url: string | null;
        video_url: string | null;
        stock_limit: number | null;
        status: string;
      }
    | undefined;
  if (!row || row.status !== 'published') notFound();

  const stock = stockInfo(db, row);
  const gallery = db
    .prepare('SELECT id, filename, mime FROM product_images WHERE product_id = ? ORDER BY position')
    .all(row.id) as { id: string; filename: string; mime: string }[];
  const images = gallery.map((g) => ({ ...g, url: `/api/images/${g.id}` }));

  return (
    <div className="wl">
      <div className="wrap" style={{ paddingTop: 28, paddingBottom: 72, maxWidth: 1080 }}>
        <WhitelabelBack token={params.token} />
        {/* Seller mini-identity */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          {store.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.avatar_url}
              alt={store.name}
              style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }}
            />
          ) : (
            <span
              aria-hidden
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: 'var(--ink)',
                color: 'var(--paper)',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
                fontSize: 20,
              }}
            >
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <div style={{ fontWeight: 700 }}>{store.name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{row.category}</div>
          </div>
        </div>

        <div className="product-layout">
          <div>
            <ProductMedia
              title={row.title}
              videoUrl={row.video_url}
              images={images}
              coverUrl={row.cover_url}
            />
            <h1 style={{ marginTop: 16 }}>{row.title}</h1>
            {row.description && (
              <div style={{ marginTop: 16 }}>
                {row.description.split('\n\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            )}
          </div>
          <aside className="buy-panel" aria-label="Buy this product">
            {stock.soldOut ? (
              <div>
                <div className="price-line">{formatUsd(row.price_usd)}</div>
                <div className="form-error" role="status" style={{ marginTop: 12 }}>
                  Sold out — the seller limited this product and every spot is gone.
                </div>
              </div>
            ) : (
              <div>
                <div className="price-line">{formatUsd(row.price_usd)}</div>
                {stock.stockLimit !== null && (
                  <p className="form-note" style={{ margin: '8px 0 16px' }}>
                    Only {stock.remaining} of {stock.stockLimit} spots left.
                  </p>
                )}
                <BuyPanel productId={row.id} priceCents={row.price_usd} />
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
