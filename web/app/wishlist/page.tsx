import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDb } from '../../lib/db';
import { getSessionUserId } from '../../lib/auth';
import ProductCard, { type CardProduct } from '../../components/ProductCard';
import EmptyState, { BasketGlyph } from '../../components/EmptyState';
import { enrichCards } from '../../lib/cards';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'My wishlist' };

function currentUserId(): string | null {
  const header = cookies().toString();
  return getSessionUserId(new Request('http://internal/', { headers: { cookie: header } }));
}

export default function WishlistPage() {
  const uid = currentUserId();
  if (!uid) redirect('/auth');

  const db = getDb();
  const rows = db
    .prepare(
      `SELECT p.id, p.title, p.price_usd, p.category, p.cover_url,
              s.name AS store_name, s.slug AS store_slug
       FROM wishlists w
       JOIN products p ON p.id = w.product_id
       JOIN stores s ON s.id = p.store_id
       WHERE w.user_id = ? AND p.status = 'published' AND s.status != 'suspended'
       ORDER BY w.created_at DESC`
    )
    .all(uid) as CardProduct[];
  const products = enrichCards(db, rows);

  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <h1>My wishlist</h1>
          <p>Everything you&apos;ve saved for later. Tap the heart again to remove.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 48, paddingBottom: 88 }}>
        {products.length === 0 ? (
          <EmptyState
            glyph={<BasketGlyph />}
            title="Nothing saved yet"
            body="Tap the heart on any product to keep it here for later."
            action={{ href: '/market', label: 'Browse the market' }}
          />
        ) : (
          <div className="product-grid">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
