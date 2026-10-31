'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { haptic } from '../lib/telegram-client';

/** Heart button: toggle a product on the buyer's wishlist. */
export default function WishlistButton({
  productId,
  initial = false,
  size = 34,
}: {
  productId: string;
  initial?: boolean;
  size?: number;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/wishlist/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (res.status === 401) {
        router.push('/auth');
        return;
      }
      const data = (await res.json()) as { wishlisted?: boolean };
      if (typeof data.wishlisted === 'boolean') {
        setOn(data.wishlisted);
        haptic(data.wishlisted ? 'success' : 'tap');
      }
    } catch {
      /* best effort */
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-label={on ? 'Remove from wishlist' : 'Save to wishlist'}
      title={on ? 'Remove from wishlist' : 'Save to wishlist'}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid var(--line)',
        background: on ? 'var(--ember)' : 'var(--card)',
        color: on ? '#fff' : 'var(--ink)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flex: 'none',
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
