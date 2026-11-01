'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { applyTelegramTheme, getWebApp, inTelegram } from '../lib/telegram-client';

/**
 * Telegram Mini App wiring + graceful fallback.
 * - ready() + expand() on mount
 * - theme params → CSS vars
 * - BackButton on every sub-page (history.back)
 * - closing confirmation while on checkout
 */
export default function TelegramInit() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const wa = getWebApp();
    if (!wa) return;
    try {
      wa.ready();
      wa.expand();
      applyTelegramTheme(wa.themeParams || {});
      // Deep link: t.me/<bot>?startapp=product_<id> → land on the product's buy page.
      const sp = wa.initDataUnsafe?.start_param;
      const m = typeof sp === 'string' ? /^product_([A-Za-z0-9_-]+)$/.exec(sp) : null;
      if (m) router.replace(`/product/${m[1]}`);
    } catch {
      /* best effort */
    }
  }, [router]);

  useEffect(() => {
    const wa = getWebApp();
    if (!wa || !inTelegram()) return;
    const onBack = () => router.back();
    try {
      if (pathname === '/') wa.BackButton.hide();
      else {
        wa.BackButton.show();
        wa.BackButton.onClick(onBack);
      }
      if (pathname.startsWith('/checkout')) wa.enableClosingConfirmation();
      else wa.disableClosingConfirmation();
    } catch {
      /* best effort */
    }
    return () => {
      try {
        wa.BackButton.offClick(onBack);
      } catch {
        /* noop */
      }
    };
  }, [pathname, router]);

  return null;
}
