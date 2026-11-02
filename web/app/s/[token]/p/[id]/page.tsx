'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { formatUsd, timeAgo } from '../../../../../lib/format';
import { IconBox, IconBolt, IconSend, IconTag, IconDownload, IconShield, IconCoin } from '../../../../../components/doodles';
import EmptyState from '../../../../../components/EmptyState';

type ProductData = {
  id: string;
  title: string;
  coverUrl?: string;
  price: number;
  description?: string;
  category: string;
  seller: { slug: string; name: string; avatarUrl?: string };
  createdAt: string;
  shortToken: string;
};

export default function ShortProductPage() {
  const { token, id } = useParams<{ token: string; id: string }>();
  const [product, setProduct] = useState<ProductData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !id) return;
    fetch(`/api/s/${token}/p/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Product not found');
        return r.json();
      })
      .then((data) => {
        setProduct(data);
        setLoading(false);
      })
      .catch(() => {
        setError('This product link has expired or never existed.');
        setLoading(false);
      });
  }, [token, id]);

  if (loading) {
    return (
      <div className="wrap" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-10)', maxWidth: 720, margin: '0 auto' }}>
        <div className="skeleton" style={{ height: 400, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="wrap" style={{ paddingTop: 'var(--space-10)', paddingBottom: 'var(--space-10)', textAlign: 'center' }}>
        <EmptyState
          glyph={<IconBox size={48} />}
          title="Product not found"
          body={error || 'This product link has expired or never existed.'}
          action={{ label: 'Browse the market', href: '/market' }}
        />
      </div>
    );
  }

  return (
    <article style={{ maxWidth: 720, margin: '0 auto', padding: 'var(--space-6) var(--space-4)' }}>
      <Link href={`/s/${token}`} className="link" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-5)', fontSize: 14, color: 'var(--muted)' }}>
        <IconSend size={14} /> Back to store
      </Link>

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
          <Link href={`/s/${token}`} className="link" style={{ fontWeight: 600, fontSize: 15 }}>
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