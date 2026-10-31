import { DISPOSABLE_DOMAINS } from './disposable-domains';

export interface NormalizedGmail {
  /** What the user typed, trimmed + lowercased (display). */
  display: string;
  /** Canonical form: dots removed, +tag stripped, googlemail → gmail. */
  canonical: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize a Gmail address to its canonical form.
 * Gmail ignores dots and +tags: j.ohn+shop@gmail.com === john@gmail.com.
 * googlemail.com is normalized to gmail.com. Anything else → null.
 */
export function normalizeGmail(email: unknown): NormalizedGmail | null {
  if (typeof email !== 'string') return null;
  const display = email.trim().toLowerCase();
  if (!EMAIL_RE.test(display)) return null;
  const at = display.lastIndexOf('@');
  const local = display.slice(0, at);
  let domain = display.slice(at + 1);
  if (domain !== 'gmail.com' && domain !== 'googlemail.com') return null;
  domain = 'gmail.com';
  if (local.length === 0 || local.startsWith('.') || local.endsWith('.') || local.includes('..')) {
    return null;
  }
  const bare = local.split('+')[0].replace(/\./g, '');
  if (bare.length === 0) return null;
  return { display, canonical: `${bare}@${domain}` };
}

/** Canonical-only form (null when not a gmail address). Used by migrations. */
export function canonicalGmail(email: string): { canonical: string } | null {
  const n = normalizeGmail(email);
  return n ? { canonical: n.canonical } : null;
}

/**
 * Defense in depth alongside the gmail-only rule: block known
 * temporary/disposable mail domains (checked against the full address).
 */
export function isDisposable(email: string): boolean {
  const at = email.trim().toLowerCase().lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.trim().toLowerCase().slice(at + 1);
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  // Subdomain variants: anything ending in .<blocked> is blocked too.
  for (const blocked of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}
