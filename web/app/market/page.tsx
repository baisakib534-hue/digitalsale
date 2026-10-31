import { Suspense } from 'react';
import { getDb } from '../../lib/db';
import { isCategory } from '../../lib/categories';
import MarketToolbar from '../../components/MarketToolbar';
import ProductCard, { type CardProduct } from '../../components/ProductCard';
import EmptyState, { SearchGlyph } from '../../components/EmptyState';
import RefCapture from '../../components/RefCapture';
import Reveal, { RevealGroup, RevealItem } from '../../components/Reveal';
import { Stamp } from '../../components/doodles';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Marketplace' };

interface MarketSearchParams {
  q?: string;
  category?: string;
  sort?: string;
}

export default function MarketPage({ searchParams }: { searchParams: MarketSearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const category = isCategory(searchParams.category ?? '') ? searchParams.category! : '';
  const sort = searchParams.sort === 'price-asc' || searchParams.sort === 'price-desc' ? searchParams.sort : 'newest';

  const db = getDb();
  let sql = `SELECT p.id, p.title, p.price_usd, p.category, p.cover_url,
                    s.name AS store_name, s.slug AS store_slug
             FROM products p
             JOIN stores s ON s.id = p.store_id
             WHERE p.status = 'published' AND s.status != 'suspended'`;
  const params: unknown[] = [];
  if (category) {
    sql += ' AND p.category = ?';
    params.push(category);
  }
  if (q) {
    sql += ' AND (p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }
  sql +=
    sort === 'price-asc'
      ? ' ORDER BY p.price_usd ASC'
      : sort === 'price-desc'
        ? ' ORDER BY p.price_usd DESC'
        : ' ORDER BY p.created_at DESC';

  const products = db.prepare(sql).all(...params) as CardProduct[];

  return (
    <>
      <RefCapture productId={null} />
      <div className="page-hero">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">The market</span>
            <h1>Marketplace</h1>
            <p>
              Digital goods from independent creators — presets, templates, icons, ebooks, textures
              and UI kits. Every seller keeps 90% of every sale.
            </p>
            <div style={{ marginTop: 24 }}>
              <Stamp tone="ember">Every file scanned</Stamp>
            </div>
          </Reveal>
        </div>
      </div>
      <div className="wrap" style={{ paddingBottom: 88 }}>
        <Suspense>
          <MarketToolbar />
        </Suspense>
        {products.length === 0 ? (
          <EmptyState
            glyph={<SearchGlyph />}
            title="No products match"
            body={
              q || category
                ? 'Nothing found for these filters. Try a different search term, or clear the filters to see everything.'
                : 'The market is quiet right now. Check back soon — new work lands every day.'
            }
            action={q || category ? { href: '/market', label: 'Clear filters' } : undefined}
          />
        ) : (
          <>
            <p style={{ color: 'var(--muted)', fontSize: 14, margin: '0 0 20px' }}>
              {products.length} {products.length === 1 ? 'product' : 'products'}
              {q && (
                <>
                  {' '}matching <strong>“{q}”</strong>
                </>
              )}
              {category && (
                <>
                  {' '}in <strong>{category}</strong>
                </>
              )}
            </p>
            <RevealGroup className="product-grid">
              {products.map((p) => (
                <RevealItem key={p.id}>
                  <ProductCard product={p} />
                </RevealItem>
              ))}
            </RevealGroup>
          </>
        )}
      </div>
    </>
  );
}