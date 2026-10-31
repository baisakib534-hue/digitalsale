'use client';

import { useEffect, useState } from 'react';
import { resolveTheme, setThemeChoice, type ThemeChoice } from './ThemeProvider';
import { haptic } from '../lib/telegram-client';

/** Sun/moon toggle in the site header. */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeChoice>('light');

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');
    const onChange = (e: Event) => setTheme((e as CustomEvent<ThemeChoice>).detail);
    window.addEventListener('digitalsale-theme', onChange);
    return () => window.removeEventListener('digitalsale-theme', onChange);
  }, []);

  const next: ThemeChoice = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
      onClick={() => {
        haptic('tap');
        setThemeChoice(next);
        setTheme(next);
      }}
    >
      {theme === 'dark' ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 13.5A8 8 0 0 1 10.5 4 8 8 0 1 0 20 13.5Z" />
        </svg>
      )}
    </button>
  );
}

/** Re-exported so header code reads naturally. */
export { resolveTheme };
