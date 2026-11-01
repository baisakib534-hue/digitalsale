'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { getWebApp, haptic, inTelegram } from '../../lib/telegram-client';
import { BRAND } from '../../lib/brand';
import { IconCheck } from '../../components/doodles';


function AuthForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialMode = sp.get('mode') === 'signup' ? 'signup' : 'login';
  const [mode, setMode] = useState<'signup' | 'login'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tgAttempted = useRef(false);

  // Telegram auto-login: one attempt on mount when inside the Mini App.
  useEffect(() => {
    if (tgAttempted.current) return;
    tgAttempted.current = true;
    if (!inTelegram()) return;
    const initData = getWebApp()?.initData;
    if (!initData) return;
    fetch('/api/auth/telegram', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then((r) => {
        if (r.ok) {
          haptic('success');
          router.replace('/dashboard');
        }
      })
      .catch(() => {});
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const em = email.trim();
    if (!/@gmail\.com$/i.test(em) && !/@googlemail\.com$/i.test(em)) {
      setError('Please use a Gmail address — only @gmail.com accounts can sign up.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (mode === 'signup' && name.trim().length < 2) {
      setError('Tell us your name — at least 2 characters.');
      return;
    }
    setBusy(true);
    haptic('tap');
    try {
      const res = await fetch(mode === 'signup' ? '/api/auth/signup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          mode === 'signup'
            ? { name: name.trim(), email: em, password }
            : { email: em, password }
        ),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(
          res.status === 409
            ? 'That Gmail is already registered. Try logging in instead.'
            : res.status === 401
              ? 'Wrong email or password. Try again.'
              : data.error === 'email-not-gmail'
                ? 'Please use a Gmail address — only @gmail.com accounts can sign up.'
                : data.error === 'email-temp-blocked'
                  ? 'Temporary email addresses are not allowed.'
                  : data.error === 'rate-limited'
                    ? 'Too many signups from your network. Try again tomorrow.'
                    : data.error || 'Something went wrong. Please try again.'
        );
        haptic('error');
        return;
      }
      haptic('success');
      router.replace('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Check your connection and try again.');
      haptic('error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-card">
      <h2 style={{ marginBottom: 8 }}>{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h2>
      <p style={{ color: 'var(--muted)', fontSize: 14.5, marginBottom: 24 }}>
        {mode === 'signup'
          ? 'One account for buying and selling. Your storefront is two minutes away.'
          : 'Log in to manage your store or grab your downloads.'}
      </p>
      <div className="auth-tabs" role="tablist">
        <button type="button" className={mode === 'login' ? 'on' : ''} onClick={() => { setMode('login'); setError(null); }}>
          Log in
        </button>
        <button type="button" className={mode === 'signup' ? 'on' : ''} onClick={() => { setMode('signup'); setError(null); }}>
          Sign up
        </button>
      </div>
      <form onSubmit={submit} noValidate>
        {mode === 'signup' && (
          <div className="field">
            <label htmlFor="auth-name">Your name</label>
            <input
              id="auth-name"
              className="input"
              type="text"
              autoComplete="name"
              placeholder="June Park"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={busy}
            />
          </div>
        )}
        <div className="field">
          <label htmlFor="auth-email">Gmail address</label>
          <input
            id="auth-email"
            className="input"
            type="email"
            autoComplete="email"
            placeholder="you@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={busy}
          />
          <p className="fineprint">Only Gmail. Every account is verified with Telegram — no fake stores.</p>
        </div>
        <div className="field">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            className="input"
            type="password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={busy}
          />
        </div>
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={busy}>
          {busy ? 'One moment…' : mode === 'signup' ? 'Create account' : 'Log in'}
        </button>
      </form>
      <div className="form-note" style={{ marginTop: 24 }}>
        <strong>Exploring the demo?</strong> Log in as the demo seller:{' '}
        <code>june.fernfield@gmail.com</code> / <code>DemoPass123!</code>
      </div>
      <p style={{ marginTop: 20, fontSize: 13.5, color: 'var(--muted)', textAlign: 'center' }}>
        <Link href="/market">← Back to the market</Link>
      </p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <span className="eyebrow" style={{ color: 'var(--ember)' }}>
          {BRAND.name} for creators
        </span>
        <h2 style={{ color: 'var(--ink)', fontSize: '2.5rem', marginTop: 16 }}>
          Sell your work.
          <br />
          Actually get paid.
        </h2>
        <p style={{ color: 'var(--body)', maxWidth: 420 }}>
          A {BRAND.feePercent}% flat fee, payouts in {BRAND.payoutAsset} to anywhere in the world, and instant delivery
          for your buyers. Open your store inside Telegram or right here on the web.
        </p>
        <ul style={{ listStyle: 'none', padding: 0, margin: '32px 0 0', display: 'grid', gap: 16 }}>
          {[
            `Keep ${100 - BRAND.feePercent}% of every sale — no tiers, no surprises`,
            'USDT payouts with no minimum and no borders',
            'Files archived safely, downloads delivered instantly',
          ].map((t) => (
            <li key={t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span className="auth-check" style={{ display: 'inline-flex', marginTop: 3 }}>
                <IconCheck size={18} />
              </span>
              <span style={{ color: 'var(--body)', fontSize: 15 }}>{t}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="auth-form-wrap">
        <Suspense>
          <AuthForm />
        </Suspense>
      </div>
    </div>
  );
}
