'use client';

import { useState } from 'react';

/** Buyer's license key with copy button. */
export default function LicenseKeyBox({ licenseKey }: { licenseKey: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(licenseKey);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = licenseKey;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--muted)', marginBottom: 6 }}>
        LICENSE KEY
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <code className="ref-code" style={{ fontSize: 15, letterSpacing: '0.04em' }}>
          {licenseKey}
        </code>
        <button type="button" className="btn btn-outline btn-sm" onClick={copy}>
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <p className="hint" style={{ margin: '6px 0 0' }}>
        Enter this key in the software to activate it. Keep it private.
      </p>
    </div>
  );
}
