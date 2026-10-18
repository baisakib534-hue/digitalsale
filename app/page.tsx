import Link from 'next/link';

export default function Home() {
  return (
    <>
      <div className="container topbar">
        <Link href="/" className="logo">Sell<span>Bridge</span></Link>
        <nav className="nav">
          <Link href="/market">Market</Link>
          <Link href="/sell">Sell</Link>
        </nav>
      </div>

      <header className="hero">
        <h1>
          Sell digital products from <span className="grad">any country</span>.
          <br />Get paid in USDT.
        </h1>
        <p className="sub">
          Gumroad and Etsy block sellers from dozens of countries because their banks
          can&apos;t pay you. SellBridge pays out in USDT — no bank account needed,
          no country bans. 5% fee, not 10%.
        </p>
        <Link href="/sell" className="btn">Start selling — it&apos;s free</Link>
        <span style={{ margin: '0 8px' }} />
        <Link href="/market" className="btn-ghost">Browse the market</Link>
      </header>

      <section className="section container">
        <h2>Why sellers are switching</h2>
        <table className="compare">
          <thead>
            <tr><th></th><th>Gumroad</th><th>Etsy</th><th>SellBridge</th></tr>
          </thead>
          <tbody>
            <tr><td>Sell from Bangladesh, Nigeria, Pakistan…</td><td className="no">Limited</td><td className="no">No</td><td className="yes">Yes ✓</td></tr>
            <tr><td>Payout without a bank account</td><td className="no">No</td><td className="no">No</td><td className="yes">Yes — USDT ✓</td></tr>
            <tr><td>Platform fee</td><td>10%</td><td>~15–28%</td><td className="yes">5% ✓</td></tr>
            <tr><td>Crypto checkout for buyers</td><td className="no">No</td><td className="no">No</td><td className="yes">Yes ✓</td></tr>
          </tbody>
        </table>
      </section>

      <section className="section container">
        <h2>How it works</h2>
        <div className="steps">
          <div className="step">
            <div className="n">1</div>
            <h3>List your product</h3>
            <p>Upload your ebook, template, preset or guide. Add your USDT wallet address — that&apos;s your &quot;bank account&quot;.</p>
          </div>
          <div className="step">
            <div className="n">2</div>
            <h3>Buyers pay in crypto</h3>
            <p>Checkout accepts 300+ cryptocurrencies, auto-settled in USDT. No cards, no borders.</p>
          </div>
          <div className="step">
            <div className="n">3</div>
            <h3>Withdraw anytime</h3>
            <p>Your earnings land as USDT. Withdraw to your wallet whenever you want — 0% payout fee.</p>
          </div>
        </div>
      </section>

      <section className="section container">
        <h2>Built for the rest of the world</h2>
        <div className="cards">
          <div className="card">
            <h3>🌍 No country bans</h3>
            <p>If you can receive USDT, you can sell. Sanctioned regions excluded by law — everyone else welcome.</p>
          </div>
          <div className="card">
            <h3>💸 5% flat fee</h3>
            <p>Half of Gumroad&apos;s cut. No listing fees, no monthly plans, no hidden charges.</p>
          </div>
          <div className="card">
            <h3>⚡ Instant digital delivery</h3>
            <p>Buyers get their download link the second payment confirms. You never touch fulfillment.</p>
          </div>
        </div>
      </section>

      <footer>SellBridge — the borderless creator marketplace. 🌉</footer>
    </>
  );
}
