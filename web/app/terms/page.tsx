import type { Metadata } from 'next';
import Link from 'next/link';
import { BRAND } from '../../lib/brand';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The rules of the Digitalsale marketplace: legal goods only, seller responsibility, and platform liability limits.',
};

/**
 * v13.2: Terms of Service — legal-only marketplace, permanent bans for
 * illegal listings, and platform liability limits.
 */
export default function TermsPage() {
  return (
    <div className="wrap" style={{ paddingTop: 56, paddingBottom: 88, maxWidth: 780 }}>
      <span className="eyebrow">The fine print</span>
      <h1 style={{ marginTop: 12 }}>Terms of Service</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>Last updated: November 2026</p>

      <div className="panel" style={{ marginTop: 24 }}>
        <h2 style={{ marginTop: 0 }}>1. What {BRAND.name} is</h2>
        <p>
          {BRAND.name} is a <strong>marketplace</strong>: it connects independent sellers with
          buyers of digital goods. We provide the storefront, the checkout, and the delivery
          rails — but every product is created, listed, priced, and delivered by its seller.
          A purchase is a transaction <strong>between buyer and seller</strong>; {BRAND.name}{' '}
          is the venue, not the vendor.
        </p>

        <h2>2. Legal goods only</h2>
        <p>
          Only <strong>legal</strong> digital goods may be listed. The following are prohibited,
          without exception:
        </p>
        <ul>
          <li>Anything illegal in the seller&apos;s or buyer&apos;s jurisdiction</li>
          <li>Stolen, pirated, or unlicensed content — including resold accounts, keys, and cracks</li>
          <li>Malware, spyware, phishing kits, or anything designed to harm devices or steal data</li>
          <li>Content that infringes copyrights, trademarks, or other intellectual property</li>
          <li>Fraudulent listings, fake reviews, or impersonation of another creator</li>
          <li>Personal data of third parties, or content obtained without consent</li>
        </ul>
        <p>
          <strong>Illegal listings mean a permanent ban.</strong> If a listing is confirmed to be
          illegal, the product is removed immediately and the seller&apos;s account is{' '}
          <strong>banned forever</strong> — no warnings, no second chances, no new accounts.
          Attempting to evade a ban extends it to every associated account.
        </p>

        <h2>3. Sellers are responsible for their listings</h2>
        <p>
          By listing a product you confirm that you have the legal right to sell it, that it is
          exactly what your listing describes, and that it complies with all applicable laws.
          You are solely responsible for the legality, quality, and accuracy of what you sell —
          including any license keys, files, and claims in your product pages.
        </p>

        <h2>4. Platform liability</h2>
        <p>
          To the maximum extent permitted by law, {BRAND.name} and its operator are{' '}
          <strong>not liable</strong> for:
        </p>
        <ul>
          <li>The content, legality, quality, or fitness of any product listed by a seller</li>
          <li>Disputes between buyers and sellers, including non-delivery or misrepresentation</li>
          <li>Losses arising from the use of purchased digital goods</li>
          <li>Interruptions, downtime, or data loss on the platform</li>
        </ul>
        <p>
          Products are provided <strong>&ldquo;as is&rdquo;</strong>. By using {BRAND.name} you
          agree to hold the platform harmless from any claim arising from a seller&apos;s
          listing or a buyer&apos;s purchase.
        </p>

        <h2>5. Payments</h2>
        <p>
          Checkout runs through our payment gateway in cryptocurrency ({BRAND.payoutAsset}).
          Because crypto payments cannot be reversed, <strong>all sales are final</strong> — we
          do not process refunds. If a product is not as described, report it: confirmed
          violations lead to product removal and, for illegal goods, a permanent seller ban.
        </p>

        <h2>6. Accounts &amp; verification</h2>
        <p>
          Selling, listing products, and joining the affiliate program require a{' '}
          <strong>Telegram-verified</strong> account — one real person per account. Fake,
          duplicate, or automated accounts may be suspended without notice.
        </p>

        <h2>7. Changes</h2>
        <p>
          We may update these terms as the marketplace grows. Continued use of {BRAND.name}{' '}
          after a change means you accept the new terms.
        </p>

        <p style={{ marginTop: 32 }}>
          <Link href="/market">← Back to the market</Link>
        </p>
      </div>
    </div>
  );
}
