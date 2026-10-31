/**
 * Telegram Mini App client helpers (browser only — NO node imports here,
 * this module is bundled for the browser).
 */

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
}

export interface ThemeParams {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
}

// Minimal typing for the Telegram WebApp JS API (only what we use).
export interface TelegramWebApp {
  initData: string;
  initDataUnsafe: { user?: TelegramUser; start_param?: string };
  themeParams: ThemeParams;
  colorScheme: 'light' | 'dark';
  isExpanded: boolean;
  ready(): void;
  expand(): void;
  close(): void;
  enableClosingConfirmation(): void;
  disableClosingConfirmation(): void;
  BackButton: { show(): void; hide(): void; onClick(fn: () => void): void; offClick(fn: () => void): void };
  MainButton: {
    setText(t: string): void;
    show(): void;
    hide(): void;
    enable(): void;
    disable(): void;
    showProgress(leaveActive?: boolean): void;
    hideProgress(): void;
    onClick(fn: () => void): void;
    offClick(fn: () => void): void;
  };
  HapticFeedback: {
    impactOccurred(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'): void;
    notificationOccurred(type: 'error' | 'success' | 'warning'): void;
    selectionChanged(): void;
  };
  onEvent(event: string, fn: () => void): void;
  offEvent(event: string, fn: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function inTelegram(): boolean {
  const wa = getWebApp();
  return !!wa && typeof wa.initData === 'string' && wa.initData.length > 0;
}

/** Map Telegram theme params onto our CSS variables; safe to call anywhere. */
export function applyTelegramTheme(tp: ThemeParams): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const map: Record<string, keyof ThemeParams> = {
    '--tg-bg': 'bg_color',
    '--tg-text': 'text_color',
    '--tg-hint': 'hint_color',
    '--tg-link': 'link_color',
    '--tg-button': 'button_color',
    '--tg-button-text': 'button_text_color',
    '--tg-secondary-bg': 'secondary_bg_color',
  };
  for (const [cssVar, key] of Object.entries(map)) {
    const v = tp[key];
    if (v) root.style.setProperty(cssVar, v);
  }
  // Follow Telegram's own dark/light scheme unless the user picked a theme.
  try {
    const wa = getWebApp();
    if (wa && (wa.colorScheme === 'dark' || wa.colorScheme === 'light')) {
      if (!window.localStorage.getItem('digitalsale-theme')) {
        root.dataset.theme = wa.colorScheme;
      }
    }
  } catch {
    /* ignore */
  }
}

export function haptic(kind: 'tap' | 'success' | 'error' = 'tap'): void {
  const wa = getWebApp();
  try {
    if (!wa) return;
    if (kind === 'tap') wa.HapticFeedback.impactOccurred('light');
    else if (kind === 'success') wa.HapticFeedback.notificationOccurred('success');
    else wa.HapticFeedback.notificationOccurred('error');
  } catch {
    /* haptics are best-effort */
  }
}
