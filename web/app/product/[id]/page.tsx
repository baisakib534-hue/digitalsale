import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '../../../lib/db';
import { BRAND } from '../../../lib/brand';
import { formatUsd, timeAgo } from '../../../lib/format';
import BuyPanel from '../../../components/BuyPanel';
import RefCapture from '../../../components/RefCapture';
import ReportButton from '../../../components/ReportButton';
import SafetySection from '../../../components/SafetySection';
import Reveal from '../../../components/Reveal';
import { Stamp, IconShield, IconUsers } from '../../../components/doodles';

export const dynamic = 'force-dynamic';

interface ProductPageRow {
  id: string;
  title: string;
  description: string;
  price_usd: number;
  category: string;
  tags: string;
  cover_url: string | null;
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
              p.status, p.created_at,
              pa.enabled AS affiliate_enabled, pa.commission_percent AS affiliate_commission,
              s.name AS store_name, s.slug AS store_slug, s.bio AS store_bio
       FROM products p
       JOIN stores s ON s.id = p.store_id
       LEFT JOIN product_affiliates pa ON pa.product_id = p.id
       WHERE p.id = ?`
    )
    .get(params.id) as ProductPageRow | undefined;

  if (!row || (row.status !== 'published' && row.status !== 'suspended')) notFound();

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

  const fee = Math.round((row.price_usd * BRAND.feePercent) / 100);
  const underReview = row.status === 'suspended';

  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 88 }}>
      <RefCapture productId={row.id} />
      <div className="product-layout">
        <div>
          {row.cover_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.cover_url} alt={row.title} className="product-cover" style={{ marginBottom: 32 }} />
          )}
          <div className="cat-row">
            <span className="chip">{row.category}</span>
            {row.affiliate_enabled === 1 && !underReview && (
              <Stamp tone="moss" rotate={false}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconUsers size={14} />
                  {row.affiliate_commission}% affiliate program
                </span>
              </Stamp>
            )}
            {!underReview && fileCount > 0 && (
              <Stamp tone="ember" rotate={false}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconShield size={14} />
                  Scanned clean
                </span>
              </Stamp>
            )}
          </div>
          <h1 style={{ marginTop: 16 }}>{row.title}</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>
            Listed {timeAgo(row.created_at)}
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
              <div className="buy-rows">
                <div className="row">
                  <span>You pay</span>
                  <strong>{formatUsd(row.price_usd)}</strong>
                </div>
                <div className="row">
                  <span>Seller receives</span>
                  <strong>{formatUsd(row.price_usd - fee)}</strong>
                </div>
                <div className="row">
                  <span>Platform fee ({BRAND.feePercent}%)</span>
                  <span>{formatUsd(fee)}</span>
                </div>
              </div>
              <BuyPanel productId={row.id} priceCents={row.price_usd} />
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
