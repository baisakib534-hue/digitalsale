import type Database from 'better-sqlite3';
import { randomId } from './crypto';
import { hashIp } from './affiliate';

/**
 * Signup rate limiting (v3): max 5 signup attempts per IP per rolling 24h.
 * Attempts are recorded in signup_attempts (ip_hash only — never raw IPs)
 * and pruned lazily. Returns true when the attempt is allowed.
 */
export const MAX_SIGNUP_ATTEMPTS_PER_DAY = 5;

export function checkSignupRateLimit(db: Database.Database, ip: string): boolean {
  const ipHash = hashIp(ip);
  db.prepare("DELETE FROM signup_attempts WHERE created_at < datetime('now', '-1 day')").run();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM signup_attempts
       WHERE ip_hash = ? AND created_at >= datetime('now', '-1 day')`
    )
    .get(ipHash) as { c: number };
  if (row.c >= MAX_SIGNUP_ATTEMPTS_PER_DAY) return false;
  db.prepare(
    "INSERT INTO signup_attempts (id, ip_hash, created_at) VALUES (?, ?, datetime('now'))"
  ).run(randomId(), ipHash);
  return true;
}
