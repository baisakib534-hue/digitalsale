import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '../../../lib/db';
import ProductCard, { type CardProduct } from '../../../components/ProductCard';
import EmptyState, { SproutGlyph } from '../../../components/EmptyState';
import ReportButton from '../../../components/ReportButton';
import SafetySection from '../../../components/SafetySection';
import { Stamp, IconCheck } from '../../../components/doodles';

export const dynamic = 'force-dynamic';

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  bio: string;
  avatar_url: string | null;
  status: string;
  created_at: string;
}

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const db = getDb();
  const store = db.prepare('SELECT name FROM stores WHERE slug = ?').get(params.slug) as
    | { name: string }
    | undefined;
  return { title: store ? `${store.name} — store` : 'Store not found' };
}

export default function StorePage({ params }: { params: { slug: string } }) {
  const db = getDb();
  const store = db
    .prepare('SELECT id, name, slug, bio, avatar_url, status, created_at FROM stores WHERE slug = ?')
    .get(params.slug) as StoreRow | undefined;

  if (!store) notFound();
  const suspendedStore = store.status === 'suspended';

  const products = suspendedStore
    ? []
    : (db
        .prepare(
          `SELECT p.id, p.title, p.price_usd, p.category, p.cover_url,
                  s.name AS store_name, s.slug AS store_slug
           FROM products p
           JOIN stores s ON s.id = p.store_id
           WHERE p.store_id = ? AND p.status = 'published'
           ORDER BY p.created_at DESC`
        )
        .all(store.id) as CardProduct[]);

  return (
    <>
      <div className="store-hero">
        <div className="wrap">
          {store.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={store.avatar_url}
              alt=""
              style={{ width: 96, height: 96, borderRadius: 28, objectFit: 'cover', flex: 'none' }}
            />
          ) : (
            <span className="store-avatar" aria-hidden>
              {(store.name || 'S').charAt(0).toUpperCase()}
            </span>
          )}
          <div>
            <h1>{store.name}</h1>
            {store.bio && <p>{store.bio}</p>}
            <p style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="chip" style={{ background: 'rgba(250,245,234,0.14)', color: 'var(--paper)' }}>
                {products.length} {products.length === 1 ? 'product' : 'products'}
              </span>
              {suspendedStore ? (
                <Stamp tone="ember">Under review</Stamp>
              ) : (
                <Stamp tone="moss" rotate={false}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <IconCheck size={14} />
                    Trusted store
                  </span>
                </Stamp>
              )}
            </p>
          </div>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 48, paddingBottom: 88 }}>
        <div style={{ marginBottom: 24 }}>
          <Link href="/market" className="btn btn-outline btn-sm">
            ← Back to market
          </Link>
        </div>
        {suspendedStore ? (
          <div className="panel" style={{ borderColor: 'var(--ember)' }}>
            <h3 style={{ marginTop: 0 }}>This store is under review</h3>
            <p style={{ marginBottom: 0 }}>
              {store.name} was paused after community reports and is being reviewed by our
              moderators. Its listings are hidden until the review is complete.
            </p>
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            glyph={<SproutGlyph />}
            title="Nothing listed yet"
            body={`${store.name} hasn't published any products. Check back soon — or browse the rest of the market.`}
            action={{ href: '/market', label: 'Browse the market' }}
          />
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        <div style={{ maxWidth: 720 }}>
          <SafetySection targetType="store" targetId={store.id} />
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <ReportButton targetType="store" targetId={store.id} />
        </div>
      </div>
    </>
  );
}
