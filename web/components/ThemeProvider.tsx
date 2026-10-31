'use client';

import { useEffect } from 'react';
import { getWebApp, inTelegram } from '../lib/telegram-client';

export const THEME_KEY = 'digitalsale-theme';
export type ThemeChoice = 'light' | 'dark';

/** Resolve the effective theme: stored choice, else Telegram scheme, else OS preference. */
export function resolveTheme(): ThemeChoice {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* ignore */
  }
  const wa = getWebApp();
  if (wa && inTelegram() && (wa.colorScheme === 'dark' || wa.colorScheme === 'light')) {
    return wa.colorScheme;
  }
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
  } catch {
    /* ignore */
  }
  return 'light';
}

export function applyTheme(t: ThemeChoice) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = t;
  try {
    window.dispatchEvent(new CustomEvent('digitalsale-theme', { detail: t }));
  } catch {
    /* ignore */
  }
}

export function setThemeChoice(t: ThemeChoice) {
  try {
    window.localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore */
  }
  applyTheme(t);
}

/**
 * Keeps data-theme in sync: initial apply, Telegram themeChanged events,
 * and OS dark-mode changes (only when the user has no stored choice).
 */
export default function ThemeProvider() {
  useEffect(() => {
    applyTheme(resolveTheme());

    const wa = getWebApp();
    const onTgTheme = () => {
      try {
        if (!window.localStorage.getItem(THEME_KEY) && wa && wa.colorScheme) {
          applyTheme(wa.colorScheme === 'dark' ? 'dark' : 'light');
        }
      } catch {
        /* ignore */
      }
    };
    let mq: MediaQueryList | null = null;
    const onOsTheme = () => {
      try {
        if (!window.localStorage.getItem(THEME_KEY)) applyTheme(resolveTheme());
      } catch {
        /* ignore */
      }
    };
    try {
      wa?.onEvent?.('themeChanged', onTgTheme);
    } catch {
      /* ignore */
    }
    try {
      mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', onOsTheme);
    } catch {
      /* ignore */
    }
    return () => {
      try {
        wa?.offEvent?.('themeChanged', onTgTheme);
      } catch {
        /* ignore */
      }
      try {
        mq?.removeEventListener('change', onOsTheme);
      } catch {
        /* ignore */
      }
    };
  }, []);

  return null;
}
