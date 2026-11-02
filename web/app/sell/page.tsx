import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import { CATEGORIES } from '../../lib/categories';
import Reveal, { RevealGroup, RevealItem } from '../../components/Reveal';

const PERKS = [
  { title: `Keep ${100 - BRAND.feePercent}%`, body: `One flat ${BRAND.feePercent}% platform fee on every sale. No tiers, no surprises.` },
  { title: `${BRAND.payoutAsset} payouts`, body: 'Cash out to your own wallet from anywhere in the world — no bank account, no borders.' },
  { title: 'Instant delivery', body: 'Files are scanned, archived and delivered the second payment confirms.' },
  { title: 'Affiliates on autopilot', body: 'Turn on the affiliate program per product, set your commission, and let promoters sell for you.' },
  { title: 'Telegram-native', body: 'Your store lives inside Telegram too, where your buyers already are.' },
  { title: 'Real humans, real trust', body: 'Gmail-only accounts, mandatory Telegram verification, public reports and file scanning keep scammers out.' },
];

const CoinSvg = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v9M9.5 9.5c0-1 1.2-1.8 2.5-1.8s2.5.8 2.5 1.8-1 1.6-2.5 2-2.5 1-2.5 2 1.2 1.8 2.5 1.8 2.5-.8 2.5-1.8" />
  </svg>
);

const SendSvg = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 3L10 14" />
    <path d="M21 3l-7 18-4-7-7-4z" />
  </svg>
);

const BoltSvg = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M13 2L4 14h6l-1 8 9-12h-6z" />
  </svg>
);

const UsersSvg = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 010 6.8M17.5 14.9c2 .7 3.4 2.5 4 5.1" />
  </svg>
);

const BoxSvg = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8l9-5 9 5v8l-9 5-9-5z" />
    <path d="M3 8l9 5 9-5M12 13v8" />
  </svg>
);

const ShieldSvg = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);

const PERK_ICONS = [CoinSvg, SendSvg, BoltSvg, UsersSvg, BoxSvg, ShieldSvg];

export default function SellPage() {
  return (
    <>
      <section className="hero-slim">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Sell on {BRAND.name}</span>
            <h1>Your work, <span className="glow">your payout</span>.</h1>
            <p className="lede">
              Open a store in minutes, list digital products, and keep {100 - BRAND.feePercent}% of
              every sale — paid out in {BRAND.payoutAsset}, anywhere on earth.
            </p>
            <p className="fineprint" style={{ maxWidth: 560 }}>
              <strong>Legal goods only.</strong> Pirated, stolen, malware, or otherwise illegal
              content means a <strong>permanent ban</strong> — no warnings. See our{' '}
              <Link href="/terms">Terms of Service</Link>.
            </p>
            <div className="hero-cta">
              <Link href="/auth?mode=signup" className="btn btn-primary btn-lg">
                Open your store — it&apos;s free
              </Link>
            </div>
            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Link href="/fees" className="btn btn-outline btn-sm">See the fees</Link>
              <Link href="/how-it-works" className="btn btn-outline btn-sm">How it works</Link>
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span className="badge-pill badge-ember">Free to start</span>
              <span className="badge-pill">No monthly plans</span>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="section section-tight">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Why sellers choose {BRAND.name}</span>
          </Reveal>
          <RevealGroup className="perk-grid" style={{ marginTop: 24 }}>
            {PERKS.map((p, i) => (
              <RevealItem key={p.title}>
                <div className="panel perk" style={{ marginBottom: 0 }}>
                  <span className="p-icon" style={{ color: 'var(--ember)' }}>
                    {PERK_ICONS[i]}
                  </span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>
      <section className="section section-tight" style={{ background: 'var(--paper-2)', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }}>
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">What sells here</span>
            <h2>Ten categories, zero gatekeepers</h2>
            <div className="cat-row" style={{ marginTop: 24 }}>
              {CATEGORIES.map((c) => (
                <Link key={c} href={`/market?category=${encodeURIComponent(c)}`} className="chip clickable">
                  {c}
                </Link>
              ))}
            </div>
            <p style={{ marginTop: 24, maxWidth: 640, color: 'var(--sage)' }}>
              From prompt packs to trading signals, ebooks to bots — if it&apos;s digital and
              it&apos;s yours, it belongs here.
            </p>
          </Reveal>
        </div>
      </section>
      <section className="section section-tight">
        <div className="wrap">
          <Reveal>
            <div className="panel cta-panel">
              <div style={{ maxWidth: 560 }}>
                <h2>Two minutes to your <em>first listing.</em></h2>
                <p>Sign up with Gmail, verify with Telegram, name your store. That&apos;s the whole setup.</p>
              </div>
              <Link href="/auth?mode=signup" className="btn btn-primary btn-lg">
                Open your store
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}