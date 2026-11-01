import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '../../../lib/db';
import { getStoreByToken, parseSocials } from '../../../lib/stores';
import { stockInfo } from '../../../lib/stock';
import { formatUsd } from '../../../lib/format';
import { SocialRow } from '../../../components/Whitelabel';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const db = getDb();
  const store = getStoreByToken(db, params.token);
  return { title: { absolute: store ? `${store.name} — Store` : 'Store' } };
}

interface WLProduct {
  id: string;
  title: string;
  price_usd: number;
  cover_url: string | null;
  stock_limit: number | null;
}

/**
 * White-label storefront: /s/[token].
 * Chromeless — only the seller's branding. No Digitalsale header, footer,
 * or branding anywhere. Buyers check out through our payment gateway.
 * Designed to be embedded as the seller's own Telegram Mini App.
 */
export default function WhitelabelStorefront({ params }: { params: { token: string } }) {
  const db = getDb();
  const store = getStoreByToken(db, params.token);
  if (!store) notFound();

  const socials = parseSocials(store.socials);
  const rows = db
    .prepare(
      `SELECT id, title, price_usd, cover_url, stock_limit
       FROM products WHERE store_id = ? AND status = 'published'
       ORDER BY created_at DESC`
    )
    .all(store.id) as WLProduct[];
  const products = rows.filter((r) => !stockInfo(db, r).soldOut);

  return (
    <div className="wl">
      {/* Banner */}
      <div
        className="wl-banner"
        style={
          store.banner_url
            ? { backgroundImage: `url(${store.banner_url})` }
            : undefined
        }
      />
      <div className="wrap" style={{ paddingBottom: 72 }}>
        {/* Identity */}
        <div className="wl-identity">
          {store.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.avatar_url} alt={store.name} className="wl-logo" />
          ) : (
            <span className="wl-logo wl-logo-fallback" aria-hidden>
              {store.name.charAt(0).toUpperCase()}
            </span>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 className="wl-name">{store.name}</h1>
            {store.bio && <p className="wl-bio">{store.bio}</p>}
            <div style={{ marginTop: 10 }}>
              <SocialRow socials={socials} />
            </div>
          </div>
        </div>

        {/* Products */}
        <h2 className="wl-section">Products</h2>
        {products.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>Nothing here yet — check back soon.</p>
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <Link key={p.id} href={`/s/${params.token}/p/${p.id}`} className="wl-card">
                <span className="wl-card-cover">
                  {p.cover_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_url} alt={p.title} loading="lazy" />
                  ) : (
                    <span className="wl-card-cover-empty" />
                  )}
                </span>
                <span className="wl-card-body">
                  <span className="wl-card-title">{p.title}</span>
                  <span className="wl-card-price">{formatUsd(p.price_usd)}</span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
