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
  // v11: discount code.
  const [code, setCode] = useState('');
  const [codeState, setCodeState] = useState<'idle' | 'checking' | 'applied' | 'error'>('idle');
  const [codeMsg, setCodeMsg] = useState('');
  const [finalPrice, setFinalPrice] = useState<number | null>(null);

  // Prefill the buyer's email when they're logged in.
  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.user?.email) setEmail(j.user.email);
      })
      .catch(() => {});
  }, []);

  async function applyCode() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setCodeState('checking');
    setCodeMsg('');
    try {
      const res = await fetch('/api/discounts/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId, code: trimmed }),
      });
      const data = (await res.json()) as {
        valid?: boolean;
        reason?: string;
        finalPriceCents?: number;
        discountCents?: number;
        code?: string;
      };
      if (data.valid && typeof data.finalPriceCents === 'number') {
        setCodeState('applied');
        setFinalPrice(data.finalPriceCents);
        setCodeMsg(`Code applied — you save ${formatUsd(data.discountCents ?? 0)}.`);
        haptic('success');
      } else {
        setCodeState('error');
        setFinalPrice(null);
        const why: Record<string, string> = {
          'invalid-code': 'That code format looks wrong.',
          'not-found': 'Code not found for this product.',
          inactive: 'This code is no longer active.',
          expired: 'This code has expired.',
          exhausted: 'This code has been used up.',
        };
        setCodeMsg(why[data.reason ?? ''] ?? 'Code not valid.');
        haptic('error');
      }
    } catch {
      setCodeState('error');
      setCodeMsg('Could not check the code. Try again.');
    }
  }

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
        body: JSON.stringify({
          productId,
          email: trimmed,
          ...(codeState === 'applied' && code.trim() ? { discountCode: code.trim() } : {}),
        }),
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
      <div className="field" style={{ marginTop: 4 }}>
        <label htmlFor="buy-discount">Discount code <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(optional)</span></label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            id="buy-discount"
            className="input"
            placeholder="SAVE20"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              if (codeState !== 'idle') {
                setCodeState('idle');
                setCodeMsg('');
                setFinalPrice(null);
              }
            }}
            disabled={busy || codeState === 'checking'}
            style={{ textTransform: 'uppercase' }}
          />
          <button
            type="button"
            className="btn btn-outline"
            onClick={applyCode}
            disabled={busy || codeState === 'checking' || code.trim() === ''}
            style={{ flex: 'none' }}
          >
            {codeState === 'checking' ? 'Checking…' : 'Apply'}
          </button>
        </div>
        {codeMsg && (
          <p className={codeState === 'applied' ? 'form-note' : 'form-error'} style={{ margin: '8px 0 0' }}>
            {codeMsg}
          </p>
        )}
      </div>
      <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={busy}>
        {busy ? 'Reserving your order…' : (
          codeState === 'applied' && finalPrice !== null ? (
            <>Buy now — <s style={{ opacity: 0.65, fontWeight: 400 }}>{formatUsd(priceCents)}</s> {formatUsd(finalPrice)}</>
          ) : (
            `Buy now — ${formatUsd(priceCents)}`
          )
        )}
      </button>
      <p className="form-note" style={{ marginTop: 16 }}>
        Seller keeps 90% — {BRAND.name} takes a flat {BRAND.feePercent}% fee. Paid in crypto via
        NOWPayments; download links arrive instantly after payment.
      </p>
    </form>
  );
}
