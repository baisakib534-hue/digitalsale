'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

type Product = {
  id: string;
  title: string;
  description: string;
  price_usd: number;
  seller_email: string;
};

export default function MarketPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/products')
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => setError('Could not load products.'))
      .finally(() => setLoading(false));
  }, []);

  async function buy(p: Product) {
    const email = prompt('Where should we send your download link? (email)');
    if (!email) return;
    setBuying(p.id);
    setError('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: p.id, buyerEmail: email }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Checkout failed.');
      } else {
        window.location.href = data.invoiceUrl;
      }
    } catch {
      setError('Network error.');
    } finally {
      setBuying(null);
    }
  }

  return (
    <div className="container">
      <div className="topbar">
        <Link href="/" className="logo">Sell<span>Bridge</span></Link>
        <nav className="nav">
          <Link href="/market">Market</Link>
          <Link href="/sell">Sell</Link>
        </nav>
      </div>

      <h1 style={{ margin: '24px 0' }}>Market</h1>

      {loading && <p style={{ color: 'var(--muted)' }}>Loading…</p>}
      {error && <p className="err">{error}</p>}
      {!loading && products.length === 0 && !error && (
        <div className="empty">
          <p>No products yet — be the first seller. 🚀</p>
          <div style={{ marginTop: 16 }}><Link href="/sell" className="btn">List a product</Link></div>
        </div>
      )}

      <div className="grid">
        {products.map((p) => (
          <div key={p.id} className="product">
            <h3>{p.title}</h3>
            <p>{p.description}</p>
            <div className="seller">by {p.seller_email}</div>
            <div className="price">${Number(p.price_usd).toFixed(2)}</div>
            <button className="btn" disabled={buying === p.id} onClick={() => buy(p)}>
              {buying === p.id ? 'Creating checkout…' : 'Buy now'}
            </button>
          </div>
        ))}
      </div>

      <footer style={{ marginTop: 60 }}>Pay with 300+ cryptos · instant delivery ·</footer>
    </div>
  );
}
