'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatUsd } from '../lib/format';
import { haptic } from '../lib/telegram-client';
import { BRAND } from '../lib/brand';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sticky buy panel on the product page: email capture → create pending order → checkout. */
export default function BuyPanel({ productId, priceCents }: { productId: string; priceCents: number }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prefill the buyer's email when they're logged in.
  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.user?.email) setEmail(j.user.email);
      })
      .catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setError('Enter a valid email address — your download links go there.');
      return;
    }
    setBusy(true);
    haptic('tap');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, email: trimmed }),
      });
      const data = (await res.json()) as { orderId?: string; error?: string };
      if (!res.ok || !data.orderId) {
        setError(data.error || 'Could not start checkout. Please try again.');
        haptic('error');
        return;
      }
      haptic('success');
      router.push(`/checkout/${data.orderId}`);
    } catch {
      setError('Network error. Check your connection and try again.');
      haptic('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label htmlFor="buy-email">Email for delivery</label>
        <input
          id="buy-email"
          className="input"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy}>
        {busy ? 'Reserving your order…' : `Buy now — ${formatUsd(priceCents)}`}
      </button>
      <p className="form-note" style={{ marginTop: 16 }}>
        Seller keeps 90% — {BRAND.name} takes a flat {BRAND.feePercent}% fee. Paid in crypto via
        NOWPayments; download links arrive instantly after payment.
      </p>
    </form>
  );
}
