import Link from 'next/link';
import { getDb } from '../lib/db';
import { BRAND } from '../lib/brand';
import ProductCard, { type CardProduct } from '../components/ProductCard';
import { enrichCards } from '../lib/cards';
import { getActiveFlashDeals } from '../lib/flashDeals';
import EmptyState, { SproutGlyph } from '../components/EmptyState';
import LandingSearch from '../components/LandingSearch';
import Reveal, { RevealGroup, RevealItem } from '../components/Reveal';

export const dynamic = 'force-dynamic';

function statDisplay(n: number): string {
  return n > 0 ? n.toLocaleString('en-US') : '—';
}

export default function LandingPage() {
  const db = getDb();
  const latestRaw = db
    .prepare(
      `SELECT p.id, p.title, p.price_usd, p.category, p.cover_url,
              s.name AS store_name, s.slug AS store_slug
       FROM products p
       JOIN stores s ON s.id = p.store_id
       WHERE p.status = 'published' AND s.status != 'suspended'
       ORDER BY p.created_at DESC
       LIMIT 12`
    )
    .all() as CardProduct[];
  const latest = enrichCards(db, latestRaw);

  const stats = {
    productsLive: (
      db.prepare(`SELECT COUNT(*) AS c FROM products WHERE status = 'published'`).get() as {
        c: number;
      }
    ).c,
    filesScanned: (db.prepare('SELECT COUNT(*) AS c FROM product_files').get() as { c: number }).c,
    reportsResolved: (
      db.prepare(`SELECT COUNT(*) AS c FROM reports WHERE status != 'open'`).get() as { c: number }
    ).c,
    sellersVerified: (
      db.prepare('SELECT COUNT(*) AS c FROM users WHERE telegram_verified = 1').get() as { c: number }
    ).c,
  };

  return (
    <>
      {/* Hero — one thing the eye lands on first */}
      <section className="hero-slim">
        <div className="wrap">
          <Reveal delay={0.08}>
            <h1>Digital goods, <span className="glow">made by independents</span>.</h1>
          </Reveal>
          <Reveal delay={0.16}>
            <p className="lede">
              {BRAND.tagline} — sellers keep {100 - BRAND.feePercent}% of every sale, paid out in{' '}
              {BRAND.payoutAsset}.
            </p>
          </Reveal>
          <Reveal delay={0.24}>
            <LandingSearch />
            <div className="hero-cta">
              <Link href="/market" className="btn btn-primary btn-lg">
                Browse everything
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Fresh listings */}
      <section className="section section-tight" style={{ paddingBottom: 8 }}>
        <div className="wrap">
          <Reveal>
            <div className="section-head">
              <div>
                <span className="eyebrow">Fresh listings</span>
                <h2>From the market this week</h2>
              </div>
            </div>
          </Reveal>
        </div>
        {latest.length === 0 ? (
          <div className="wrap">
            <div style={{ marginTop: 24 }}>
              <EmptyState
                glyph={<SproutGlyph />}
                title="The shelves are still empty"
                body="The first sellers are setting up their stores. Check back soon — or be the first to list."
                action={{ href: '/sell', label: 'Start selling' }}
              />
            </div>
          </div>
        ) : (
          <RevealGroup className="product-grid" style={{ marginTop: 28 }}>
            {latest.map((p) => (
              <RevealItem key={p.id}>
                <ProductCard product={p} />
              </RevealItem>
            ))}
          </RevealGroup>
        )}

      {/* Flash deals rail — only when live deals exist */}
      {(() => {
        const activeDeals = getActiveFlashDeals(db);
        if (activeDeals.length === 0) return null;
        const dealProducts = activeDeals
          .map((deal: { product_id: string; discount_percent: number; ends_at: string }) => {
            const product = latest.find((p) => p.id === deal.product_id);
            return product ? { ...product, flash_deal: { discount_percent: deal.discount_percent, ends_at: deal.ends_at } } : null;
          })
          .filter((p): p is CardProduct & { flash_deal: { discount_percent: number; ends_at: string } } => !!p);
        if (dealProducts.length === 0) return null;
        return (
          <section className="section section-tight" style={{ paddingTop: 8 }}>
            <div className="wrap">
              <Reveal>
                <div className="section-head">
                  <div>
                    <span className="eyebrow" style={{ color: 'var(--ember)' }}>Flash deals</span>
                    <h2>Live discounts <em>right now.</em></h2>
                  </div>
                </div>
              </Reveal>
              <RevealGroup className="product-grid" style={{ marginTop: 28 }}>
                {dealProducts.map((p: CardProduct & { flash_deal: { discount_percent: number; ends_at: string } }) => (
                  <RevealItem key={p.id}>
                    <ProductCard product={p} />
                  </RevealItem>
                ))}
              </RevealGroup>
            </div>
          </section>
        );
      })()}
      </section>

      {/* Trust strip — four pillars */}
      <div className="trust-strip">
        <div className="wrap">
          <RevealGroup className="trust-grid">
            <RevealItem>
              <div className="trust-item">
                <span className="t-icon" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="2" width="20" height="20" rx="2" />
                    <path d="M12 22V12" />
                    <path d="M22 12H12" />
                  </svg>
                </span>
                <div>
                  <b>Telegram-verified sellers</b>
                  <span>Every seller links a real Telegram account before listing. No faceless stores.</span>
                </div>
              </div>
            </RevealItem>
            <RevealItem>
              <div className="trust-item">
                <span className="t-icon" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </span>
                <div>
                  <b>Every file malware-scanned</b>
                  <span>Uploads are inspected — including inside ZIPs — before they can be sold.</span>
                </div>
              </div>
            </RevealItem>
            <RevealItem>
              <div className="trust-item">
                <span className="t-icon" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                </span>
                <div>
                  <b>Reports are public</b>
                  <span>Anyone can report a listing; three reports pause it pending review.</span>
                </div>
              </div>
            </RevealItem>
            <RevealItem>
              <div className="trust-item">
                <span className="t-icon" aria-hidden>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                </span>
                <div>
                  <b>10% flat fee — nothing hidden</b>
                  <span>One fee, stated everywhere. No tiers, no surprises, no payout minimums.</span>
                </div>
              </div>
            </RevealItem>
          </RevealGroup>
        </div>
      </div>

      {/* Safety, in the open — live numbers */}
      <section className="section safety-open">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Safety, in the open</span>
            <h2>Trust you can <em>count.</em></h2>
            <p className="lede">
              No fake testimonials, no inflated counters. These are live numbers from our database —
              what&apos;s actually listed, scanned, and resolved right now.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <div className="stat-ledger">
              <div className="stat-cell">
                <div className="num">{statDisplay(stats.productsLive)}</div>
                <div className="lbl">products live in the market</div>
              </div>
              <div className="stat-cell">
                <div className="num">{statDisplay(stats.filesScanned)}</div>
                <div className="lbl">files malware-scanned before sale</div>
              </div>
              <div className="stat-cell">
                <div className="num">{statDisplay(stats.sellersVerified)}</div>
                <div className="lbl">sellers verified with Telegram</div>
              </div>
              <div className="stat-cell">
                <div className="num">{statDisplay(stats.reportsResolved)}</div>
                <div className="lbl">community reports resolved</div>
              </div>
            </div>
          </Reveal>
          <p className="fineprint">
            Every upload is scanned for executables, disguised file types, and anything hiding inside
            ZIP archives. Reports from buyers are public, and three independent reports pause a
            listing until a moderator reviews it.
          </p>
        </div>
      </section>

      {/* Roadmap */}
      <section className="section section-tight">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Roadmap</span>
            <h2>What&apos;s <em>coming next.</em></h2>
            <p className="lede">We&apos;re building in the open — here&apos;s what&apos;s on the way.</p>
          </Reveal>
          <RevealGroup style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginTop: 8 }}>
            <RevealItem>
              <div className="perk">
                <span className="chip" style={{ marginBottom: 12 }}>Coming soon</span>
                <h3 style={{ margin: '0 0 8px' }}>Local payments</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14.5, margin: 0 }}>
                  Pay the way you already do — local payment methods are coming, so buyers can check
                  out in their own currency, no crypto wallet needed.
                </p>
              </div>
            </RevealItem>
            <RevealItem>
              <div className="perk">
                <span className="chip" style={{ marginBottom: 12 }}>Coming soon</span>
                <h3 style={{ margin: '0 0 8px' }}>On Google Search</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14.5, margin: 0 }}>
                  We&apos;re publishing the marketplace to Google, so your products get discovered by
                  buyers searching the web — not just inside Telegram.
                </p>
              </div>
            </RevealItem>
          </RevealGroup>
        </div>
      </section>

      {/* Marquee — compact proof strip */}
      <div className="marquee" aria-hidden>
        <div className="marquee-track">
          {['10% flat fee — keep 90%', 'USDT payouts, anywhere', 'Instant downloads', 'No payout minimums', 'Telegram-native', 'Sell from anywhere', '10% flat fee — keep 90%', 'USDT payouts, anywhere', 'Instant downloads', 'No payout minimums', 'Telegram-native', 'Sell from anywhere'].map((item, i) => (
            <span key={i}>
              {item} <span className="tick-star">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* Buyer CTA — bottom of page, buyer-first */}
      <section className="section section-tight">
        <div className="wrap">
          <Reveal>
            <div className="panel cta-panel">
              <div style={{ maxWidth: 560 }}>
                <h2>Find something <em>made for you.</em></h2>
                <p>
                  Browse independent digital goods — presets, templates, ebooks and more. Buy in
                  seconds, download instantly, yours forever.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href="/market" className="btn btn-primary btn-lg">
                  Browse the market
                </Link>
                <Link href="/sell" className="btn btn-outline btn-lg">
                  Sell your work
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}