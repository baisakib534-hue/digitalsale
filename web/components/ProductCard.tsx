import Link from 'next/link';
import { formatUsd } from '../lib/format';

export interface CardProduct {
  id: string;
  title: string;
  price_usd: number; // cents
  category: string;
  cover_url: string | null;
  store_name: string;
  store_slug: string;
}

export default function ProductCard({ product }: { product: CardProduct }) {
  return (
    <article className="product-card">
      <Link href={`/product/${product.id}`} className="cover" aria-label={product.title}>
        {product.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.cover_url} alt={product.title} loading="lazy" />
        ) : (
          <div style={{ width: '100%', height: '100%', background: 'var(--paper-2)' }} />
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
