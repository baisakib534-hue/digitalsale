import type Database from 'better-sqlite3';

/**
 * Trust & safety report helpers (v4). Route handlers live in
 * app/api/reports + app/api/admin/reports; the testable logic lives here
 * because the test build excludes app/.
 */

export const REPORT_REASONS = ['scam', 'malware', 'fake', 'copyright', 'prohibited', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Auto-suspend threshold: distinct reporters before a product is paused. */
export const AUTO_SUSPEND_THRESHOLD = 3;

/** Count distinct reporters with open/reviewed reports on a target. */
export function distinctReporterCount(
  db: Database.Database,
  targetType: string,
  targetId: string
): number {
  const row = db
    .prepare(
      `SELECT COUNT(DISTINCT reporter_user_id) AS c FROM reports
       WHERE target_type = ? AND target_id = ?
         AND status IN ('open', 'reviewed')`
    )
    .get(targetType, targetId) as { c: number };
  return row.c;
}

/**
 * Suspend a product once it has >= AUTO_SUSPEND_THRESHOLD distinct
 * open/reviewed reporters. Returns true when a suspension happened.
 * Stores are never auto-suspended (admin decision only).
 */
export function maybeAutoSuspend(
  db: Database.Database,
  targetType: string,
  targetId: string
): boolean {
  if (targetType !== 'product') return false;
  if (distinctReporterCount(db, targetType, targetId) < AUTO_SUSPEND_THRESHOLD) return false;
  const prod = db.prepare('SELECT status FROM products WHERE id = ?').get(targetId) as
    | { status: string }
    | undefined;
  if (prod && prod.status === 'published') {
    db.prepare("UPDATE products SET status = 'suspended' WHERE id = ?").run(targetId);
    return true;
  }
  return false;
}

/** True when the user already has an OPEN report on this target (409 case). */
export function hasOpenReport(
  db: Database.Database,
  reporterUserId: string,
  targetType: string,
  targetId: string
): boolean {
  const row = db
    .prepare(
      `SELECT id FROM reports
       WHERE reporter_user_id = ? AND target_type = ? AND target_id = ? AND status = 'open'`
    )
    .get(reporterUserId, targetType, targetId);
  return !!row;
}
