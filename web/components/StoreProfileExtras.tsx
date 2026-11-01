'use client';

import { useEffect, useState } from 'react';
import { haptic } from '../lib/telegram-client';

interface ApiTokenRow {
  id: string;
  name: string;
  revoked: number;
  last_used_at: string | null;
  created_at: string;
}

/**
 * Store profile extras (v12): logo/banner upload, white-label storefront link,
 * and seller API tokens for listing products from the seller's own web app.
 */
export default function StoreProfileExtras({ storeSlug }: { storeSlug: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [wlToken, setWlToken] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState<'logo' | 'banner' | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [wlBusy, setWlBusy] = useState(false);
  const [copied, setCopied] = useState<'link' | 'token' | null>(null);

  const [tokens, setTokens] = useState<ApiTokenRow[]>([]);
  const [tokenName, setTokenName] = useState('');
  const [tokenBusy, setTokenBusy] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const enc = encodeURIComponent(storeSlug);

  async function load() {
    try {
      const res = await fetch(`/api/stores/${enc}`, { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as {
        store: { avatar_url: string | null; banner_url: string | null; whitelabel_token: string | null };
      };
      setLogoUrl(data.store.avatar_url);
      setBannerUrl(data.store.banner_url);
      setWlToken(data.store.whitelabel_token);
    } catch {
      /* best effort */
    }
    try {
      const res = await fetch(`/api/stores/${enc}/api-tokens`, { cache: 'no-store' });
      if (res.ok) {
        const data = (await res.json()) as { tokens: ApiTokenRow[] };
        setTokens(data.tokens ?? []);
      }
    } catch {
      /* best effort */
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeSlug]);

  async function upload(kind: 'logo' | 'banner', file: File) {
    setUploadError(null);
    setUploadBusy(kind);
    try {
      const form = new FormData();
      form.append('kind', kind);
      form.append('file', file);
      const res = await fetch(`/api/stores/${enc}/images`, { method: 'POST', body: form });
      const data = (await res.json()) as { error?: string; image?: { url: string } };
      if (!res.ok || !data.image) {
        setUploadError(data.error || 'Upload failed.');
        return;
      }
      if (kind === 'logo') setLogoUrl(data.image.url);
      else setBannerUrl(data.image.url);
      haptic('success');
    } catch {
      setUploadError('Network error.');
    } finally {
      setUploadBusy(null);
    }
  }

  async function regenerate() {
    if (!window.confirm('Generate a new white-label link? The old link will stop working.')) return;
    setWlBusy(true);
    try {
      const res = await fetch(`/api/stores/${enc}/whitelabel/regenerate`, { method: 'POST' });
      const data = (await res.json()) as { whitelabel_token?: string };
      if (res.ok && data.whitelabel_token) {
        setWlToken(data.whitelabel_token);
        haptic('success');
      }
    } catch {
      /* best effort */
    } finally {
      setWlBusy(false);
    }
  }

  function wlUrl(): string {
    if (!wlToken) return '';
    return `${window.location.origin}/s/${wlToken}`;
  }

  async function copy(text: string, which: 'link' | 'token') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopied(which);
    setTimeout(() => setCopied(null), 1800);
  }

  async function createToken() {
    setTokenError(null);
    setNewToken(null);
    setTokenBusy(true);
    try {
      const res = await fetch(`/api/stores/${enc}/api-tokens`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: tokenName.trim() || 'My app' }),
      });
      const data = (await res.json()) as { token?: { id: string; token: string; name: string } };
      if (!res.ok || !data.token) {
        setTokenError('Could not create the token.');
        return;
      }
      setNewToken(data.token.token);
      setTokenName('');
      haptic('success');
      void load();
    } catch {
      setTokenError('Network error.');
    } finally {
      setTokenBusy(false);
    }
  }

  async function revokeToken(id: string) {
    if (!window.confirm('Revoke this API token? Apps using it will stop working.')) return;
    try {
      await fetch(`/api/stores/${enc}/api-tokens/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
      haptic('tap');
      void load();
    } catch {
      /* best effort */
    }
  }

  return (
    <>
      {/* Logo + banner */}
      <h3 style={{ marginTop: 36 }}>Profile branding</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, maxWidth: 640 }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Logo</div>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="Store logo" style={{ width: 96, height: 96, borderRadius: 20, objectFit: 'cover', border: '1px solid var(--line)' }} />
          ) : (
            <div style={{ width: 96, height: 96, borderRadius: 20, background: 'var(--paper-2)', border: '1px dashed var(--line)', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No logo
            </div>
          )}
          <label className="btn btn-outline btn-sm" style={{ marginTop: 10, cursor: 'pointer', display: 'inline-block' }}>
            {uploadBusy === 'logo' ? 'Uploading…' : 'Upload logo'}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploadBusy !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload('logo', f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Banner</div>
          {bannerUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bannerUrl} alt="Store banner" style={{ width: '100%', height: 96, borderRadius: 12, objectFit: 'cover', border: '1px solid var(--line)' }} />
          ) : (
            <div style={{ width: '100%', height: 96, borderRadius: 12, background: 'var(--paper-2)', border: '1px dashed var(--line)', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 13 }}>
              No banner
            </div>
          )}
          <label className="btn btn-outline btn-sm" style={{ marginTop: 10, cursor: 'pointer', display: 'inline-block' }}>
            {uploadBusy === 'banner' ? 'Uploading…' : 'Upload banner'}
            <input
              type="file"
              accept="image/*"
              hidden
              disabled={uploadBusy !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload('banner', f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
      {uploadError && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{uploadError}</div>}
      <p className="hint">Logo and banner show on your public store page and your white-label storefront.</p>

      {/* White-label link */}
      <h3 style={{ marginTop: 36 }}>Your private store link</h3>
      <p style={{ color: 'var(--muted)', fontSize: 14.5, maxWidth: 640 }}>
        A unique link that looks nothing like ours. Put it in your own Telegram Mini App —
        visitors see <strong>only your store</strong>: your logo, your products, no Digitalsale
        branding. Checkout still runs through our payment gateway.
      </p>
      {wlToken ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', maxWidth: 640 }}>
          <code className="ref-code" style={{ fontSize: 13, wordBreak: 'break-all' }}>{wlUrl()}</code>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void copy(wlUrl(), 'link')}>
            {copied === 'link' ? 'Copied!' : 'Copy'}
          </button>
          <button type="button" className="btn btn-outline btn-sm" disabled={wlBusy} onClick={() => void regenerate()}>
            {wlBusy ? '…' : 'Regenerate'}
          </button>
        </div>
      ) : (
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</p>
      )}

      {/* API tokens */}
      <h3 style={{ marginTop: 36 }}>API tokens</h3>
      <p style={{ color: 'var(--muted)', fontSize: 14.5, maxWidth: 640 }}>
        List products from your own web app or mini app. Keep tokens secret — they act as your store.
      </p>
      {tokens.length > 0 && (
        <div className="table-wrap" style={{ marginBottom: 16, maxWidth: 640 }}>
          <table className="data">
            <thead>
              <tr><th>Name</th><th>Last used</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{t.last_used_at ? new Date(t.last_used_at.replace(' ', 'T') + 'Z').toLocaleDateString() : 'never'}</td>
                  <td>
                    <span className={`chip ${t.revoked ? 'badge-suspended' : 'badge-published'}`}>
                      {t.revoked ? 'revoked' : 'active'}
                    </span>
                  </td>
                  <td>
                    {!t.revoked && (
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => void revokeToken(t.id)}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {newToken && (
        <div className="panel" style={{ maxWidth: 640, borderColor: 'var(--ember)' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Your new token — copy it now, it won&apos;t be shown again</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <code className="ref-code" style={{ fontSize: 13, wordBreak: 'break-all' }}>{newToken}</code>
            <button type="button" className="btn btn-dark btn-sm" onClick={() => void copy(newToken, 'token')}>
              {copied === 'token' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, maxWidth: 420, marginTop: newToken ? 12 : 0 }}>
        <input
          className="input"
          placeholder="Token name, e.g. My mini app"
          value={tokenName}
          onChange={(e) => setTokenName(e.target.value)}
          disabled={tokenBusy}
          maxLength={60}
        />
        <button type="button" className="btn btn-dark btn-sm" style={{ flex: 'none' }} disabled={tokenBusy} onClick={() => void createToken()}>
          {tokenBusy ? '…' : 'Create token'}
        </button>
      </div>
      {tokenError && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{tokenError}</div>}
      <div className="panel" style={{ marginTop: 20, maxWidth: 640 }}>
        <h4 style={{ margin: '0 0 8px' }}>Seller API</h4>
        <code className="ref-code" style={{ display: 'block', whiteSpace: 'pre-wrap', fontSize: 12.5 }}>
{`# List your products
curl -H "Authorization: Bearer dst_..." /api/v1/products

# Create a product from your own app
curl -X POST -H "Authorization: Bearer dst_..." \\
  -H "Content-Type: application/json" \\
  -d '{"title":"My preset pack","price":19.99,
       "category":"Presets","status":"published"}' \\
  /api/v1/products`}
        </code>
      </div>
    </>
  );
}
