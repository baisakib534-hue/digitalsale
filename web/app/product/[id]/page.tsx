import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '../../../lib/db';
import { BRAND } from '../../../lib/brand';
import { formatUsd, timeAgo } from '../../../lib/format';
import BuyPanel from '../../../components/BuyPanel';
import ProductMedia from '../../../components/ProductMedia';
import RefCapture from '../../../components/RefCapture';
import ReportButton from '../../../components/ReportButton';
import SafetySection from '../../../components/SafetySection';
import Reveal from '../../../components/Reveal';
import { stockInfo } from '../../../lib/stock';
import { getBadges, BADGE_LABEL } from '../../../lib/badges';
import { productRating } from '../../../lib/reviews';
import { currentUserIdFromCookies } from '../../../lib/cards';
import { isWishlisted } from '../../../lib/wishlist';
import WishlistButton from '../../../components/WishlistButton';

export const dynamic = 'force-dynamic';

interface ProductPageRow {
  id: string;
  title: string;
  description: string;
  price_usd: number;
  category: string;
  tags: string;
  cover_url: string | null;
  video_url: string | null;
  stock_limit: number | null;
  status: string;
  created_at: string;
  affiliate_enabled: number | null;
  affiliate_commission: number | null;
  store_name: string;
  store_slug: string;
  store_bio: string;
}

export async function generateMetadata({ params }: { params: { id: string } }) {
  const db = getDb();
  const row = db
    .prepare('SELECT title, price_usd FROM products WHERE id = ? AND status = ?')
    .get(params.id, 'published') as { title: string; price_usd: number } | undefined;
  if (!row) return { title: 'Product not found' };
  return { title: `${row.title} — ${formatUsd(row.price_usd)}` };
}

export default function ProductPage({ params }: { params: { id: string } }) {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.id, p.title, p.description, p.price_usd, p.category, p.tags, p.cover_url,
              p.video_url, p.stock_limit, p.status, p.created_at,
              pa.enabled AS affiliate_enabled, pa.commission_percent AS affiliate_commission,
              s.name AS store_name, s.slug AS store_slug, s.bio AS store_bio
       FROM products p
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN product_affiliates pa ON pa.product_id = p.id
       WHERE p.id = ?`
    )
    .get(params.id) as ProductPageRow | undefined;

  if (!row || (row.status !== 'published' && row.status !== 'suspended')) notFound();

  const gallery = db
    .prepare('SELECT id, filename FROM product_images WHERE product_id = ? ORDER BY position, created_at')
    .all(row.id) as { id: string; filename: string }[];

  const fileCount = (
    db.prepare('SELECT COUNT(*) AS n FROM product_files WHERE product_id = ?').get(row.id) as {
      n: number;
    }
  ).n;

  const paragraphs = row.description
    .split(/\r?\n\r?\n|\r?\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const tags = row.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);

  const underReview = row.status === 'suspended';
  const stock = stockInfo(db, row);
  const soldOut = stock.soldOut && !underReview;
  const badges = getBadges(db).get(row.id) ?? [];
  const rating = productRating(db, row.id);
  const soldTotal = (
    db.prepare(`SELECT COUNT(*) AS c FROM orders WHERE product_id = ? AND status = 'paid'`).get(row.id) as {
      c: number;
    }
  ).c;

  const reviews = db
    .prepare(
      `SELECT id, rating, body, created_at FROM reviews
       WHERE product_id = ? ORDER BY created_at DESC LIMIT 20`
    )
    .all(row.id) as { id: string; rating: number; body: string; created_at: string }[];

  let wishlisted = false;
  try {
    const uid = currentUserIdFromCookies();
    if (uid) wishlisted = isWishlisted(db, uid, row.id);
  } catch {
    /* cookies unavailable */
  }

  const ShieldSvg = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );

  const UsersSvg = (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
      <path d="M16 4.6a3.5 3.5 0 010 6.8M17.5 14.9c2 .7 3.4 2.5 4 5.1" />
    </svg>
  );

  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 88 }}>
      <RefCapture productId={row.id} />
      <div className="product-layout">
        <div>
          <ProductMedia
            title={row.title}
            videoUrl={row.video_url}
            images={gallery}
            coverUrl={row.cover_url}
          />
          <div className="cat-row">
            <span className="chip">{row.category}</span>
            {badges.map((b) => (
              <span
                key={b}
                className={`badge-pill badge-${b === 'best-seller' ? 'ember' : b === 'trending' ? 'gold' : 'mint'}`}
              >
                {BADGE_LABEL[b]}
              </span>
            ))}
            {soldOut && (
              <span className="badge-pill" style={{ background: 'var(--muted)', color: 'var(--ink)' }}>
                Sold out
              </span>
            )}
            {row.affiliate_enabled === 1 && !underReview && (
              <span className="badge-pill badge-moss" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {UsersSvg}
                {row.affiliate_commission}% affiliate program
              </span>
            )}
            {!underReview && fileCount > 0 && (
              <span className="badge-pill badge-ember" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {ShieldSvg}
                Scanned clean
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginTop: 16 }}>
            <h1 style={{ margin: 0, flex: 1 }}>{row.title}</h1>
            <WishlistButton productId={row.id} initial={wishlisted} size={40} />
          </div>
          {rating.count > 0 && (
            <p style={{ margin: '8px 0 0', fontSize: 14.5 }}>
              <a href="#reviews" style={{ fontWeight: 700, color: 'var(--ink)' }}>
                ★ {rating.avg?.toFixed(1)}
              </a>
              <span style={{ color: 'var(--muted)' }}>
                {' '}· {rating.count} review{rating.count === 1 ? '' : 's'} from verified buyers
              </span>
            </p>
          )}
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Listed {timeAgo(row.created_at)}
            {soldTotal > 0 && (
              <>
                {' '}· <strong style={{ color: 'var(--ink)' }}>{soldTotal}</strong> sold
              </>
            )}
            {fileCount > 0 && (
              <>
                {' '}· {fileCount} {fileCount === 1 ? 'file' : 'files'} included · instant download
              </>
            )}
          </p>
          {underReview ? (
            <Reveal>
              <div className="panel" style={{ borderColor: 'var(--ember)' }}>
                <h3 style={{ marginTop: 0 }}>Under review</h3>
                <p style={{ marginBottom: 0 }}>
                  This product was paused after community reports and is being reviewed by our
                  moderators. It can&apos;t be purchased right now.
                </p>
              </div>
            </Reveal>
          ) : (
            <div style={{ marginTop: 24 }}>
              {paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          )}
          {tags.length > 0 && !underReview && (
            <div className="cat-row" style={{ marginTop: 24 }}>
              {tags.map((t) => (
                <Link key={t} href={`/market?q=${encodeURIComponent(t)}`} className="chip clickable">
                  {t}
                </Link>
              ))}
            </div>
          )}
          <div id="reviews" className="panel" style={{ marginTop: 40, scrollMarginTop: 80 }}>
            <h3 style={{ margin: '0 0 4px' }}>
              Reviews{' '}
              <span style={{ color: 'var(--muted)', fontWeight: 400, fontSize: 15 }}>
                {rating.count > 0 ? (
                  <>★ {rating.avg?.toFixed(1)} · {rating.count} verified</>
                ) : (
                  '— no reviews yet'
                )}
              </span>
            </h3>
            {reviews.length === 0 ? (
              <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 0 }}>
                Be the first to review this product after you buy it.
              </p>
            ) : (
              <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                {reviews.map((r) => (
                  <div key={r.id} style={{ borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                      <span
                        style={{
                          color: 'var(--gold, #d97706)',
                          letterSpacing: 2,
                        }}
                        aria-label={`${r.rating} out of 5 stars`}
                      >
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </span>
                      <span className="chip">Verified buyer</span>
                      <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--muted)' }}>
                        {timeAgo(r.created_at)}
                      </span>
                    </div>
                    {r.body && <p style={{ margin: '8px 0 0', fontSize: 14.5 }}>{r.body}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="panel" style={{ marginTop: 40 }}>
            <h3 style={{ marginBottom: 12 }}>About the seller</h3>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <span
                aria-hidden
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: 'var(--moss)',
                  color: 'var(--paper)',
                  display: 'grid',
                  placeItems: 'center',
                  fontFamily: 'var(--font-display)',
                  fontSize: '1.5rem',
                  flex: 'none',
                }}
              >
                {(row.store_name || 'S').charAt(0).toUpperCase()}
              </span>
              <div>
                <Link href={`/store/${row.store_slug}`} style={{ fontWeight: 700, fontSize: 17 }}>
                  {row.store_name}
                </Link>
                {row.store_bio && (
                  <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>
                    {row.store_bio.length > 140 ? `${row.store_bio.slice(0, 140)}…` : row.store_bio}
                  </p>
                )}
              </div>
            </div>
          </div>
          <SafetySection targetType="product" targetId={row.id} />
          <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
            <ReportButton targetType="product" targetId={row.id} />
          </div>
        </div>
        <aside className="buy-panel" aria-label="Buy this product">
          {underReview ? (
            <div>
              <span className="eyebrow" style={{ marginBottom: 0 }}>
                Unavailable
              </span>
              <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                This product is under review and can&apos;t be purchased right now.
              </p>
            </div>
          ) : soldOut ? (
            <div>
              <span className="eyebrow" style={{ marginBottom: 0 }}>
                Sold out
              </span>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.5rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  margin: '8px 0 4px',
                }}
              >
                {formatUsd(row.price_usd)}
              </div>
              <p style={{ marginTop: 12, color: 'var(--muted)' }}>
                The seller limited this product to {stock.stockLimit} buyers, and every spot is
                taken. It may come back — follow the store for restocks.
              </p>
              <Link href={`/store/${row.store_slug}`} className="btn btn-outline" style={{ width: '100%' }}>
                Visit {row.store_name}
              </Link>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <span className="eyebrow" style={{ marginBottom: 0 }}>
                  One-time payment
                </span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: '2.5rem',
                  fontWeight: 600,
                  color: 'var(--ink)',
                  margin: '8px 0 4px',
                }}
              >
                {formatUsd(row.price_usd)}
              </div>
              <BuyPanel productId={row.id} priceCents={row.price_usd} />
              {stock.stockLimit !== null && (
                <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--ember)' }}>
                  {stock.remaining === 1
                    ? 'Only 1 spot left'
                    : `Only ${stock.remaining} of ${stock.stockLimit} spots left`}
                </p>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}