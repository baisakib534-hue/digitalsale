import Link from 'next/link';
import { formatUsd } from '../lib/format';
import { BADGE_LABEL, type Badge } from '../lib/badges';

export interface CardProduct {
  id: string;
  title: string;
  price_usd: number; // cents
  category: string;
  cover_url: string | null;
  store_name: string;
  store_slug: string;
}

const BADGE_TONE: Record<Badge, 'ember' | 'mint' | 'gold'> = {
  'best-seller': 'ember',
  trending: 'gold',
  new: 'mint',
};

export default function ProductCard({ product, badges = [] }: { product: CardProduct; badges?: Badge[] }) {
  return (
    <article className="product-card">
      <Link href={`/product/${product.id}`} className="cover" aria-label={product.title}>
        {product.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.cover_url} alt={product.title} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--paper-2)' }} />
        )}
        {badges.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 10,
              left: 10,
              display: 'flex',
              gap: 6,
              flexWrap: 'wrap',
            }}
          >
            {badges.map((b) => (
              <span key={b} className={`badge-pill badge-${BADGE_TONE[b]}`}>
                {BADGE_LABEL[b]}
              </span>
            ))}
          </div>
        )}
      </Link>
      <div className="body">
        <span className="cat">{product.category}</span>
        <h3>
          <Link href={`/product/${product.id}`}>{product.title}</Link>
        </h3>
        <span className="store">
          by <Link href={`/store/${product.store_slug}`}>{product.store_name}</Link>
        </span>
        <div className="foot">
          <span className="price">{formatUsd(product.price_usd)}</span>
          <Link href={`/product/${product.id}`} className="btn btn-outline btn-sm">
            View
          </Link>
        </div>
      </div>
    </article>
  );
}
