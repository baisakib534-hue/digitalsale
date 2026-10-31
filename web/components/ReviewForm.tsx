'use client';

import { useState } from 'react';
import { haptic } from '../lib/telegram-client';

/** Inline review form on the purchases page: one review per paid order. */
export default function ReviewForm({
  productId,
  orderId,
  productTitle,
}: {
  productId: string;
  orderId: string;
  productTitle: string;
}) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/products/${productId}/reviews`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ orderId, rating, body: body.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        const why: Record<string, string> = {
          'already-reviewed': 'You already reviewed this purchase.',
          'not-paid': 'Only paid orders can be reviewed.',
          'not-buyer': 'Only the buyer can review this order.',
        };
        setError(why[data.error ?? ''] ?? 'Could not submit your review.');
        haptic('error');
        return;
      }
      setDone(true);
      haptic('success');
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p style={{ margin: '12px 0 0', fontSize: 13.5, color: 'var(--mint-ink, #15803d)', fontWeight: 600 }}>
        ★ Thanks — your review is live.
      </p>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-outline btn-sm" style={{ marginTop: 12 }} onClick={() => setOpen(true)}>
        ★ Write a review
      </button>
    );
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 12, padding: 14, border: '1px solid var(--line)', borderRadius: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>Review “{productTitle}”</div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10 }} role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
            onClick={() => setRating(n)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: 26,
              color: n <= rating ? 'var(--gold, #d97706)' : 'var(--line)',
              padding: 2,
            }}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        className="input"
        rows={3}
        maxLength={1000}
        placeholder="What did you think? (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={busy}
        style={{ resize: 'vertical' }}
      />
      {error && <div className="form-error" role="alert" style={{ marginTop: 8 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button type="submit" className="btn btn-dark btn-sm" disabled={busy}>
          {busy ? 'Posting…' : 'Post review'}
        </button>
        <button type="button" className="btn btn-outline btn-sm" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
