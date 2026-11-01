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

export function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path
          d="M10 2.5c.9 2.6 2.4 4.1 5.2 4.6-2.8.5-4.3 2-5.2 4.6-.9-2.6-2.4-4.1-5.2-4.6 2.8-.5 4.3-2 5.2-4.6z"
          fill="#F5EFE0"
        />
        <path d="M10 12.5v5" stroke="#F5EFE0" strokeWidth="2" strokeLinecap="round" />
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

  const links = [
    { href: '/market', label: 'Marketplace' },
    { href: '/affiliates', label: 'Affiliates' },
    { href: '/how-it-works', label: 'How it works' },
    { href: '/fees', label: 'Fees' },
    { href: '/sell', label: 'Sell' },
    ...(me ? [{ href: '/wishlist', label: 'Wishlist' }] : []),
  ];

  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand" onClick={() => haptic('tap')}>
          <BrandMark />
          {BRAND.name}
        </Link>
        <nav className="nav-links" aria-label="Primary">
          <Link href="/market" className={isActive('/market') ? 'active' : ''}>
            Marketplace
          </Link>
          <Link href="/affiliates" className={isActive('/affiliates') ? 'active' : ''}>
            Affiliates
          </Link>
          <Link href="/how-it-works" className={isActive('/how-it-works') ? 'active' : ''}>
            How it works
          </Link>
          <Link href="/fees" className={isActive('/fees') ? 'active' : ''}>
            Fees
          </Link>
          <Link href="/sell" className={isActive('/sell') ? 'active' : ''}>
            Sell
          </Link>
          {me && (
            <Link href="/wishlist" className={isActive('/wishlist') ? 'active' : ''}>
              Wishlist
            </Link>
          )}
          {me && (
            <Link href="/history" className={isActive('/history') ? 'active' : ''}>
              History
            </Link>
          )}
        </nav>
        <div className="header-actions">
          {me?.hasStore && <span className="fee-note">10% flat fee — keep 90%</span>}
          <ThemeToggle />
          {loaded &&
            (me ? (
              <>
                <Link
                  href={me.hasStore ? '/dashboard' : '/dashboard'}
                  className="btn btn-dark btn-sm"
                  onClick={() => haptic('tap')}
                >
                  {me.hasStore ? 'Seller dashboard' : 'Start selling'}
                </Link>
                <span
                  title={me.email || me.name}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--moss)',
                    color: 'var(--paper)',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 700,
                    fontSize: 15,
                  }}
                >
                  {(me.name || 'M').charAt(0).toUpperCase()}
                </span>
              </>
            ) : (
              <>
                <Link href="/auth" className="btn btn-outline btn-sm hide-mobile" onClick={() => haptic('tap')}>
                  Log in
                </Link>
                <Link href="/auth?mode=signup" className="btn btn-primary btn-sm" onClick={() => haptic('tap')}>
                  Start selling
                </Link>
              </>
            ))}
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
        <nav className="mobile-menu" aria-label="Mobile">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={isActive(l.href) ? 'active' : ''}
              onClick={() => haptic('tap')}
            >
              {l.label}
            </Link>
          ))}
          <div className="mobile-menu-actions">
            {loaded &&
              (me ? (
                <Link href="/dashboard" className="btn btn-dark" onClick={() => haptic('tap')}>
                  {me.hasStore ? 'Seller dashboard' : 'Start selling'}
                </Link>
              ) : (
                <>
                  <Link href="/auth" className="btn btn-outline" onClick={() => haptic('tap')}>
                    Log in
                  </Link>
                  <Link href="/auth?mode=signup" className="btn btn-primary" onClick={() => haptic('tap')}>
                    Start selling
                  </Link>
                </>
              ))}
            <span className="fee-note">10% flat fee — keep 90%</span>
          </div>
        </nav>
      )}
    </header>
  );
}
