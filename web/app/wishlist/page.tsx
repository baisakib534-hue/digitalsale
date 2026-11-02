'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatUsd } from '../../lib/format';
import { IconHeart, IconTag, IconDownload, IconSend } from '../../components/doodles';
import EmptyState from '../../components/EmptyState';

function WishlistContent() {
  const router = useRouter();
  const [items, setItems] = useState<Array<{
    id: string;
    title: string;
    coverUrl?: string;
    price: number;
    seller: { slug: string; name: string };
    addedAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    fetch('/api/me/wishlist')
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setEmpty((data.items || []).length === 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setEmpty(true);
      });
  }, []);

  return (
    <div className="wrap" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
      <header style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Your wishlist</h1>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>{items.length} item{items.length !== 1 ? 's' : ''} saved</p>
        </div>
      </header>

      {loading ? (
        <div className="wishlist-skeleton" style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="wishlist-item skeleton" style={{ display: 'grid', gridTemplateColumns: '96px 1fr', gap: 'var(--space-4)', alignItems: 'start' }}>
              <div className="skeleton" style={{ width: 96, height: 96, borderRadius: 'var(--radius-md)' }} />
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="skeleton" style={{ height: 20, width: '60%', borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ height: 16, width: '40%', borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ height: 16, width: '30%', borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ height: 40, width: '100%', borderRadius: 'var(--radius-sm)' }} />
              </div>
            </div>
          ))}
        </div>
      ) : empty ? (
        <EmptyState
          glyph={<IconHeart size={48} />}
          title="Nothing saved yet"
          body="Browse the market and click the heart on any product to save it here."
          action={{ label: 'Explore the market', href: '/market' }}
        />
      ) : (
        <div className="wishlist-grid" style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {items.map((item) => (
            <article key={item.id} className="wishlist-item" style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 'var(--space-4)', alignItems: 'start', padding: 'var(--space-4)', background: 'var(--panel)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-lg)' }}>
              <Link href={`/store/${item.seller.slug}/p/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ width: 96, height: 96, borderRadius: 'var(--radius-md)', background: 'var(--line-soft)', overflow: 'hidden', flexShrink: 0 }}>
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                      <IconTag size={28} />
                    </div>
                  )}
                </div>
              </Link>
              <div style={{ minWidth: 0 }}>
                <Link href={`/store/${item.seller.slug}/p/${item.id}`} className="link" style={{ fontWeight: 600, fontSize: 16 }}>
                  {item.title}
                </Link>
                <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 4, marginBottom: 8 }}>
                  by <Link href={`/store/${item.seller.slug}`} className="link">{item.seller.name}</Link>
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>{formatUsd(item.price)}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 13.5 }}>Added {new Date(item.addedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' }}>
                <button className="btn btn-primary" style={{ width: 'max-content' }} onClick={() => router.push(`/store/${item.seller.slug}/p/${item.id}`)}>
                  <IconDownload size={16} /> Buy
                </button>
                <button className="btn btn-ghost" style={{ width: 'max-content', fontSize: 13 }} onClick={() => {
                  fetch('/api/me/wishlist', {
                    method: 'DELETE',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ productId: item.id }),
                  }).then(() => setItems(items.filter((i) => i.id !== item.id)));
                }}>
                  Remove
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function WishlistPage() {
  return (
    <Suspense fallback={<div className="wishlist-skeleton" style={{ display: 'grid', gap: 'var(--space-4)' }}><div className="skeleton" style={{ height: 140 }} /></div>}>
      <WishlistContent />
    </Suspense>
  );
}