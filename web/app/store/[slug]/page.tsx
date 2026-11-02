'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatUsd } from '../../../lib/format';
import { IconBox, IconBolt, IconSend, IconCoin, IconShield } from '../../../components/doodles';
import EmptyState from '../../../components/EmptyState';

type StoreData = {
  slug: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  telegramUsername?: string;
  stats: { products: number; sales: number; followers: number };
  products: Array<{
    id: string;
    title: string;
    coverUrl?: string;
    price: number;
    category: string;
  }>;
};

function ProductCard({ product }: { product: StoreData['products'][0] }) {
  return (
    <Link href={`/store/${useParams<{ slug: string }>().slug}/p/${product.id}`} className="product-card">
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

function StoreHeader({ store }: { store: StoreData }) {
  return (
    <header className="store-header" style={{ position: 'relative', borderBottom: '1px solid var(--line-soft)', background: 'var(--paper)' }}>
      {store.bannerUrl && (
        <div className="store-banner" style={{ height: 160, backgroundImage: `url(${store.bannerUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      )}
      <div className="wrap" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', paddingTop: store.bannerUrl ? 'var(--space-10)' : 'var(--space-6)', paddingBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-5)', flexWrap: 'wrap' }}>
          <div className="store-avatar" style={{ width: 96, height: 96, borderRadius: 'var(--radius-lg)', background: 'var(--line-soft)', overflow: 'hidden', flexShrink: 0, boxShadow: 'var(--shadow-lg)' }}>
            {store.avatarUrl ? (
              <img src={store.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, color: 'var(--muted)' }}>
                {store.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', marginBottom: 4 }}>{store.name}</h1>
            {store.telegramUsername && (
              <p style={{ color: 'var(--ember)', fontWeight: 500, fontSize: 15, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <IconSend size={16} />
                <a href={`https://t.me/${store.telegramUsername}`} target="_blank" rel="noopener noreferrer" className="link" style={{ textDecoration: 'none' }}>
                  @{store.telegramUsername}
                </a>
              </p>
            )}
            {store.bio && <p style={{ color: 'var(--body)', marginTop: 'var(--space-2)', lineHeight: 1.6 }}>{store.bio}</p>}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{store.stats.products}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Products</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{store.stats.sales}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Sales</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)' }}>{store.stats.followers}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>Followers</div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default function StorePage() {
  const { slug } = useParams<{ slug: string }>();
  const [store, setStore] = useState<StoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/stores/${slug}`)
      .then((r) => {
        if (!r.ok) throw new Error('Store not found');
        return r.json();
      })
      .then((data) => {
        setStore(data);
        setLoading(false);
      })
      .catch(() => {
        setError('Store not found');
        setLoading(false);
      });
  }, [slug]);

  if (loading) {
    return (
      <div className="wrap" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        <div className="store-skeleton" style={{ maxWidth: 1000, margin: '0 auto' }}>
          <div className="skeleton" style={{ height: 280, borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 'var(--space-5)' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: 320, borderRadius: 'var(--radius-lg)', background: 'var(--panel)', border: '1px solid var(--line-soft)' }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="wrap" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-10)', textAlign: 'center' }}>
        <EmptyState
          glyph={<IconBox size={48} />}
          title="Store not found"
          body="The store you're looking for doesn't exist or may have been removed."
          action={{ label: 'Browse the market', href: '/market' }}
        />
      </div>
    );
  }

  return (
    <div>
      <StoreHeader store={store} />
      <main className="wrap" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
          <h2 style={{ fontSize: '1.5rem' }}>Products ({store.products.length})</h2>
        </div>
        {store.products.length === 0 ? (
          <EmptyState
            glyph={<IconBox size={48} />}
            title="No products yet"
            body="This creator hasn't listed any products."
          />
        ) : (
          <div className="product-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 'var(--space-5)' }}>
            {store.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}