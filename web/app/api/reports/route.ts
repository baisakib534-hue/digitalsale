import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { randomId } from '../../../lib/crypto';
import { getSessionUserId } from '../../../lib/auth';
import {
  REPORT_REASONS,
  hasOpenReport,
  maybeAutoSuspend,
} from '../../../lib/reports';

interface ReportBody {
  targetType?: unknown;
  targetId?: unknown;
  reason?: unknown;
  details?: unknown;
}

/**
 * POST /api/reports — file a report (login required).
 * Body: { targetType: 'product'|'store', targetId, reason, details? }
 * 409 when the user already has an OPEN report on the same target.
 */
export async function POST(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: ReportBody;
  try {
    body = (await req.json()) as ReportBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const targetType = body.targetType === 'store' ? 'store' : body.targetType === 'product' ? 'product' : '';
  const targetId = typeof body.targetId === 'string' ? body.targetId.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason : '';
  const details = typeof body.details === 'string' ? body.details.trim().slice(0, 2000) : '';

  if (!targetType) return NextResponse.json({ error: 'invalid-target-type' }, { status: 400 });
  if (!targetId) return NextResponse.json({ error: 'missing-target' }, { status: 400 });
  if (!(REPORT_REASONS as readonly string[]).includes(reason)) {
    return NextResponse.json({ error: 'invalid-reason', valid: REPORT_REASONS }, { status: 400 });
  }

  const db = getDb();
  const targetExists = db
    .prepare(targetType === 'product' ? 'SELECT id FROM products WHERE id = ?' : 'SELECT id FROM stores WHERE id = ?')
    .get(targetId);
  if (!targetExists) return NextResponse.json({ error: 'target-not-found' }, { status: 404 });

  if (hasOpenReport(db, uid, targetType, targetId)) {
    return NextResponse.json({ error: 'already-reported' }, { status: 409 });
  }

  const id = randomId();
  db.prepare(
    `INSERT INTO reports (id, reporter_user_id, target_type, target_id, reason, details, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', datetime('now'))`
  ).run(id, uid, targetType, targetId, reason, details);

  const suspended = maybeAutoSuspend(db, targetType, targetId);
  return NextResponse.json({ id, status: 'open', autoSuspended: suspended }, { status: 201 });
}

/**
 * GET /api/reports?target=product:<id> — public report summary.
 * Counts by reason + recent reasons; reporters are anonymized.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const target = url.searchParams.get('target') ?? '';
  const m = /^(product|store):(.+)$/.exec(target);
  if (!m) return NextResponse.json({ error: 'invalid-target' }, { status: 400 });
  const [, targetType, targetId] = m;

  const db = getDb();
  const counts = db
    .prepare(
      `SELECT reason, COUNT(*) AS c FROM reports
       WHERE target_type = ? AND target_id = ? AND status IN ('open', 'reviewed', 'actioned')
       GROUP BY reason ORDER BY c DESC`
    )
    .all(targetType, targetId) as { reason: string; c: number }[];
  const recent = db
    .prepare(
      `SELECT reason, created_at FROM reports
       WHERE target_type = ? AND target_id = ? AND status IN ('open', 'reviewed', 'actioned')
       ORDER BY created_at DESC LIMIT 5`
    )
    .all(targetType, targetId) as { reason: string; created_at: string }[];

  const total = counts.reduce((s, r) => s + r.c, 0);
  return NextResponse.json({
    targetType,
    total,
    byReason: counts,
    // Reporter identities are never exposed — always "a verified buyer".
    recent: recent.map((r) => ({ reason: r.reason, reporter: 'a verified buyer', at: r.created_at })),
  });
}
