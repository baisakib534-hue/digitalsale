import Link from 'next/link';

/** Dark-themed 404 — matches the Night Market identity (no white flash). */
export default function NotFound() {
  return (
    <div className="wrap" style={{ paddingTop: 110, paddingBottom: 110, textAlign: 'center' }}>
      <p className="eyebrow" style={{ justifyContent: 'center' }}>
        404 — lost in the market
      </p>
      <h1>
        This stall <span className="glow">doesn&apos;t exist</span>.
      </h1>
      <p className="lede" style={{ margin: '0 auto 36px', textAlign: 'center' }}>
        The page you&apos;re looking for moved, sold out, or never opened. The market is still
        full of good things.
      </p>
      <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href="/market" className="btn btn-primary">
          Browse the market
        </Link>
        <Link href="/" className="btn btn-outline">
          Back home
        </Link>
      </div>
    </div>
  );
}
