import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import Accordion from '../../components/Accordion';
import Reveal from '../../components/Reveal';
import { Stamp, Squiggle } from '../../components/doodles';

const SELLER_STEPS = [
  {
    num: '01',
    title: 'Create your store',
    body: 'Sign up with Gmail, verify with Telegram, pick a store name and paste your USDT address. Your storefront is live in minutes — no review queue, no gatekeepers.',
  },
  {
    num: '02',
    title: 'List products',
    body: 'Upload your ebooks, presets, prompts, templates or bots. Files are scanned for safety, archived automatically, and every listing gets a shareable page with instant delivery.',
  },
  {
    num: '03',
    title: 'Get paid in USDT',
    body: `Buyers pay with crypto through NOWPayments. ${BRAND.name} keeps a flat ${BRAND.feePercent}% and your ${100 - BRAND.feePercent}% goes straight to your wallet — wherever in the world you are.`,
  },
];

const BUYER_STEPS = [
  {
    num: '01',
    title: 'Find something you love',
    body: 'Browse the market or follow an affiliate link. Every listing shows its store, its price in USD, and exactly what you get.',
  },
  {
    num: '02',
    title: 'Pay with crypto',
    body: 'Checkout creates a NOWPayments invoice. Pay with the crypto you hold — no account needed to buy as a guest.',
  },
  {
    num: '03',
    title: 'Download instantly',
    body: 'The moment payment confirms, your download link is ready in your purchases page. Re-download any time.',
  },
];

const AFFILIATE_STEPS = [
  {
    num: '01',
    title: 'Join free',
    body: 'Anyone with a verified account can join the affiliate program — no application, no approval wait.',
  },
  {
    num: '02',
    title: 'Share your link',
    body: 'Pick any product with affiliates enabled and share your ?ref=CODE link. Clicks are tracked for 30 days.',
  },
  {
    num: '03',
    title: 'Earn per sale',
    body: 'When someone buys through your link you earn the seller-set commission (5–60% of the sale), paid out in USDT.',
  },
];

function StepsBody({ steps }: { steps: typeof SELLER_STEPS }) {
  return (
    <div className="steps" style={{ marginTop: 8 }}>
      {steps.map((s) => (
        <div className="step" key={s.num}>
          <div className="num">{s.num}</div>
          <h3>{s.title}</h3>
          <p>{s.body}</p>
        </div>
      ))}
    </div>
  );
}

export default function HowItWorksPage() {
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <Reveal>
            <span className="eyebrow">How it works</span>
            <h1>
              From upload to payout,{' '}
              <span className="squiggle-wrap">
                in three steps
                <Squiggle />
              </span>
              .
            </h1>
            <p className="lede">
              {BRAND.name} is a borderless market for digital goods. Sellers keep{' '}
              {100 - BRAND.feePercent}% of every sale, buyers get instant downloads, and affiliates
              earn for spreading the word.
            </p>
            <div style={{ marginTop: 28 }}>
              <Stamp tone="ember">No gatekeepers</Stamp>
            </div>
          </Reveal>
        </div>
      </section>
      <section className="section-tight">
        <div className="wrap">
          <Reveal>
            <Accordion
              items={[
                { title: 'For sellers', body: <StepsBody steps={SELLER_STEPS} /> },
                { title: 'For buyers', body: <StepsBody steps={BUYER_STEPS} /> },
                { title: 'For affiliates', body: <StepsBody steps={AFFILIATE_STEPS} /> },
              ]}
            />
          </Reveal>
        </div>
      </section>
      <section className="section-tight">
        <div className="wrap">
          <Reveal>
            <div className="panel cta-panel">
              <div style={{ maxWidth: 560 }}>
                <h2>
                  Ready when <em>you are.</em>
                </h2>
                <p>Open a store, join as an affiliate, or just browse — it all starts here.</p>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <Link href="/sell" className="btn btn-primary btn-lg">
                  Start selling
                </Link>
                <Link href="/affiliates" className="btn btn-outline-light btn-lg">
                  Become an affiliate
                </Link>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
