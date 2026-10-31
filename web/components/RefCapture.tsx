'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Captures ?ref=CODE visits: POSTs to /api/affiliate/click, which validates
 * the code, records a deduped click and sets the 30-day httpOnly ref cookie.
 * Mount on product, landing and market pages (productId null for storefront).
 */
function RefCaptureInner({ productId }: { productId: string | null }) {
  const params = useSearchParams();
  const fired = useRef(false);

  useEffect(() => {
    const code = params.get('ref');
    if (!code || fired.current) return;
    fired.current = true;
    fetch('/api/affiliate/click', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: code.trim(), productId }),
    }).catch(() => {});
  }, [params, productId]);

  return null;
}

export default function RefCapture({ productId }: { productId: string | null }) {
  return (
    <Suspense fallback={null}>
      <RefCaptureInner productId={productId} />
    </Suspense>
  );
}
