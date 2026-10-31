import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import Reveal, { RevealGroup, RevealItem } from '../../components/Reveal';
import { Stamp, Squiggle, IconUsers } from '../../components/doodles';

const STEPS = [
  {
    num: '01',
    title: 'Join free',
    body: 'Anyone with a verified account can join — no application, no approval wait, no follower minimum.',
  },
  {
    num: '02',
    title: 'Grab your link',
    body: 'Pick any product with affiliates enabled. Your dashboard hands you a ?ref=CODE link, swipe copy and a share card.',
  },
  {
    num: '03',
    title: 'Earn per sale',
    body: 'Clicks are tracked for 30 days. When someone buys through your link you earn the seller-set commission — 5% to 60% of the sale — paid in USDT.',
  },
];

export default function AffiliatesPage() {
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Affiliate program</span>
            <h1>
              Recommend great work.{' '}
              <span className="squiggle-wrap">
                Get paid for it
                <Squiggle />
              </span>
              .
            </h1>
            <p className="lede">
              Share products you love with your own referral link and earn up to 60% of every sale
              you drive — tracked for 30 days, paid out in {BRAND.payoutAsset}.
            </p>
            <div className="hero-ctas">
              <Link href="/dashboard/affiliate" className="btn btn-primary btn-lg">
                Open affiliate dashboard
              </Link>
              <Link href="/market" className="btn btn-outline-light btn-lg">
                Find products to promote
              </Link>
            </div>
            <div style={{ marginTop: 28 }}>
              <Stamp tone="ember">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconUsers size={14} />
                  Anyone can join
                </span>
              </Stamp>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="section-tight">
        <div className="wrap">
          <RevealGroup className="steps">
            {STEPS.map((s) => (
              <RevealItem key={s.num}>
                <div className="step">
                  <div className="num">{s.num}</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      </section>
      <section className="section-tight" style={{ background: 'var(--paper-2)', borderTop: '2px solid var(--ink)', borderBottom: '2px solid var(--ink)' }}>
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">The math, in the open</span>
            <h2>Exactly who gets what</h2>
            <div className="table-wrap" style={{ marginTop: 24, maxWidth: 720 }}>
              <table className="fee-table">
                <thead>
                  <tr>
                    <th>$100 sale, 20% affiliate</th>
                    <th className="strong">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{BRAND.name} platform fee ({BRAND.feePercent}%)</td>
                    <td className="strong">$10.00</td>
                  </tr>
                  <tr className="us">
                    <td>You, the affiliate (20%)</td>
                    <td className="strong">$20.00</td>
                  </tr>
                  <tr>
                    <td>The seller keeps</td>
                    <td className="strong">$70.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p style={{ marginTop: 16, maxWidth: 640, color: 'var(--sage)' }}>
              The seller sets the commission per product (5–60%) and can turn affiliates on or off
              any time. The platform fee is always a flat {BRAND.feePercent}% — the affiliate cut
              comes out of the seller&apos;s share, never yours on top.
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
                  Your link is <em>two clicks away.</em>
                </h2>
                <p>Join the program, pick a product, and start sharing — payouts land in USDT.</p>
              </div>
              <Link href="/dashboard/affiliate" className="btn btn-primary btn-lg">
                Get my referral link
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
