import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { getSessionUserId } from '../../../../lib/auth';
import { isAdmin } from '../../../../lib/admin';

/**
 * GET /api/admin/reports — moderation queue (admins only).
 * Open + reviewed reports with target titles; flagged products included.
 */
export async function GET(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  if (!isAdmin(db, uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const url = new URL(req.url);
  const status = url.searchParams.get('status');
  const statusFilter =
    status === 'open' || status === 'reviewed' || status === 'actioned' || status === 'dismissed'
      ? 'AND r.status = ?'
      : "AND r.status IN ('open', 'reviewed')";
  const params: unknown[] = status
    ? [status]
    : [];

  const reports = db
    .prepare(
      `SELECT r.id, r.target_type AS targetType, r.target_id AS targetId,
              r.reason, r.details, r.status, r.created_at AS createdAt,
              u.name AS reporterName,
              COALESCE(p.title, s.name, '(deleted)') AS targetTitle,
              COALESCE(p.status, s.status, '') AS targetStatus,
              COALESCE(p.flagged, 0) AS flagged
       FROM reports r
       JOIN users u ON u.id = r.reporter_user_id
       LEFT JOIN products p ON p.id = r.target_id AND r.target_type = 'product'
       LEFT JOIN stores s ON s.id = r.target_id AND r.target_type = 'store'
       WHERE 1 = 1 ${statusFilter}
       ORDER BY r.created_at DESC
       LIMIT 200`
    )
    .all(...params);

  const flaggedProducts = db
    .prepare(
      `SELECT p.id, p.title, s.name AS storeName, p.created_at AS createdAt
       FROM products p JOIN stores s ON s.id = p.store_id
       WHERE p.flagged = 1 ORDER BY p.created_at DESC LIMIT 100`
    )
    .all();

  const scanLogs = db
    .prepare(
      `SELECT id, user_id AS userId, filename, reasons, created_at AS createdAt
       FROM scan_logs ORDER BY created_at DESC LIMIT 50`
    )
    .all();

  return NextResponse.json({ reports, flaggedProducts, scanLogs });
}
