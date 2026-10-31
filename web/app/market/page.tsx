import { Suspense } from 'react';
import { getDb } from '../../lib/db';
import { isCategory } from '../../lib/categories';
import { getBadges, trendingIds, bestSellerIds, type Badge } from '../../lib/badges';
import { stockInfo } from '../../lib/stock';
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

type CardRow = CardProduct & { stock_limit: number | null };

function fetchCards(db: ReturnType<typeof getDb>, ids: string[]): CardProduct[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.price_usd, p.category, p.cover_url,
              s.name AS store_name, s.slug AS store_slug
       FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE p.id IN (${placeholders}) AND p.status = 'published' AND s.status != 'suspended'`
    )
    .all(...ids) as CardProduct[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter((r): r is CardProduct => !!r);
}

export default function MarketPage({ searchParams }: { searchParams: MarketSearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const category = isCategory(searchParams.category ?? '') ? searchParams.category! : '';
  const sort = searchParams.sort === 'price-asc' || searchParams.sort === 'price-desc' ? searchParams.sort : 'newest';
  const filtering = q !== '' || category !== '';

  const db = getDb();
  let sql = `SELECT p.id, p.title, p.price_usd, p.category, p.cover_url, p.stock_limit,
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

  const rows = db.prepare(sql).all(...params) as CardRow[];
  // v7: sold-out products are unlisted from the market grid.
  const products: CardProduct[] = rows.filter((r) => !stockInfo(db, r).soldOut);

  const badges = getBadges(db);
  const badgeOf = (id: string): Badge[] => badges.get(id) ?? [];

  // Amazon-style sections (only on the unfiltered market view).
  const trending = filtering ? [] : fetchCards(db, trendingIds(db));
  const bestSellers = filtering ? [] : fetchCards(db, bestSellerIds(db));

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

        {!filtering && trending.length > 0 && (
          <section style={{ margin: '8px 0 44px' }}>
            <h2 style={{ fontSize: 24, margin: '0 0 18px' }}>
              Trending <span className="glow">now</span>
            </h2>
            <RevealGroup className="product-grid">
              {trending.map((p) => (
                <RevealItem key={p.id}>
                  <ProductCard product={p} badges={badgeOf(p.id)} />
                </RevealItem>
              ))}
            </RevealGroup>
          </section>
        )}

        {!filtering && bestSellers.length > 0 && (
          <section style={{ margin: '8px 0 44px' }}>
            <h2 style={{ fontSize: 24, margin: '0 0 18px' }}>
              Best <span className="glow">sellers</span>
            </h2>
            <RevealGroup className="product-grid">
              {bestSellers.map((p) => (
                <RevealItem key={p.id}>
                  <ProductCard product={p} badges={badgeOf(p.id)} />
                </RevealItem>
              ))}
            </RevealGroup>
          </section>
        )}

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
                  <ProductCard product={p} badges={badgeOf(p.id)} />
                </RevealItem>
              ))}
            </RevealGroup>
          </>
        )}
      </div>
    </>
  );
}
