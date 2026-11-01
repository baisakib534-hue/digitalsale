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
  const [copied, setCopied] = useState<'link' | 'token' | 'custom' | null>(null);

  // v13: customizable store link
  const [customSlug, setCustomSlug] = useState<string | null>(null);
  const [slugInput, setSlugInput] = useState('');
  const [slugBusy, setSlugBusy] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);

  // v13: storefront theme customizer
  const [theme, setTheme] = useState({ accent: '#EA580C', mode: 'auto', layout: 'grid', showBanner: true, showSocials: true });
  const [themeBusy, setThemeBusy] = useState(false);
  const [themeSaved, setThemeSaved] = useState(false);

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
        store: {
          avatar_url: string | null;
          banner_url: string | null;
          whitelabel_token: string | null;
          custom_slug: string | null;
          theme_json: string | null;
        };
      };
      setLogoUrl(data.store.avatar_url);
      setBannerUrl(data.store.banner_url);
      setWlToken(data.store.whitelabel_token);
      setCustomSlug(data.store.custom_slug ?? null);
      setSlugInput(data.store.custom_slug ?? '');
      try {
        const t = JSON.parse(data.store.theme_json ?? '{}');
        setTheme({
          accent: typeof t.accent === 'string' ? t.accent : '#EA580C',
          mode: t.mode === 'light' || t.mode === 'dark' ? t.mode : 'auto',
          layout: t.layout === 'list' ? 'list' : 'grid',
          showBanner: t.showBanner !== false,
          showSocials: t.showSocials !== false,
        });
      } catch {
        /* keep defaults */
      }
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

  function customUrl(): string {
    if (!customSlug) return '';
    return `${window.location.origin}/s/${customSlug}`;
  }

  const SLUG_ERRORS: Record<string, string> = {
    'slug-empty': 'Type a link name, or clear it to remove your custom link.',
    'slug-invalid': 'Use 3–30 characters: lowercase letters, numbers and hyphens.',
    'slug-reserved': 'That name is reserved — pick another one.',
    'slug-taken': 'Someone already took that link — try another one.',
  };

  async function saveSlug() {
    setSlugError(null);
    setSlugBusy(true);
    try {
      const res = await fetch(`/api/stores/${enc}/custom-link`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: slugInput.trim() === '' ? null : slugInput }),
      });
      const data = (await res.json()) as { custom_slug?: string | null; error?: string };
      if (!res.ok) {
        setSlugError(SLUG_ERRORS[data.error ?? ''] ?? 'Could not save the link.');
        return;
      }
      setCustomSlug(data.custom_slug ?? null);
      setSlugInput(data.custom_slug ?? '');
      haptic('success');
    } catch {
      setSlugError('Network error.');
    } finally {
      setSlugBusy(false);
    }
  }

  async function saveTheme(next: typeof theme) {
    setTheme(next);
    setThemeSaved(false);
    setThemeBusy(true);
    try {
      const res = await fetch(`/api/stores/${enc}/theme`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ theme: next }),
      });
      if (res.ok) {
        setThemeSaved(true);
        haptic('success');
        setTimeout(() => setThemeSaved(false), 2000);
      }
    } catch {
      /* best effort */
    } finally {
      setThemeBusy(false);
    }
  }

  const ACCENTS = ['#EA580C', '#DC2626', '#D97706', '#65A30D', '#16A34A', '#0D9488', '#0891B2', '#2563EB', '#4F46E5', '#9333EA', '#DB2777', '#1C1917'];

  async function copy(text: string, which: 'link' | 'token' | 'custom') {
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

      {/* v13: customizable store link */}
      <h3 style={{ marginTop: 36 }}>Your custom store link</h3>
      <p style={{ color: 'var(--muted)', fontSize: 14.5, maxWidth: 640 }}>
        Pick a readable link for your storefront instead of the random one above — first come,
        first served. One link per store, and a link can only belong to one store.
      </p>
      <div style={{ display: 'flex', gap: 8, maxWidth: 480 }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden', background: 'var(--card)' }}>
          <span style={{ padding: '0 4px 0 16px', color: 'var(--muted)', fontSize: 14, whiteSpace: 'nowrap' }}>
            {typeof window !== 'undefined' ? `${window.location.host}/s/` : '/s/'}
          </span>
          <input
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="mystore"
            maxLength={30}
            disabled={slugBusy}
            style={{ flex: 1, minWidth: 0, border: 'none', background: 'transparent', outline: 'none', padding: '12px 16px 12px 0', fontSize: 15, color: 'var(--ink)' }}
            aria-label="Custom store link"
          />
        </div>
        <button type="button" className="btn btn-dark btn-sm" style={{ flex: 'none' }} disabled={slugBusy} onClick={() => void saveSlug()}>
          {slugBusy ? '…' : 'Save'}
        </button>
      </div>
      {slugError && <div className="form-error" role="alert" style={{ marginTop: 12, maxWidth: 480 }}>{slugError}</div>}
      {customSlug && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 12, maxWidth: 640 }}>
          <code className="ref-code" style={{ fontSize: 13, wordBreak: 'break-all' }}>{customUrl()}</code>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => void copy(customUrl(), 'custom')}>
            {copied === 'custom' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
      <p className="hint">Clear the field and save to remove your custom link — the random link above keeps working.</p>

      {/* v13: storefront design customizer */}
      <h3 style={{ marginTop: 36 }}>Storefront design</h3>
      <p style={{ color: 'var(--muted)', fontSize: 14.5, maxWidth: 640 }}>
        Customize how your white-label storefront looks — changes apply instantly.
      </p>
      <div className="panel" style={{ maxWidth: 640 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Accent color</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 20 }}>
          {ACCENTS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Accent ${c}`}
              onClick={() => void saveTheme({ ...theme, accent: c })}
              style={{
                width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                border: theme.accent.toUpperCase() === c ? '3px solid var(--ink)' : '1px solid var(--line)',
                outline: 'none',
              }}
            />
          ))}
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(theme.accent) ? theme.accent : '#EA580C'}
            onChange={(e) => void saveTheme({ ...theme, accent: e.target.value.toUpperCase() })}
            title="Custom color"
            style={{ width: 32, height: 32, border: '1px dashed var(--line)', borderRadius: '50%', padding: 2, background: 'transparent', cursor: 'pointer' }}
          />
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Color scheme</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['auto', 'light', 'dark'] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`btn btn-sm ${theme.mode === m ? 'btn-dark' : 'btn-outline'}`}
              onClick={() => void saveTheme({ ...theme, mode: m })}
            >
              {m === 'auto' ? 'Auto' : m === 'light' ? 'Light' : 'Dark'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 10 }}>Product layout</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {(['grid', 'list'] as const).map((l) => (
            <button
              key={l}
              type="button"
              className={`btn btn-sm ${theme.layout === l ? 'btn-dark' : 'btn-outline'}`}
              onClick={() => void saveTheme({ ...theme, layout: l })}
            >
              {l === 'grid' ? 'Grid' : 'List'}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          {([
            ['showBanner', 'Show banner'],
            ['showSocials', 'Show social links'],
          ] as const).map(([key, label]) => (
            <label key={key} className="check-row">
              <input
                type="checkbox"
                checked={theme[key]}
                onChange={(e) => void saveTheme({ ...theme, [key]: e.target.checked })}
              />
              <span style={{ fontSize: 14.5 }}>{label}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: themeSaved ? 'var(--mint)' : 'var(--muted)' }}>
          {themeBusy ? 'Saving…' : themeSaved ? 'Saved ✓' : ' '}
        </div>
      </div>
      {/* Live preview */}
      <div style={{ marginTop: 16, maxWidth: 640 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>Preview</div>
        <div
          data-theme={theme.mode === 'auto' ? undefined : theme.mode}
          style={{
            border: '1px solid var(--line)', borderRadius: 16, overflow: 'hidden',
            background: 'var(--card)',
            ['--wl-accent' as string]: theme.accent,
          }}
        >
          {theme.showBanner && (
            <div style={{ height: 72, background: bannerUrl ? `url(${bannerUrl}) center/cover` : 'var(--paper-2)' }} />
          )}
          <div style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover' }} />
            ) : (
              <span style={{
                width: 44, height: 44, borderRadius: 12, display: 'grid', placeItems: 'center',
                fontWeight: 700, background: 'var(--paper-2)', color: theme.accent, fontSize: 20,
              }}>S</span>
            )}
            <div>
              <div style={{ fontWeight: 700 }}>Your store</div>
              {theme.showSocials && <div style={{ fontSize: 12.5, color: 'var(--muted)' }}>social links row</div>}
            </div>
          </div>
          <div className={theme.layout === 'list' ? 'wl-list' : 'product-grid'} style={{ padding: '0 16px 16px', gap: 10 }}>
            {[1, 2, 3].map((i) => (
              <span key={i} className="wl-card" style={theme.layout === 'list' ? { display: 'flex', alignItems: 'center', gap: 12 } : undefined}>
                <span className="wl-card-cover" style={theme.layout === 'list' ? { width: 72, flex: 'none', aspectRatio: '1', borderRadius: 10, overflow: 'hidden' } : undefined} />
                <span className="wl-card-body" style={theme.layout === 'list' ? { padding: '10px 12px 10px 0' } : undefined}>
                  <span className="wl-card-title" style={{ fontSize: 13 }}>Product {i}</span>
                  <span className="wl-card-price">$9.00</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

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
