import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import { CATEGORIES } from '../../lib/categories';
import Reveal, { RevealGroup, RevealItem } from '../../components/Reveal';
import { Stamp, Squiggle, IconCoin, IconBolt, IconBox, IconUsers, IconSend, IconShield } from '../../components/doodles';

const PERKS = [
  { icon: <IconCoin size={22} />, title: `Keep ${100 - BRAND.feePercent}%`, body: `One flat ${BRAND.feePercent}% platform fee on every sale. No tiers, no surprises.` },
  { icon: <IconSend size={22} />, title: `${BRAND.payoutAsset} payouts`, body: 'Cash out to your own wallet from anywhere in the world — no bank account, no borders.' },
  { icon: <IconBolt size={22} />, title: 'Instant delivery', body: 'Files are scanned, archived and delivered the second payment confirms.' },
  { icon: <IconUsers size={22} />, title: 'Affiliates on autopilot', body: 'Turn on the affiliate program per product, set your commission, and let promoters sell for you.' },
  { icon: <IconBox size={22} />, title: 'Telegram-native', body: 'Your store lives inside Telegram too, where your buyers already are.' },
  { icon: <IconShield size={22} />, title: 'Real humans, real trust', body: 'Gmail-only accounts, mandatory Telegram verification, public reports and file scanning keep scammers out.' },
];

export default function SellPage() {
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Sell on {BRAND.name}</span>
            <h1>
              Your work,{' '}
              <span className="squiggle-wrap">
                your payout
                <Squiggle />
              </span>
              .
            </h1>
            <p className="lede">
              Open a store in minutes, list digital products, and keep {100 - BRAND.feePercent}% of
              every sale — paid out in {BRAND.payoutAsset}, anywhere on earth.
            </p>
            <div className="hero-ctas">
              <Link href="/auth?mode=signup" className="btn btn-primary btn-lg">
                Open your store — it&apos;s free
              </Link>
              <Link href="/fees" className="btn btn-outline-light btn-lg">
                See the fees
              </Link>
            </div>
            <div style={{ marginTop: 28, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Stamp tone="ember">Free to start</Stamp>
              <Stamp>No monthly plans</Stamp>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="section-tight">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Why sellers choose {BRAND.name}</span>
          </Reveal>
          <RevealGroup className="perk-grid" style={{ marginTop: 24 }}>
            {PERKS.map((p) => (
              <RevealItem key={p.title}>
                <div className="panel perk" style={{ marginBottom: 0 }}>
                  <span className="p-icon">{p.icon}</span>
                  <h3>{p.title}</h3>
                  <p>{p.body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>
      <section className="section-tight" style={{ background: 'var(--paper-2)', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }}>
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
      <section className="section-tight">
        <div className="wrap">
          <Reveal>
            <div className="panel cta-panel">
              <div style={{ maxWidth: 560 }}>
                <h2>
                  Two minutes to your <em>first listing.</em>
                </h2>
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
