'use client';

import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import { IconBox, IconBolt, IconShield, IconSend, IconUsers, IconCoin } from '../../components/doodles';

const steps = [
  {
    title: 'Get verified',
    body: 'Sign up with Gmail, connect Telegram. One tap — cryptographic proof, no passwords shared.',
  },
  {
    title: 'Create your store',
    body: 'Add a name, bio, and avatar. Your storefront is live at digitalsale.app/@yourname instantly.',
  },
  {
    title: 'Add products',
    body: 'Upload files (up to 2 GB each), set prices, add cover images and video previews. Stock limits optional.',
  },
  {
    title: 'Share your link',
    body: 'Post your store link anywhere. Buyers open it in Telegram or browser — no app install needed.',
  },
  {
    title: 'Get paid instantly',
    body: `Buyer pays → you receive ${BRAND.payoutAsset} in your wallet. No hold, no minimum, no borders.`,
  },
];

const features = [
  { icon: IconBox, title: 'Digital delivery handled', body: 'Files on our CDN, instant downloads, access links that expire. You never manage storage.' },
  { icon: IconBolt, title: 'Telegram-native', body: 'Your store works inside the Telegram Mini App. Buyers browse and buy without leaving chat.' },
  { icon: IconShield, title: 'Verified sellers only', body: 'Every account tied to a real Telegram identity. No fake stores, no impersonation.' },
  { icon: IconSend, title: 'Global payouts', body: `${BRAND.payoutAsset} to any wallet, anywhere. No banking rails, no country restrictions.` },
  { icon: IconUsers, title: 'Built-in affiliates', body: 'Anyone can promote your products. You set the commission, we handle tracking and payouts.' },
  { icon: IconCoin, title: 'Simple, transparent fees', body: `${BRAND.feePercent}% + $0.30 per sale. That's it. No tiers, no monthly fees, no surprises.` },
];

export default function HowItWorksPage() {
  return (
    <div className="wrap" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
      <header style={{ marginBottom: 'var(--space-8)', maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
        <span className="eyebrow" style={{ marginLeft: 'auto', marginRight: 'auto' }}>How it works</span>
        <h1>From idea to income in five steps</h1>
        <p className="lede">No store builders, no payment gateways, no paperwork. Just your work, verified, paid.</p>
      </header>

      <section className="section" style={{ maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
        <div className="steps">
          {steps.map((s, i) => (
            <div key={i} className="step">
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: 'var(--space-2)' }}>{s.title}</h3>
                <p style={{ color: 'var(--body)', margin: 0 }}>{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
        <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>What makes it different</h2>
        <div className="perk-grid">
          {features.map((f, i) => (
            <article key={i} className="perk">
              <div style={{ display: 'inline-flex', marginBottom: 'var(--space-3)', color: 'var(--ember)' }}>
                <f.icon size={28} />
              </div>
              <h3>{f.title}</h3>
              <p>{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" style={{ maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
        <div className="cta-panel" style={{ borderRadius: 'var(--radius-lg)', padding: 'var(--space-7) var(--space-6)' }}>
          <h2 style={{ color: 'var(--paper)' }}>Start selling today</h2>
          <p style={{ color: 'rgba(255,255,255,0.75)', marginBottom: 'var(--space-5)' }}>
            Two minutes to your first storefront. Verified by Telegram, paid in ${BRAND.payoutAsset}.
          </p>
          <Link href="/auth?mode=signup" className="btn" style={{ background: 'var(--paper)', color: 'var(--ink)', borderColor: 'var(--paper)' }}>
            Create your account
          </Link>
        </div>
      </section>

      <footer style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--line-soft)', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
        <p><Link href="/fees">Fees</Link> · <Link href="/terms">Terms</Link> · <Link href="/market">Browse the market</Link></p>
      </footer>
    </div>
  );
}