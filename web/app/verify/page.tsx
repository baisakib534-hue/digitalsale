'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { haptic } from '../../lib/telegram-client';
import { IconShield, IconSend } from '../../components/doodles';

function VerifyContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const hash = sp.get('hash');
  const [state, setState] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!hash) {
      setState('error');
      setMessage('No verification code. Open the link from the bot.');
      return;
    }
    setState('checking');
    setMessage('Checking your verification link…');
    fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hash }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          haptic('success');
          setState('success');
          setMessage('Telegram verified — you can now sell and receive payouts.');
          setTimeout(() => router.replace('/dashboard'), 1200);
        } else {
          haptic('error');
          setState('error');
          setMessage(data.error || 'This link expired or was already used. Request a new one from the bot.');
        }
      })
      .catch(() => {
        haptic('error');
        setState('error');
        setMessage('Network error. Try again or open the link from the bot.');
      });
  }, [hash, router]);

  if (state === 'checking') {
    return (
      <div className="form-card" style={{ textAlign: 'center' }}>
        <div className="verify-spinner" style={{ margin: '0 auto 20px' }} aria-hidden="true" />
        <h2 style={{ color: 'var(--ink)', marginBottom: 12 }}>Verifying your Telegram account</h2>
        <p style={{ color: 'var(--muted)' }}>{message}</p>
      </div>
    );
  }

  if (state === 'success') {
    return (
      <div className="form-card" style={{ textAlign: 'center' }}>
        <div style={{ margin: '0 auto 20px', display: 'inline-flex', color: 'var(--mint)' }}>
          <IconShield size={48} />
        </div>
        <h2 style={{ color: 'var(--ink)', marginBottom: 12 }}>Verified</h2>
        <p style={{ color: 'var(--body)', marginBottom: 24 }}>{message}</p>
        <button
          className="btn btn-primary"
          onClick={() => router.replace('/dashboard')}
          style={{ width: '100%' }}
        >
          <IconSend size={16} /> Go to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="form-card" style={{ textAlign: 'center' }}>
      <div style={{ margin: '0 auto 20px', display: 'inline-flex', color: 'var(--faint)' }}>
        <IconShield size={48} />
      </div>
      <h2 style={{ color: 'var(--ink)', marginBottom: 12 }}>Verification failed</h2>
      <p style={{ color: 'var(--body)', marginBottom: 24 }}>{message}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => router.push('/auth')}>
          Try again
        </button>
        <button className="btn btn-outline" onClick={() => router.push('/market')}>
          Back to market
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <span className="eyebrow" style={{ color: 'var(--ember)' }}>
          Telegram verification
        </span>
        <h2 style={{ color: 'var(--ink)', fontSize: '2.5rem', marginTop: 16 }}>
          Connect your account.
        </h2>
        <p style={{ color: 'var(--body)', maxWidth: 420 }}>
          Every seller is verified through Telegram. One tap, no fake stores, instant trust.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '32px 0 0', display: 'grid', gap: 16 }}>
          {[
            'Your Telegram identity is cryptographically signed',
            'No passwords to share, no SIM-swap risk',
            'Works in the Telegram app and on the web',
          ].map((t) => (
            <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className="auth-check" style={{ display: 'inline-flex', marginTop: 3, color: 'var(--mint)' }}>
                <IconShield size={18} />
              </span>
              <span style={{ color: 'var(--body)', fontSize: 15 }}>{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="auth-form-wrap">
        <Suspense>
          <VerifyContent />
        </Suspense>
      </div>
    </div>
  );
}