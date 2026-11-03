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

/**
 * v13.2: permanently ban a user for illegal activity. The ban is forever —
 * banned users cannot log in, list, or buy, and all their products are
 * suspended. There is no automatic un-ban; only a manual DB change reverses it.
 */
export function banUser(db: Database.Database, userId: string, reason: string): boolean {
  const user = db.prepare('SELECT id, banned_at FROM users WHERE id = ?').get(userId) as
    | { id: string; banned_at: string | null }
    | undefined;
  if (!user || user.banned_at) return false;
  db.prepare(
    `UPDATE users SET banned_at = datetime('now'), ban_reason = ? WHERE id = ?`
  ).run(reason, userId);
  // Suspend every product in every store they own.
  db.prepare(
    `UPDATE products SET status = 'suspended'
     WHERE store_id IN (SELECT id FROM stores WHERE user_id = ?)
       AND status = 'published'`
  ).run(userId);
  return true;
}

/** True when the user is permanently banned (login + actions blocked). */
export function isBanned(db: Database.Database, userId: string): boolean {
  const row = db.prepare('SELECT banned_at FROM users WHERE id = ?').get(userId) as
    | { banned_at: string | null }
    | undefined;
  return !!row?.banned_at;
}
