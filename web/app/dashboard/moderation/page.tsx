'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { timeAgo } from '../../../lib/format';

interface Report {
  id: string;
  targetType: 'product' | 'store';
  targetId: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reporterName: string;
  targetTitle: string;
  targetStatus: string;
  flagged: number;
}

interface FlaggedProduct {
  id: string;
  title: string;
  storeName: string;
  createdAt: string;
}

interface ScanLog {
  id: string;
  userId: string | null;
  filename: string;
  reasons: string;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  dismiss: 'Dismiss',
  'suspend-product': 'Suspend product',
  unsuspend: 'Unsuspend product',
  'suspend-store': 'Suspend store',
  'unsuspend-store': 'Unsuspend store',
  actioned: 'Mark actioned',
};

export default function ModerationPage() {
  const [phase, setPhase] = useState<'loading' | 'denied' | 'ready'>('loading');
  const [reports, setReports] = useState<Report[]>([]);
  const [flagged, setFlagged] = useState<FlaggedProduct[]>([]);
  const [scans, setScans] = useState<ScanLog[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/reports', { cache: 'no-store' });
    if (res.status === 403 || res.status === 401) {
      setPhase('denied');
      return;
    }
    if (res.ok) {
      const j = await res.json();
      setReports(j.reports ?? []);
      setFlagged(j.flaggedProducts ?? []);
      setScans(j.scanLogs ?? []);
      setPhase('ready');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: string, action: string) {
    setBusyId(id + action);
    try {
      const res = await fetch(`/api/admin/reports/${id}/action`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await load();
    } finally {
      setBusyId(null);
    }
  }

  if (phase === 'loading') {
    return (
      <div className="wrap" style={{ padding: '88px 24px' }}>
        <p>Loading moderation queue…</p>
      </div>
    );
  }

  if (phase === 'denied') {
    return (
      <div className="wrap" style={{ padding: '88px 24px', maxWidth: 640 }}>
        <span className="eyebrow">Moderation</span>
        <h1>Not authorized</h1>
        <p style={{ color: 'var(--muted)' }}>
          This area is for {process.env.NEXT_PUBLIC_BRAND ?? 'Digitalsale'} moderators only.
        </p>
        <Link href="/dashboard" className="btn btn-outline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const openReports = reports.filter((r) => r.status === 'open' || r.status === 'reviewed');

  return (
    <div className="wrap" style={{ padding: '64px 24px 88px', maxWidth: 1100 }}>
      <span className="eyebrow">Moderation queue</span>
      <h1>Trust &amp; safety</h1>
      <p style={{ color: 'var(--muted)' }}>
        {openReports.length} open {openReports.length === 1 ? 'report' : 'reports'} ·{' '}
        {flagged.length} listing{flagged.length === 1 ? '' : 's'} flagged by the safety scan ·{' '}
        {scans.length} blocked uploads logged
      </p>

      <h2 style={{ marginTop: 40 }}>Open reports</h2>
      {openReports.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>All clear — no open reports.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Target</th>
                <th>Reason</th>
                <th>Details</th>
                <th>Reporter</th>
                <th>Reported</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {openReports.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.targetTitle}</strong>
                    <div className="fineprint">
                      {r.targetType} · status: {r.targetStatus || '—'}
                    </div>
                  </td>
                  <td>
                    <span className="chip badge-report">{r.reason}</span>
                  </td>
                  <td style={{ maxWidth: 260 }}>{r.details || '—'}</td>
                  <td>{r.reporterName}</td>
                  <td>{timeAgo(r.createdAt)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {Object.entries(ACTION_LABELS)
                      .filter(([a]) => {
                        if (r.targetType === 'product')
                          return ['dismiss', 'suspend-product', 'unsuspend', 'actioned'].includes(a);
                        return ['dismiss', 'suspend-store', 'unsuspend-store', 'actioned'].includes(a);
                      })
                      .map(([a, label]) => (
                        <button
                          key={a}
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ margin: '2px 4px 2px 0' }}
                          disabled={busyId === r.id + a}
                          onClick={() => void act(r.id, a)}
                        >
                          {busyId === r.id + a ? '…' : label}
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: 48 }}>Safety-scan flags (review only)</h2>
      {flagged.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No listings flagged by the scam-phrase scan.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Product</th>
                <th>Store</th>
                <th>Listed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {flagged.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/product/${p.id}`}>{p.title}</Link>
                  </td>
                  <td>{p.storeName}</td>
                  <td>{timeAgo(p.createdAt)}</td>
                  <td>
                    <span className="chip badge-flagged">flagged for review</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: 48 }}>Blocked uploads (quarantine log)</h2>
      {scans.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No blocked uploads yet.</p>
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>File</th>
                <th>Reasons</th>
                <th>When</th>
              </tr>
            </thead>
            <tbody>
              {scans.map((s) => (
                <tr key={s.id}>
                  <td>
                    <code>{s.filename}</code>
                  </td>
                  <td style={{ maxWidth: 480 }}>
                    {(JSON.parse(s.reasons) as string[]).join(' ')}
                  </td>
                  <td>{timeAgo(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
