'use client';

import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import { IconShield, IconBox, IconSend, IconCoin, IconUsers, IconBolt } from '../../components/doodles';

const sections = [
  {
    title: 'Acceptance of terms',
    body: `By creating an account or using ${BRAND.name}, you agree to these terms. If you don't agree, don't use the service.`,
  },
  {
    title: 'Eligibility',
    body: 'You must be 18+ and able to form a binding contract. One account per person. Accounts are verified via Telegram — no exceptions.',
  },
  {
    title: 'Your content',
    body: `You keep full ownership of everything you upload. You grant ${BRAND.name} a license to host, deliver, and display your files to buyers. You're responsible for ensuring you have the right to sell what you upload — no copyrighted material you don't own, no illegal content, no malware.`,
  },
  {
    title: 'Fees & payouts',
    body: `${BRAND.name} charges ${BRAND.feePercent}% + $0.30 per successful sale. The rest is sent instantly in ${BRAND.payoutAsset} to the wallet you provide. No minimums, no holds. Network fees (if any) are deducted from the payout.`,
  },
  {
    title: 'Refunds & disputes',
    body: 'Digital goods are non-refundable by default. If a buyer reports an issue (file missing, not as described), we mediate. Abuse from either side leads to account suspension.',
  },
  {
    title: 'Affiliate program',
    body: 'Sellers can enable affiliates. You set the commission % per product. Affiliates earn on verified sales. We track, report, and pay affiliates from the seller share — no extra cost to buyers.',
  },
  {
    title: 'Telegram integration',
    body: "Your store works as a Telegram Mini App. Telegram's terms also apply when using the Mini App. We don't control Telegram; if they change things, your web storefront stays live.",
  },
  {
    title: 'Termination',
    body: 'You can delete your account anytime. We can suspend or terminate for violations (fraud, illegal content, repeated disputes, ToS abuse). On termination, unpaid balances are paid out after a 30-day dispute window.',
  },
  {
    title: 'Disclaimers',
    body: `THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. ${BRAND.name} IS NOT LIABLE FOR INDIRECT, INCIDENTAL, OR CONSEQUENTIAL DAMAGES. MAXIMUM LIABILITY LIMITED TO FEES PAID IN THE PRIOR 12 MONTHS.`,
  },
  {
    title: 'Changes',
    body: 'We may update these terms. Material changes get 30 days notice via email and in-app banner. Continued use = acceptance.',
  },
  {
    title: 'Contact',
    body: `Questions about these terms? Email legal@${BRAND.name.toLowerCase().replace(/\s+/g, '')}.app or open a support ticket from your dashboard.`,
  },
];

export default function TermsPage() {
  return (
    <div className="wrap" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
      <header style={{ marginBottom: 'var(--space-8)', maxWidth: 800, marginLeft: 'auto', marginRight: 'auto', textAlign: 'center' }}>
        <span className="eyebrow" style={{ marginLeft: 'auto', marginRight: 'auto' }}>Terms of service</span>
        <h1>Plain terms for a fair marketplace</h1>
        <p className="lede" style={{ color: 'var(--muted)' }}>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
      </header>

      <main style={{ maxWidth: 800, marginLeft: 'auto', marginRight: 'auto' }}>
        {sections.map((s, i) => (
          <section key={i} style={{ marginBottom: 'var(--space-7)', paddingBottom: 'var(--space-6)', borderBottom: i < sections.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
            <h2 style={{ marginBottom: 'var(--space-3)' }}>{s.title}</h2>
            <p style={{ color: 'var(--body)', lineHeight: 1.7 }}>{s.body}</p>
          </section>
        ))}
      </main>

      <footer style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--line-soft)', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
        <p><Link href="/fees">Fees</Link> · <Link href="/how-it-works">How it works</Link> · <Link href="/market">Browse the market</Link></p>
      </footer>
    </div>
  );
}