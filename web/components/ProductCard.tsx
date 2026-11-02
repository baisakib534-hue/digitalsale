import Link from 'next/link';
import { formatUsd } from '../lib/format';
import { BADGE_LABEL, type Badge } from '../lib/badges';
import WishlistButton from './WishlistButton';

export interface CardProduct {
  id: string;
  title: string;
  price_usd: number;
  category: string;
  cover_url: string | null;
  store_name: string;
  store_slug: string;
  rating_avg?: number | null;
  rating_count?: number;
  wishlisted?: boolean;
}

const BADGE_TONE: Record<Badge, 'ember' | 'mint' | 'gold'> = {
  'best-seller': 'ember',
  trending: 'gold',
  new: 'mint',
};

export default function ProductCard({
  product,
  badges = [],
}: {
  product: CardProduct;
  badges?: Badge[];
}) {
  return (
    <article className="product-card">
      <Link href={`/product/${product.id}`} className="cover" aria-label={product.title}>
        {product.cover_url ? (
          <img src={product.cover_url} alt={product.title} loading="lazy" />
        ) : (
          <div className="cover-empty" />
        )}
        {badges.length > 0 && (
          <div className="badge-stack" aria-label="Product badges">
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
          <span className="foot-extras">
            {product.rating_count && product.rating_avg !== null && product.rating_avg !== undefined && (
              <span className="rating" title={`${product.rating_count} review${product.rating_count === 1 ? '' : 's'}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                {product.rating_avg.toFixed(1)} ({product.rating_count})
              </span>
            )}
            <WishlistButton productId={product.id} initial={product.wishlisted ?? false} size={32} />
          </span>
        </div>
      </div>
    </article>
  );
}