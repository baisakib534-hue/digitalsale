import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import { formatUsd } from '../../lib/format';
import Accordion from '../../components/Accordion';
import Reveal from '../../components/Reveal';
import { Squiggle } from '../../components/doodles';

const FAQ = [
  {
    title: 'Why a flat 10%?',
    body: (
      <p>
        Because tiers are a dark pattern. One fee, stated on every page, means you always know
        exactly what a sale earns you. The {BRAND.feePercent}% goes straight into keeping{' '}
        {BRAND.name} running — hosting, the Telegram bot, and the payout rails. There are no
        investors to feed and no plans to upsell you. When you earn, we earn; that&apos;s the whole
        business model.
      </p>
    ),
  },
  {
    title: 'When and how do I get paid?',
    body: (
      <p>
        Buyers pay with crypto through NOWPayments. Your {100 - BRAND.feePercent}% share goes to
        the USDT wallet address on your store settings — from anywhere in the world, with no
        minimum payout and no bank account required. Double-check that address; crypto payouts
        can&apos;t be reversed.
      </p>
    ),
  },
  {
    title: 'Are there processing fees on top of the 10%?',
    body: (
      <p>
        The {BRAND.feePercent}% is the only cut {BRAND.name} takes. Blockchain network fees are
        between the buyer, the network, and the payment processor — we don&apos;t add anything on
        top.
      </p>
    ),
  },
  {
    title: 'Do affiliates cost me extra?',
    body: (
      <p>
        No. The affiliate commission (5–60%, you set it per product) comes out of your{' '}
        {100 - BRAND.feePercent}% share — never added on top of the sale price. Turn affiliates on
        or off for any product, any time.
      </p>
    ),
  },
];

export default function FeesPage() {
  const sale = 2500; // $25.00 example sale, in cents
  const ours = Math.round((sale * BRAND.feePercent) / 100);
  const gumroad = Math.round((sale * 10) / 100);

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">Fees, in the open</span>
            <h1>
              One flat fee.{' '}
              <span className="squiggle-wrap">
                Nothing else
                <Squiggle />
              </span>
              .
            </h1>
            <p className="lede">
              No monthly plans, no payment-processing surcharge, no payout minimum. Here&apos;s what
              a typical {formatUsd(sale)} sale looks like on {BRAND.name} versus the old guard.
            </p>
          </Reveal>
        </div>
      </section>
      <section className="section-tight">
        <div className="wrap">
          <Reveal>
            <div className="table-wrap" style={{ maxWidth: 880 }}>
              <table className="fee-table">
                <thead>
                  <tr>
                    <th> </th>
                    <th className="strong">{BRAND.name}</th>
                    <th>Gumroad</th>
                    <th>Etsy*</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Platform fee</td>
                    <td className="strong">{BRAND.feePercent}%</td>
                    <td>10%</td>
                    <td>6.5% + $0.20</td>
                  </tr>
                  <tr className="us">
                    <td>You keep on a {formatUsd(sale)} sale</td>
                    <td className="strong">{formatUsd(sale - ours)}</td>
                    <td>{formatUsd(sale - gumroad)}</td>
                    <td>≈{formatUsd(sale - Math.round(sale * 0.065) - 20)}</td>
                  </tr>
                  <tr>
                    <td>Payout asset</td>
                    <td className="strong">{BRAND.payoutAsset}</td>
                    <td>PayPal / bank</td>
                    <td>Bank deposit</td>
                  </tr>
                  <tr>
                    <td>Who can get paid</td>
                    <td className="strong">Anywhere in the world</td>
                    <td>~40 supported countries</td>
                    <td>~30 supported countries</td>
                  </tr>
                  <tr>
                    <td>Affiliate cut</td>
                    <td className="strong">You set it (5–60%)</td>
                    <td>You set it</td>
                    <td>—</td>
                  </tr>
                </tbody>
              </table>
              <p className="fineprint">*Etsy figures are approximate and for digital-goods comparison only.</p>
            </div>
          </Reveal>
          <Reveal delay={0.08}>
            <div className="panel" style={{ marginTop: 40, maxWidth: 880 }}>
              <h3 style={{ marginTop: 0 }}>Where the {BRAND.feePercent}% goes</h3>
              <p style={{ marginBottom: 0 }}>
                Straight into keeping {BRAND.name} running — hosting, the Telegram bot, and the
                payout rails. There are no investors to feed and no tiers to upsell you. When you
                earn, we earn; that&apos;s the whole business model.
              </p>
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <div style={{ marginTop: 40, maxWidth: 880 }}>
              <span className="eyebrow">Fair questions</span>
              <h2 style={{ marginBottom: 24 }}>Asked, answered</h2>
              <Accordion items={FAQ} defaultOpen={0} />
            </div>
          </Reveal>
          <div style={{ marginTop: 40 }}>
            <Link href="/sell" className="btn btn-primary btn-lg">
              Start selling — keep {100 - BRAND.feePercent}%
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
