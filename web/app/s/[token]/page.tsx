'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BRAND } from '../../../lib/brand';
import { formatUsd, timeAgo } from '../../../lib/format';
import { IconBox, IconBolt, IconSend, IconCoin, IconShield, IconTag } from '../../../components/doodles';
import EmptyState from '../../../components/EmptyState';

type ShortLinkData =
  | { type: 'store'; token: string; store: {
      slug: string;
      name: string;
      avatarUrl?: string;
      bio?: string;
      stats: { products: number; sales: number };
      products: Array<{
        id: string;
        title: string;
        coverUrl?: string;
        price: number;
        category: string;
      }>;
    } }
  | { type: 'product'; token: string; product: {
      id: string;
      title: string;
      coverUrl?: string;
      price: number;
      description?: string;
      category: string;
      seller: { slug: string; name: string; avatarUrl?: string };
      createdAt: string;
    } };

function ProductCard({ product, token }: { product: Extract<ShortLinkData, { type: 'store' }>['store']['products'][0]; token: string }) {
  return (
    <Link href={`/s/${token}/p/${product.id}`} className="product-card">
      <div className="product-card-media">
        {product.coverUrl ? (
          <img src={product.coverUrl} alt="" loading="lazy" />
        ) : (
          <div className="product-card-placeholder"><IconBox size={32} /></div>
        )}
      </div>
      <div className="product-card-body">
        <span className="product-card-category">{product.category}</span>
        <h3 className="product-card-title">{product.title}</h3>
        <div className="product-card-footer">
          <span className="product-card-price">{formatUsd(product.price)}</span>
        </div>
      </div>
    </Link>
  );
}

function StoreHeader({ store }: { store: Extract<ShortLinkData, { type: 'store' }>['store'] }) {
  return (
    <header className="store-header" style={{ position: 'relative', borderBottom: '1px solid var(--line-soft)', background: 'var(--paper)', paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
      <div className="wrap" style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
        <div className="store-avatar" style={{ width: 80, height: 80, borderRadius: 'var(--radius-lg)', background: 'var(--line-soft)', overflow: 'hidden', flexShrink: 0 }}>
          {store.avatarUrl ? (
            <img src={store.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 700, color: 'var(--muted)' }}>
              {store.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 3vw, 2rem)', marginBottom: 4 }}>{store.name}</h1>
          {store.bio && <p style={{ color: 'var(--body)', lineHeight: 1.6 }}>{store.bio}</p>}
          <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13.5 }}>
              <IconBox size={16} />
              <span>{store.stats.products} products</span>
            </div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13.5 }}>
              <IconBolt size={16} />
              <span>{store.stats.sales} sales</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function ProductDetail({ product }: { product: Extract<ShortLinkData, { type: 'product' }>['product'] }) {
  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
        <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', background: 'var(--line-soft)', overflow: 'hidden', flexShrink: 0 }}>
          {product.seller.avatarUrl ? (
            <img src={product.seller.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'var(--muted)' }}>
              {product.seller.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <Link href={`/s/${useParams<{ token: string }>().token}`} className="link" style={{ fontWeight: 600, fontSize: 15 }}>
            {product.seller.name}
          </Link>
          <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 2 }}>{timeAgo(product.createdAt)}</p>
        </div>
      </div>

      <div style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'var(--line-soft)', marginBottom: 'var(--space-5)' }}>
        {product.coverUrl ? (
          <img src={product.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
            <IconTag size={48} />
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
        <div>
          <span className="product-card-category" style={{ marginRight: 'var(--space-3)' }}>{product.category}</span>
          <span style={{ fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 700, color: 'var(--ink)' }}>{formatUsd(product.price)}</span>
        </div>
      </div>

      {product.description && (
        <div style={{ marginBottom: 'var(--space-6)', lineHeight: 1.7, color: 'var(--body)' }}>
          {product.description}
        </div>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <Link href={`/store/${product.seller.slug}/p/${product.id}`} className="btn btn-primary" style={{ flex: 1, textAlign: 'center' }}>
          <IconSend size={16} /> View full product
        </Link>
        <Link href={`/store/${product.seller.slug}`} className="btn btn-outline" style={{ flex: 1, textAlign: 'center' }}>
          <IconBox size={16} /> View store
        </Link>
      </div>
    </article>
  );
}

export default function ShortLinkPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShortLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/s/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error('Link not found');
        return r.json();
      })
      .then((data) => {
        setData(data);
        setLoading(false);
      })
      .catch(() => {
        setError('This link has expired or never existed.');
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="wrap" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-10)' }}>
        <div className="skeleton" style={{ maxWidth: 600, margin: '0 auto', height: 300, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="wrap" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-10)', textAlign: 'center' }}>
        <EmptyState
          glyph={<IconBox size={48} />}
          title="Link not found"
          body={error || 'This link has expired or never existed.'}
          action={{ label: 'Browse the market', href: '/market' }}
        />
      </div>
    );
  }

  if (data.type === 'product') {
    return <ProductDetail product={data.product} />;
  }

  return (
    <div>
      <StoreHeader store={data.store} />
      <main className="wrap" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ fontSize: '1.5rem' }}>Products ({data.store.products.length})</h2>
        </div>
        {data.store.products.length === 0 ? (
          <EmptyState
            glyph={<IconBox size={48} />}
            title="No products yet"
            body="This creator hasn't listed any products."
          />
        ) : (
          <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-5)' }}>
            {data.store.products.map((product) => (
              <ProductCard key={product.id} product={product} token={data.token} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}