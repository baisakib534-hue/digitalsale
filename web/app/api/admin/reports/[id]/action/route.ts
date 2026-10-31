import { NextResponse } from 'next/server';
import { getDb } from '../../../../../../lib/db';
import { getSessionUserId } from '../../../../../../lib/auth';
import { isAdmin } from '../../../../../../lib/admin';

const ACTIONS = ['dismiss', 'suspend-product', 'unsuspend', 'suspend-store', 'unsuspend-store', 'actioned'] as const;

interface ActionBody {
  action?: unknown;
}

/**
 * POST /api/admin/reports/[id]/action — moderation actions (admins only).
 * { action: 'dismiss' | 'suspend-product' | 'unsuspend' |
 *           'suspend-store' | 'unsuspend-store' | 'actioned' }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const db = getDb();
  if (!isAdmin(db, uid)) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: ActionBody;
  try {
    body = (await req.json()) as ActionBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const action = typeof body.action === 'string' ? body.action : '';
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return NextResponse.json({ error: 'invalid-action', valid: ACTIONS }, { status: 400 });
  }

  const report = db
    .prepare('SELECT id, target_type, target_id, status FROM reports WHERE id = ?')
    .get(params.id) as
    | { id: string; target_type: string; target_id: string; status: string }
    | undefined;
  if (!report) return NextResponse.json({ error: 'not-found' }, { status: 404 });

  let targetStatus: string | null = null;
  if (action === 'dismiss' || action === 'actioned') {
    db.prepare('UPDATE reports SET status = ? WHERE id = ?').run(
      action === 'dismiss' ? 'dismissed' : 'actioned',
      report.id
    );
  } else if (action === 'suspend-product' && report.target_type === 'product') {
    db.prepare("UPDATE products SET status = 'suspended' WHERE id = ?").run(report.target_id);
    db.prepare("UPDATE reports SET status = 'actioned' WHERE id = ?").run(report.id);
    targetStatus = 'suspended';
  } else if (action === 'unsuspend' && report.target_type === 'product') {
    db.prepare("UPDATE products SET status = 'published' WHERE id = ? AND status = 'suspended'").run(
      report.target_id
    );
    db.prepare("UPDATE reports SET status = 'reviewed' WHERE id = ?").run(report.id);
    targetStatus = 'published';
  } else if (action === 'suspend-store' && report.target_type === 'store') {
    db.prepare("UPDATE stores SET status = 'suspended' WHERE id = ?").run(report.target_id);
    db.prepare("UPDATE reports SET status = 'actioned' WHERE id = ?").run(report.id);
    targetStatus = 'suspended';
  } else if (action === 'unsuspend-store' && report.target_type === 'store') {
    db.prepare("UPDATE stores SET status = 'active' WHERE id = ?").run(report.target_id);
    db.prepare("UPDATE reports SET status = 'reviewed' WHERE id = ?").run(report.id);
    targetStatus = 'active';
  } else {
    return NextResponse.json({ error: 'action-target-mismatch' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, action, ...(targetStatus ? { targetStatus } : {}) });
}
