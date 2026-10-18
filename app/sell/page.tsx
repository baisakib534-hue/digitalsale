'use client';

import { useState } from 'react';
import Link from 'next/link';

type Summary = {
  products: number;
  sales: number;
  revenue: number;
  balance: number;
  items: { id: string; title: string; price_usd: number }[];
};

export default function SellPage() {
  const [email, setEmail] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [form, setForm] = useState({ usdt: '', title: '', description: '', price: '', fileUrl: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(e: string) {
    const res = await fetch(`/api/seller/summary?email=${encodeURIComponent(e)}`);
    const data = await res.json();
    if (res.ok) setSummary(data);
  }

  function enter() {
    if (!email.includes('@')) { setErr('Enter a valid email.'); return; }
    setErr('');
    setUnlocked(true);
    load(email);
  }

  async function publish() {
    setErr(''); setMsg('');
    if (!form.title.trim() || !form.price || !form.fileUrl.trim()) {
      setErr('Title, price and file URL are required.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          usdtAddress: form.usdt.trim(),
          title: form.title.trim(),
          description: form.description.trim(),
          priceUsd: Number(form.price),
          fileUrl: form.fileUrl.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || 'Failed to publish.'); return; }
      setMsg('Product published! 🎉');
      setForm({ ...form, title: '', description: '', price: '', fileUrl: '' });
      load(email);
    } catch {
      setErr('Network error.');
    } finally {
      setBusy(false);
    }
  }

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className="container">
      <div className="topbar">
        <Link href="/" className="logo">Sell<span>Bridge</span></Link>
        <nav className="nav">
          <Link href="/market">Market</Link>
          <Link href="/sell">Sell</Link>
        </nav>
      </div>

      <h1 style={{ margin: '24px 0' }}>Seller dashboard</h1>

      {!unlocked ? (
        <div className="panel" style={{ maxWidth: 520 }}>
          <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
            No bank account needed — just an email and a USDT wallet address.
          </p>
          <label>Your email</label>
          <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="row"><button className="btn" onClick={enter}>Open dashboard</button></div>
          {err && <p className="err">{err}</p>}
        </div>
      ) : (
        <>
          {summary && (
            <div className="stats">
              <div className="stat"><div className="v">{summary.products}</div><div className="l">Products</div></div>
              <div className="stat"><div className="v">{summary.sales}</div><div className="l">Sales</div></div>
              <div className="stat"><div className="v">${summary.revenue.toFixed(2)}</div><div className="l">Revenue</div></div>
              <div className="stat"><div className="v">${summary.balance.toFixed(2)}</div><div className="l">USDT balance</div></div>
            </div>
          )}

          <div className="panel">
            <h2 style={{ marginBottom: 8 }}>List a new product</h2>
            <label>USDT wallet address (for payouts)</label>
            <input type="text" placeholder="T…" value={form.usdt} onChange={(e) => set('usdt', e.target.value)} />
            <label>Title</label>
            <input type="text" placeholder="e.g. 50 Instagram templates for boutiques" value={form.title} onChange={(e) => set('title', e.target.value)} />
            <label>Description</label>
            <textarea rows={3} placeholder="What does the buyer get?" value={form.description} onChange={(e) => set('description', e.target.value)} />
            <label>Price (USD)</label>
            <input type="number" min="1" step="0.01" placeholder="9.99" value={form.price} onChange={(e) => set('price', e.target.value)} />
            <label>File URL (Google Drive / Dropbox link to the digital file)</label>
            <input type="text" placeholder="https://…" value={form.fileUrl} onChange={(e) => set('fileUrl', e.target.value)} />
            <div className="row"><button className="btn" disabled={busy} onClick={publish}>{busy ? 'Publishing…' : 'Publish product'}</button></div>
            {err && <p className="err">{err}</p>}
            {msg && <p className="ok">{msg}</p>}
          </div>

          {summary && summary.items.length > 0 && (
            <div className="panel">
              <h2 style={{ marginBottom: 12 }}>Your products</h2>
              <table className="simple">
                <thead><tr><th>Title</th><th>Price</th></tr></thead>
                <tbody>
                  {summary.items.map((p) => (
                    <tr key={p.id}><td>{p.title}</td><td>${Number(p.price_usd).toFixed(2)}</td></tr>
                  ))}
                </tbody>
              </table>
              <p style={{ color: 'var(--muted)', fontSize: '.85rem', marginTop: 12 }}>
                Payouts: request a USDT withdrawal by emailing support with your wallet address (automated payouts coming soon).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
