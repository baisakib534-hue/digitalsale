'use client';

import { useEffect, useState } from 'react';
import { IconShield } from './doodles';

interface SafetyData {
  total: number;
  byReason: { reason: string; c: number }[];
  recent: { reason: string; reporter: string; at: string }[];
}

const REASON_LABELS: Record<string, string> = {
  scam: 'Scam',
  malware: 'Malware',
  fake: 'Misleading listing',
  copyright: 'Copyright issue',
  prohibited: 'Prohibited content',
  other: 'Other',
};

/** Public Safety section (v4): report counts + anonymized recent reasons. */
export default function SafetySection({
  targetType,
  targetId,
}: {
  targetType: 'product' | 'store';
  targetId: string;
}) {
  const [data, setData] = useState<SafetyData | null>(null);

  useEffect(() => {
    fetch(`/api/reports?target=${targetType}:${encodeURIComponent(targetId)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setData(j))
      .catch(() => {});
  }, [targetType, targetId]);

  if (!data) return null;

  return (
    <div className="panel safety" style={{ marginTop: 40 }}>
      <h3 style={{ marginTop: 0, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: 'var(--ember)' }}>
          <IconShield size={24} />
        </span>
        Safety
        {data.total > 0 && (
          <span className="chip badge-report" style={{ marginLeft: 12 }}>
            {data.total} {data.total === 1 ? 'report' : 'reports'}
          </span>
        )}
      </h3>
      {data.total === 0 ? (
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          No reports on this {targetType}. If something looks wrong, use the Report button — three
          independent reports auto-suspend a product pending review.
        </p>
      ) : (
        <>
          <div className="cat-row" style={{ marginBottom: 16 }}>
            {data.byReason.map((r) => (
              <span key={r.reason} className="chip">
                {REASON_LABELS[r.reason] ?? r.reason} × {r.c}
              </span>
            ))}
          </div>
          <ul className="safety-list">
            {data.recent.map((r, i) => (
              <li key={i}>
                <strong>{REASON_LABELS[r.reason] ?? r.reason}</strong>
                <span> — reported by {r.reporter}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
