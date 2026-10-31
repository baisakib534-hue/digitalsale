'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { BRAND } from '../../lib/brand';
import { Stamp, IconCheck } from '../../components/doodles';

type Phase = 'loading' | 'unverified' | 'verified' | 'error';

/**
 * Telegram verification (v3, mandatory before selling).
 * Web path: POST /api/auth/telegram/verify-token → deep link
 * t.me/Digitalsale_bot?start=v_<token> → tap it → bot verifies →
 * this page polls /api/auth/telegram/status until verified.
 * Mini App path: initData verifies instantly (handled by TelegramInit).
 */
export default function VerifyPage() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const checkStatus = useCallback(async (): Promise<boolean> => {
    try {
      const r = await fetch('/api/auth/telegram/status', { cache: 'no-store' });
      if (!r.ok) return false;
      const j = await r.json();
      return j.verified === true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (await checkStatus()) {
        if (!cancelled) setPhase('verified');
        return;
      }
      try {
        const r = await fetch('/api/auth/telegram/verify-token', { method: 'POST' });
        if (r.status === 401) {
          if (!cancelled) {
            setPhase('error');
            setError('You need to log in first.');
          }
          return;
        }
        if (!r.ok) throw new Error('token-failed');
        const j = await r.json();
        if (cancelled) return;
        setDeepLink(j.deepLink);
        setPhase('unverified');
        // Poll until the bot confirms the tap (15-min token, poll up to ~10 min).
        let tries = 0;
        pollRef.current = setInterval(async () => {
          tries += 1;
          if (tries > 120 || (await checkStatus())) {
            stopPolling();
            if (!cancelled && tries <= 120) setPhase('verified');
          }
        }, 5000);
      } catch {
        if (!cancelled) {
          setPhase('error');
          setError('Could not start verification. Please try again.');
        }
      }
    })();
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [checkStatus]);

  return (
    <section className="section">
      <div className="wrap" style={{ maxWidth: 640 }}>
        <span className="eyebrow">Account verification</span>
        <h1>Verify with Telegram</h1>
        {phase === 'loading' && <p className="lede">Checking your verification status…</p>}
        {phase === 'error' && (
          <div className="panel">
            <p style={{ margin: 0 }}>{error}</p>
            <Link href="/auth" className="btn btn-dark" style={{ marginTop: 16 }}>
              Go to login
            </Link>
          </div>
        )}
        {phase === 'verified' && (
          <div className="panel" style={{ borderColor: 'var(--success)' }}>
            <div style={{ marginBottom: 16 }}>
              <Stamp tone="moss" rotate={false}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={14} />
                  Verified
                </span>
              </Stamp>
            </div>
            <h3 style={{ marginTop: 0 }}>You&apos;re verified</h3>
            <p>Your Telegram account is linked. You can now open a store, list products and join the affiliate program.</p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Link href="/dashboard" className="btn btn-dark">
                Go to dashboard
              </Link>
              <Link href="/sell" className="btn btn-outline">
                Start selling
              </Link>
            </div>
          </div>
        )}
        {phase === 'unverified' && deepLink && (
          <div className="panel">
            <p className="lede" style={{ fontSize: 16 }}>
              {BRAND.name} asks every seller to verify with Telegram — it keeps fake stores and
              scammers out. Tap the button below, hit <b>Start</b> in the bot, then come back here.
              This page updates itself.
            </p>
            <a href={deepLink} target="_blank" rel="noreferrer" className="btn btn-primary btn-lg">
              Open @{process.env.NEXT_PUBLIC_BOT_USERNAME ?? 'Digitalsale_bot'} to verify
            </a>
            <p className="fineprint" style={{ marginTop: 16 }}>
              Waiting for the bot… this page checks automatically every few seconds. The link
              expires in 15 minutes.
            </p>
            <div className="verify-spinner" aria-hidden>
              <span />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
