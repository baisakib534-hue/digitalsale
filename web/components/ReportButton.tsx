'use client';

import { useState } from 'react';
import { haptic } from '../lib/telegram-client';
import { IconFlag } from './doodles';

const REASONS = [
  { value: 'scam', label: 'Scam — this looks fraudulent' },
  { value: 'malware', label: 'Malware — the files seem dangerous' },
  { value: 'fake', label: 'Fake — not what it claims to be' },
  { value: 'copyright', label: 'Copyright — uses someone else\u2019s work' },
  { value: 'prohibited', label: 'Prohibited content' },
  { value: 'illegal', label: 'Illegal — against the law (permanent ban)' },
  { value: 'other', label: 'Something else' },
] as const;

/** Report button + modal (v4). Login required; one open report per user per target. */
export default function ReportButton({
  targetType,
  targetId,
}: {
  targetType: 'product' | 'store';
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('scam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, reason, details: details.trim() }),
      });
      const data = await res.json();
      if (res.status === 401) {
        window.location.href = '/auth';
        return;
      }
      if (!res.ok) {
        setError(
          data.error === 'already-reported'
            ? 'You already have an open report on this — our moderators will review it.'
            : data.error || 'Could not submit the report.'
        );
        return;
      }
      haptic('success');
      setDone(true);
    } catch {
      setError('Network error. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-outline btn-sm report-btn"
        onClick={() => {
          haptic('tap');
          setOpen(true);
          setDone(false);
          setError(null);
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <IconFlag size={15} />
          Report
        </span>
      </button>
      {open && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Report this listing"
          onClick={() => setOpen(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            {done ? (
              <>
                <h3>Report received</h3>
                <p>
                  Thanks — a moderator will review this. Reports are public in aggregate on the
                  Safety section below, but your identity stays private.
                </p>
                <button type="button" className="btn btn-dark" onClick={() => setOpen(false)}>
                  Done
                </button>
              </>
            ) : (
              <>
                <h3>Report this {targetType}</h3>
                <p className="fineprint">
                  Reports are reviewed by moderators. Three independent reports auto-suspend a
                  product pending review.
                </p>
                <form onSubmit={submit} noValidate>
                  <div className="field">
                    {REASONS.map((r) => (
                      <label key={r.value} className="check-row" style={{ marginBottom: 8 }}>
                        <input
                          type="radio"
                          name="reason"
                          value={r.value}
                          checked={reason === r.value}
                          onChange={() => setReason(r.value)}
                          disabled={busy}
                        />
                        <span>{r.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="field">
                    <label htmlFor="report-details">Details (optional)</label>
                    <textarea
                      id="report-details"
                      className="textarea"
                      placeholder="What did you notice?"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      disabled={busy}
                      maxLength={2000}
                    />
                  </div>
                  {error && (
                    <div className="form-error" role="alert">
                      {error}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="submit" className="btn btn-primary" disabled={busy}>
                      {busy ? 'Submitting…' : 'Submit report'}
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => setOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
