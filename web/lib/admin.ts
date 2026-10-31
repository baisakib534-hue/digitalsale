import type Database from 'better-sqlite3';
import { canonicalGmail } from './email';

/**
 * Admin check (v4): a user is an admin when their canonical Gmail address is
 * listed in the ADMIN_EMAILS env var (comma-separated).
 */
export function adminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS || '';
  return raw
    .split(',')
    .map((e) => canonicalGmail(e)?.canonical ?? null)
    .filter((e): e is string => !!e);
}

export function isAdmin(db: Database.Database, userId: string): boolean {
  const user = db.prepare('SELECT email, email_canonical FROM users WHERE id = ?').get(userId) as
    | { email: string | null; email_canonical: string | null }
    | undefined;
  if (!user) return false;
  const canonical = user.email_canonical ?? canonicalGmail(user.email ?? '')?.canonical ?? null;
  if (!canonical) return false;
  return adminEmails().includes(canonical);
}
