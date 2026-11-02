'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { haptic } from '../lib/telegram-client';
import ThemeToggle from './ThemeToggle';
import { BRAND } from '../lib/brand';

interface Me {
  id: string;
  name: string;
  email: string | null;
  hasStore: boolean;
}

interface AuthLink {
  href: string;
  label: string;
  variant: 'primary' | 'outline';
}

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg width="28" height="28" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="64" height="64" rx="14" fill="currentColor" />
        <path d="M18 18h20l12 12v20H18z" fill="currentColor" style={{ opacity: 0.18 }} />
        <circle cx="40.25" cy="29" r="3" fill="currentColor" style={{ opacity: 0.18 }} />
      </svg>
    </span>
  );
}

export default function SiteHeader() {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        setMe(j?.user ?? null);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const isActive = (p: string) => (p === '/' ? pathname === '/' : pathname.startsWith(p));

  const navLinks: Array<{ href: string; label: string }> = [
    { href: '/market', label: 'Marketplace' },
    { href: '/affiliates', label: 'Affiliates' },
    { href: '/how-it-works', label: 'How it works' },
    { href: '/fees', label: 'Fees' },
    { href: '/sell', label: 'Sell' },
  ];

  const authLinks: AuthLink[] = me
    ? [
        ...(me.hasStore
          ? [{ href: '/dashboard', label: 'Seller dashboard', variant: 'primary' as const }]
          : [{ href: '/sell', label: 'Start selling', variant: 'primary' as const }]),
        { href: '/wishlist', label: 'Wishlist', variant: 'primary' as const },
        { href: '/history', label: 'History', variant: 'primary' as const },
      ]
    : [
        { href: '/auth', label: 'Log in', variant: 'outline' },
        { href: '/auth?mode=signup', label: 'Sign up', variant: 'primary' },
      ];

  return (
    <header className="site-header" role="banner">
      <div className="wrap">
        <Link href="/" className="brand" onClick={() => haptic('tap')}>
          <BrandMark />
          {BRAND.name}
        </Link>

        <nav className="nav-links" aria-label="Primary navigation">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(l.href) ? 'active' : ''}
              onClick={() => haptic('tap')}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          {me?.hasStore && <span className="fee-note">10% flat fee — keep 90%</span>}
          <ThemeToggle />

          {loaded && (
            <>
              {authLinks.map((l, i) => (
                <Link
                  key={`${l.href}-${i}`}
                  href={l.href}
                  className={`btn btn-${l.variant} btn-sm${l.variant === 'outline' ? ' hide-mobile' : ''}`}
                  onClick={() => haptic('tap')}
                >
                  {l.label}
                </Link>
              ))}
              {me && (
                <span title={me.email || me.name} className="avatar">
                  {(me.name || 'M').charAt(0).toUpperCase()}
                </span>
              )}
            </>
          )}
        </div>

        <button
          className="menu-btn"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          onClick={() => {
            haptic('tap');
            setMenuOpen((v) => !v);
          }}
        >
          <span className={menuOpen ? 'open' : ''} aria-hidden>
            <i />
            <i />
            <i />
          </span>
        </button>
      </div>

      {menuOpen && (
        <nav className="mobile-menu" aria-label="Mobile navigation">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(l.href) ? 'active' : ''}
              onClick={() => {
                haptic('tap');
                setMenuOpen(false);
              }}
            >
              {l.label}
            </Link>
          ))}
          <div className="mobile-menu-actions">
            {loaded && authLinks.map((l, i) => (
              <Link
                key={`${l.href}-mobile-${i}`}
                href={l.href}
                className={`btn btn-${l.variant}`}
                onClick={() => {
                  haptic('tap');
                  setMenuOpen(false);
                }}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}