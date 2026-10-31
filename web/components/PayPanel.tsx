'use client';

import { useEffect, useRef, useState } from 'react';
import { formatUsd } from '../lib/format';
import { getWebApp, haptic, inTelegram } from '../lib/telegram-client';

/** Checkout pay panel: creates a NOWPayments invoice and hands off to it. */
export default function PayPanel({ orderId, amountCents }: { orderId: string; amountCents: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notConfigured, setNotConfigured] = useState(false);
  const busyRef = useRef(false);

  async function pay() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    haptic('tap');
    try {
      const res = await fetch('/api/checkout/pay', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const data = (await res.json()) as { invoiceUrl?: string; error?: string };
      if (res.status === 409 || data.error === 'payments-not-configured') {
        setNotConfigured(true);
        haptic('error');
        return;
      }
      if (!res.ok || !data.invoiceUrl) {
        setError('Could not create the payment invoice. Please try again in a moment.');
        haptic('error');
        return;
      }
      haptic('success');
      window.location.href = data.invoiceUrl;
    } catch {
      setError('Network error. Check your connection and try again.');
      haptic('error');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // Telegram MainButton mirrors the pay action inside the Mini App.
  useEffect(() => {
    if (!inTelegram()) return;
    const wa = getWebApp();
    if (!wa) return;
    const onClick = () => void pay();
    try {
      wa.MainButton.setText(`Pay ${formatUsd(amountCents)}`);
      wa.MainButton.show();
      wa.MainButton.onClick(onClick);
    } catch {
      /* best effort */
    }
    return () => {
      try {
        wa.MainButton.offClick(onClick);
        wa.MainButton.hide();
      } catch {
        /* noop */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  if (notConfigured) {
    return (
      <div className="alert alert-warn" role="alert">
        <strong>Payments aren&apos;t connected for this order.</strong>
        <p style={{ margin: '8px 0 0' }}>
          The seller hasn&apos;t connected NOWPayments on this deployment yet, so no invoice can be
          created. Your order is reserved as pending and <strong>no charge was made</strong>. Try
          again later, or contact the seller directly.
        </p>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}
      <button type="button" className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={() => void pay()} disabled={busy}>
        {busy ? 'Creating your invoice…' : `Pay ${formatUsd(amountCents)} with crypto`}
      </button>
      <p className="form-note" style={{ marginTop: 16 }}>
        You&apos;ll be taken to a secure NOWPayments invoice where you can pay with BTC, ETH, USDT
        and 200+ other cryptocurrencies. Download links unlock automatically once the payment
        confirms.
      </p>
    </div>
  );
}
