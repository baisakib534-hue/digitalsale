'use client';

import { useEffect, useRef, useState } from 'react';
import { haptic } from '../lib/telegram-client';

/** Public bot username (also in lib/verify.ts BOT_USERNAME — kept as a literal here; verify.ts is server-only). */
const BOT_USERNAME = 'Digitalsale_bot';

/**
 * v13: "Continue with Telegram" via the official Telegram Login Widget.
 * Requires the site domain to be whitelisted in BotFather (/setdomain).
 * On success the widget calls window.onTelegramAuth(user) → we POST the
 * signed payload to /api/auth/telegram {widget} → server verifies the hash
 * with the bot token, finds or creates the account (Telegram-verified),
 * and sets the session cookie.
 */
declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

export default function TelegramLoginButton() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    window.onTelegramAuth = async (user: Record<string, unknown>) => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ widget: user }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError('Telegram sign-in failed — please try again.');
          haptic('error');
          return;
        }
        haptic('success');
        const next = new URLSearchParams(window.location.search).get('next') || '/dashboard';
        window.location.href = next;
      } catch {
        setError('Network error — please try again.');
      } finally {
        setBusy(false);
      }
    };

    const mount = mountRef.current;
    if (!mount) return;
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    mount.appendChild(script);
    return () => {
      mount.removeChild(script);
      delete window.onTelegramAuth;
    };
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0' }}>
        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>or</span>
        <span style={{ flex: 1, height: 1, background: 'var(--line)' }} />
      </div>
      <div ref={mountRef} style={{ display: 'flex', justifyContent: 'center', minHeight: 44, opacity: busy ? 0.6 : 1, pointerEvents: busy ? 'none' : 'auto' }} />
      {error && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{error}</div>}
      <p className="fineprint" style={{ textAlign: 'center', marginTop: 10 }}>
        One tap — no password. Your Telegram account is verified instantly.
      </p>
    </div>
  );
}
