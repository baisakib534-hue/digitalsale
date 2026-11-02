'use client';

import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import { IconShield, IconBolt, IconCoin, IconBox, IconSend } from '../../components/doodles';

const perks = [
  { icon: IconCoin, title: 'One flat fee', body: `${BRAND.feePercent}% + $0.30 per sale. No tiers, no hidden fees, no monthly charges.` },
  { icon: IconBolt, title: 'Instant payouts', body: `Paid in ${BRAND.payoutAsset} to any wallet, anywhere in the world. No minimums.` },
  { icon: IconShield, title: 'Seller protection', body: 'Dispute handling built in. We mediate, you keep selling.' },
  { icon: IconBox, title: 'Digital delivery', body: 'Files served from our CDN. Buyers download instantly, you never manage storage.' },
  { icon: IconSend, title: 'Global by default', body: 'No banking barriers. If they have Telegram or a browser, they can buy.' },
];

const comparison = [
  { feature: 'Platform fee', digitalsale: `${BRAND.feePercent}%`, others: '10–20%+' },
  { feature: 'Payout asset', digitalsale: BRAND.payoutAsset, others: 'Local currency / bank only' },
  { feature: 'Payout minimum', digitalsale: 'None', others: '$10–$50+' },
  { feature: 'Payout speed', digitalsale: 'Instant (on-chain)', others: '3–14 business days' },
  { feature: 'Global sellers', digitalsale: 'Yes', others: 'Limited countries' },
  { feature: 'Digital delivery', digitalsale: 'Built-in CDN', others: 'Self-hosted / limited' },
];

export default function FeesPage() {
  return (
    <div className="wrap" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
      <header style={{ marginBottom: 'var(--space-8)', maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
        <span className="eyebrow" style={{ marginLeft: 'auto', marginRight: 'auto' }}>Simple pricing</span>
        <h1>Keep {100 - BRAND.feePercent}% of every sale</h1>
        <p className="lede">One flat fee. Instant ${BRAND.payoutAsset} payouts. No borders, no minimums, no surprises.</p>
      </header>

      <section className="section" style={{ maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>What you pay</h2>
        <div className="perk-grid">
          {perks.map((p, i) => (
            <article key={i} className="perk">
              <div style={{ display: 'inline-flex', marginBottom: 'var(--space-3)', color: 'var(--ember)' }}>
                <p.icon size={28} />
              </div>
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" style={{ maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>How we compare</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Feature</th>
                <th style={{ textAlign: 'center' }}>{BRAND.name}</th>
                <th style={{ textAlign: 'center' }}>Typical platforms</th>
              </tr>
            </thead>
            <tbody>
              {comparison.map((row, i) => (
                <tr key={i}>
                  <td>{row.feature}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink)' }}>{row.digitalsale}</td>
                  <td style={{ textAlign: 'center', color: 'var(--muted)' }}>{row.others}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="fineprint" style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          Comparison based on major digital product platforms as of 2024. Your experience may vary.
        </p>
      </section>

      <section className="section" style={{ maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
        <div className="cta-panel" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-7) var(--space-6)' }}>
          <h2 style={{ color: 'var(--paper)' }}>Ready to sell?</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 'var(--space-5)' }}>
            Open your store in two minutes. Verified by Telegram, paid in ${BRAND.payoutAsset}.
          </p>
          <Link href="/auth?mode=signup" className="btn" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--paper)' }}>
            Create your account
          </Link>
        </div>
      </section>

      <footer style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--line-soft)', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
        <p>Questions? <Link href="/how-it-works">How it works</Link> · <Link href="/terms">Terms</Link> · <Link href="/market">Browse the market</Link></p>
      </footer>
    </div>
  );
}