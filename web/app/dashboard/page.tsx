'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import EmptyState, { BasketGlyph, SproutGlyph } from '../../components/EmptyState';
import { CATEGORIES, isCategory } from '../../lib/categories';
import { formatUsd, shortId, timeAgo } from '../../lib/format';
import { haptic } from '../../lib/telegram-client';
import StoreProfileExtras from '../../components/StoreProfileExtras';

interface Me {
  id: string;
  name: string;
  email: string | null;
  hasStore: boolean;
  storeSlug: string | null;
  telegramVerified: boolean;
}

interface ProductRow {
  id: string;
  title: string;
  description: string;
  price_usd: number;
  category: string;
  tags: string;
  status: string;
  flagged: number;
  video_url: string | null;
  stock_limit: number | null;
  license_keys: number | null;
  affiliate_enabled: number | null;
  affiliate_commission: number | null;
  store_name: string;
  store_slug: string;
  created_at: string;
}

interface ImageRow {
  id: string;
  filename: string;
  mime: string;
  size: number;
  position: number;
  created_at: string;
}

interface LicenseRow {
  id: string;
  license_key: string;
  status: string;
  activations: number;
  max_activations: number | null;
  created_at: string;
  revoked_at: string | null;
}

interface DiscountRow {
  id: string;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  max_uses: number | null;
  used_count: number;
  active: number;
  expires_at: string | null;
  created_at: string;
}

/** Persistent banner for accounts that haven't verified with Telegram yet (v3). */
function VerifyBanner() {
  return (
    <div className="verify-banner" role="alert">
      <div>
        <strong>Verify with Telegram to start selling.</strong>
        <span> Every seller verifies once — it keeps fake stores and scammers out.</span>
      </div>
      <Link href="/verify" className="btn btn-primary btn-sm">
        Verify now
      </Link>
    </div>
  );
}

interface OrderRow {
  id: string;
  product_id: string;
  product_title: string;
  buyer_email: string;
  amount_usd: number;
  fee_usd: number;
  seller_usd: number;
  status: string;
  created_at: string;
}

interface FileRow {
  id: string;
  filename: string;
  size: number;
  provider: string;
}

interface StoreRow {
  id: string;
  name: string;
  slug: string;
  bio: string;
  payout_usdt_address: string;
  avatar_url: string | null;
  banner_url: string | null;
  socials: string | null;
  whitelabel_token: string | null;
}

type Tab = 'overview' | 'products' | 'orders' | 'store';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
  { id: 'store', label: 'Store settings' },
];

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function DashboardPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<'loading' | 'no-store' | 'ready'>('loading');
  const [me, setMe] = useState<Me | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  // create-store form
  const [storeName, setStoreName] = useState('');
  const [storeBio, setStoreBio] = useState('');
  const [storeBusy, setStoreBusy] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);

  // new product form
  const [np, setNp] = useState({ title: '', description: '', price: '', category: 'Presets', tags: '', videoUrl: '', status: 'draft', stockLimited: false, stockLimit: '', licenseKeys: false, affiliateEnabled: false, affiliateCommission: 20 });
  const [npBusy, setNpBusy] = useState(false);
  const [npError, setNpError] = useState<string | null>(null);

  // edit product
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ title: '', description: '', price: '', category: '', tags: '', videoUrl: '', status: 'draft', stockLimited: false, stockLimit: '', licenseKeys: false, affiliateEnabled: false, affiliateCommission: 20 });
  const [editFiles, setEditFiles] = useState<FileRow[]>([]);
  const [editImages, setEditImages] = useState<ImageRow[]>([]);
  const [editLicenses, setEditLicenses] = useState<LicenseRow[]>([]);
  const [editDiscounts, setEditDiscounts] = useState<DiscountRow[]>([]);
  const [dcCode, setDcCode] = useState('');
  const [dcKind, setDcKind] = useState<'percent' | 'fixed'>('percent');
  const [dcValue, setDcValue] = useState('');
  const [dcMaxUses, setDcMaxUses] = useState('');
  const [dcBusy, setDcBusy] = useState(false);
  const [dcError, setDcError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  // store settings
  const [settings, setSettings] = useState({ name: '', bio: '', payout: '' });
  const [socials, setSocials] = useState({ website: '', x: '', instagram: '', youtube: '', telegram: '' });
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const meRes = await fetch('/api/me', { cache: 'no-store' });
    if (!meRes.ok) {
      router.replace('/auth');
      return;
    }
    const meJson = (await meRes.json()) as { user: Me };
    setMe(meJson.user);
    if (!meJson.user.hasStore || !meJson.user.storeSlug) {
      setPhase('no-store');
      return;
    }
    const [pRes, oRes, sRes] = await Promise.all([
      fetch('/api/products?mine=1', { cache: 'no-store' }),
      fetch('/api/orders', { cache: 'no-store' }),
      fetch(`/api/stores/${encodeURIComponent(meJson.user.storeSlug)}`, { cache: 'no-store' }),
    ]);
    if (pRes.ok) setProducts(((await pRes.json()) as { products: ProductRow[] }).products ?? []);
    if (oRes.ok) setOrders(((await oRes.json()) as { orders: OrderRow[] }).orders ?? []);
    if (sRes.ok) {
      const s = ((await sRes.json()) as { store: StoreRow }).store;
      setSettings({ name: s.name, bio: s.bio, payout: s.payout_usdt_address });
      try {
        const parsed = JSON.parse(s.socials || '{}') as Record<string, string>;
        setSocials({
          website: parsed.website || '',
          x: parsed.x || '',
          instagram: parsed.instagram || '',
          youtube: parsed.youtube || '',
          telegram: parsed.telegram || '',
        });
      } catch {
        /* keep defaults */
      }
    }
    setPhase('ready');
  }, [router]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function flash(msg: string) {
    setNotice(msg);
    window.setTimeout(() => setNotice(null), 4000);
  }

  async function createStore(e: React.FormEvent) {
    e.preventDefault();
    setStoreError(null);
    if (storeName.trim().length < 2) {
      setStoreError('Give your store a name — at least 2 characters.');
      return;
    }
    setStoreBusy(true);
    try {
      const res = await fetch('/api/stores', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: storeName.trim(), bio: storeBio.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setStoreError(
          res.status === 409
            ? 'You already have a store.'
            : data.error === 'telegram-verification-required'
              ? 'Verify with Telegram first — then you can open your store.'
              : data.error || 'Could not create the store.'
        );
        return;
      }
      haptic('success');
      await reload();
    } catch {
      setStoreError('Network error. Try again.');
    } finally {
      setStoreBusy(false);
    }
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setNpError(null);
    const price = Number(np.price);
    if (np.title.trim().length < 3) {
      setNpError('Give your product a title — at least 3 characters.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setNpError('Enter a price above $0.');
      return;
    }
    if (!isCategory(np.category)) {
      setNpError('Pick a category.');
      return;
    }
    setNpBusy(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: np.title.trim(),
          description: np.description.trim(),
          price,
          category: np.category,
          tags: np.tags.trim(),
          videoUrl: np.videoUrl.trim(),
          status: np.status === 'published' ? 'published' : 'draft',
          stockLimit: np.stockLimited && np.stockLimit.trim() !== '' ? Number(np.stockLimit) : null,
          licenseKeys: np.licenseKeys,
          affiliateEnabled: np.affiliateEnabled,
          affiliateCommission: np.affiliateCommission,
        }),
      });
      const data = (await res.json()) as { error?: string; product?: ProductRow };
      if (!res.ok || !data.product) {
        setNpError(
          data.error === 'telegram-verification-required'
            ? 'Verify with Telegram first — then you can list products.'
            : data.error === 'invalid-video-url'
              ? 'That YouTube link doesn’t look right — paste a normal youtube.com or youtu.be URL.'
              : data.error === 'invalid-stock-limit'
                ? 'The buyer limit must be a whole number above 0.'
                : data.error || 'Could not create the product.'
        );
        return;
      }
      haptic('success');
      setNp({ title: '', description: '', price: '', category: 'Presets', tags: '', videoUrl: '', status: 'draft', stockLimited: false, stockLimit: '', licenseKeys: false, affiliateEnabled: false, affiliateCommission: 20 });
      flash(`“${data.product.title}” created as ${data.product.status}.`);
      await reload();
    } catch {
      setNpError('Network error. Try again.');
    } finally {
      setNpBusy(false);
    }
  }

  async function startEdit(p: ProductRow) {
    setEditingId(p.id);
    setEditError(null);
    setUploadError(null);
    try {
      const res = await fetch(`/api/products/${p.id}`, { cache: 'no-store' });
      if (!res.ok) {
        setEditError('Could not load the product.');
        return;
      }
      const data = (await res.json()) as { product: ProductRow & { files?: FileRow[]; images?: ImageRow[] } };
      setEdit({
        title: data.product.title,
        description: data.product.description,
        price: String(data.product.price_usd / 100),
        category: data.product.category,
        tags: data.product.tags,
        videoUrl: data.product.video_url ?? '',
        status: data.product.status,
        stockLimited: data.product.stock_limit !== null && data.product.stock_limit !== undefined,
        stockLimit: data.product.stock_limit != null ? String(data.product.stock_limit) : '',
        licenseKeys: data.product.license_keys === 1,
        affiliateEnabled: data.product.affiliate_enabled === 1,
        affiliateCommission: data.product.affiliate_commission ?? 20,
      });
      setEditFiles(data.product.files ?? []);
      setEditImages(data.product.images ?? []);
      // v10: license keys for this product.
      try {
        const lr = await fetch(`/api/products/${p.id}/licenses`, { cache: 'no-store' });
        if (lr.ok) {
          const ldata = (await lr.json()) as { keys: LicenseRow[] };
          setEditLicenses(ldata.keys ?? []);
        } else {
          setEditLicenses([]);
        }
      } catch {
        setEditLicenses([]);
      }
      // v11: discount codes for this product.
      try {
        const dr = await fetch(`/api/products/${p.id}/discounts`, { cache: 'no-store' });
        if (dr.ok) {
          const ddata = (await dr.json()) as { codes: DiscountRow[] };
          setEditDiscounts(ddata.codes ?? []);
        } else {
          setEditDiscounts([]);
        }
      } catch {
        setEditDiscounts([]);
      }
      setDcCode('');
      setDcValue('');
      setDcMaxUses('');
      setDcError(null);
    } catch {
      setEditError('Network error.');
    }
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);
    const price = Number(edit.price);
    if (edit.title.trim().length < 3) {
      setEditError('Title needs at least 3 characters.');
      return;
    }
    if (!Number.isFinite(price) || price <= 0) {
      setEditError('Enter a price above $0.');
      return;
    }
    if (!isCategory(edit.category)) {
      setEditError('Pick a category.');
      return;
    }
    setEditBusy(true);
    try {
      const res = await fetch(`/api/products/${editingId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: edit.title.trim(),
          description: edit.description.trim(),
          price,
          category: edit.category,
          tags: edit.tags.trim(),
          videoUrl: edit.videoUrl.trim(),
          status: edit.status,
          stockLimit: edit.stockLimited && edit.stockLimit.trim() !== '' ? Number(edit.stockLimit) : null,
          licenseKeys: edit.licenseKeys,
          affiliateEnabled: edit.affiliateEnabled,
          affiliateCommission: edit.affiliateCommission,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setEditError(
          data.error === 'telegram-verification-required'
            ? 'Verify with Telegram first — then you can edit products.'
            : data.error === 'invalid-video-url'
              ? 'That YouTube link doesn’t look right — paste a normal youtube.com or youtu.be URL.'
              : data.error === 'invalid-stock-limit'
                ? 'The buyer limit must be a whole number above 0.'
                : data.error || 'Could not save.'
        );
        return;
      }
      haptic('success');
      setEditingId(null);
      flash('Product updated.');
      await reload();
    } catch {
      setEditError('Network error.');
    } finally {
      setEditBusy(false);
    }
  }

  async function deleteProduct(p: ProductRow) {
    if (!window.confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    haptic('tap');
    const res = await fetch(`/api/products/${p.id}`, { method: 'DELETE' });
    if (res.ok || res.status === 204) {
      haptic('success');
      flash('Product deleted.');
      if (editingId === p.id) setEditingId(null);
      await reload();
    } else {
      flash('Could not delete the product.');
    }
  }

  async function uploadFile(productId: string, file: File) {
    setUploadError(null);
    if (file.size > 100 * 1024 * 1024) {
      setUploadError('Files are capped at 100 MB.');
      return;
    }
    setUploadBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/products/${productId}/files`, { method: 'POST', body: form });
      const data = (await res.json()) as { error?: string; file?: FileRow };
      if (!res.ok || !data.file) {
        setUploadError(data.error || 'Upload failed.');
        return;
      }
      haptic('success');
      setEditFiles((prev) => [...prev, data.file as FileRow]);
      flash(`“${data.file.filename}” archived and attached.`);
    } catch {
      setUploadError('Network error during upload.');
    } finally {
      setUploadBusy(false);
    }
  }

  async function uploadImage(productId: string, file: File) {
    setImageError(null);
    if (!file.type.startsWith('image/')) {
      setImageError('Please choose an image file (JPG, PNG, WebP…).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageError('Images are capped at 10 MB.');
      return;
    }
    if (editImages.length >= 8) {
      setImageError('Up to 8 pictures per product.');
      return;
    }
    setImageBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/products/${productId}/images`, { method: 'POST', body: form });
      const data = (await res.json()) as { error?: string; image?: ImageRow };
      if (!res.ok || !data.image) {
        setImageError(data.error || 'Upload failed.');
        return;
      }
      haptic('success');
      setEditImages((prev) => [...prev, data.image as ImageRow]);
      flash(`Picture added.`);
    } catch {
      setImageError('Network error during upload.');
    } finally {
      setImageBusy(false);
    }
  }

  async function deleteImage(productId: string, imageId: string) {
    setImageError(null);
    setImageBusy(true);
    try {
      const res = await fetch(`/api/products/${productId}/images?imageId=${encodeURIComponent(imageId)}`, { method: 'DELETE' });
      if (!res.ok) {
        setImageError('Could not delete the picture.');
        return;
      }
      setEditImages((prev) => prev.filter((im) => im.id !== imageId));
    } catch {
      setImageError('Network error.');
    } finally {
      setImageBusy(false);
    }
  }

  // v11: create + deactivate discount codes.
  async function createDiscountCode(productId: string) {
    setDcError(null);
    const value = Math.floor(Number(dcValue));
    if (!dcCode.trim()) {
      setDcError('Give the code a name, like SAVE20.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setDcError(dcKind === 'percent' ? 'Percent must be 1–90.' : 'Amount must be at least 1 cent.');
      return;
    }
    if (dcKind === 'percent' && value > 90) {
      setDcError('Percent must be 1–90.');
      return;
    }
    setDcBusy(true);
    try {
      const res = await fetch(`/api/products/${productId}/discounts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          code: dcCode,
          kind: dcKind,
          value,
          maxUses: dcMaxUses.trim() === '' ? null : dcMaxUses.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; code?: DiscountRow };
      if (!res.ok || !data.code) {
        const why: Record<string, string> = {
          'invalid-code': 'Use 3–24 letters, numbers or dashes.',
          'code-taken': 'You already have a code with that name.',
          'invalid-value': 'Check the discount value.',
          'percent-too-high': 'Percent must be 1–90.',
          'invalid-max-uses': 'Max uses must be at least 1.',
        };
        setDcError(why[data.error ?? ''] ?? 'Could not create the code.');
        return;
      }
      setEditDiscounts((prev) => [data.code!, ...prev]);
      setDcCode('');
      setDcValue('');
      setDcMaxUses('');
      haptic('success');
    } catch {
      setDcError('Network error.');
    } finally {
      setDcBusy(false);
    }
  }

  async function deactivateDiscountCode(productId: string, discountId: string) {
    try {
      const res = await fetch(`/api/products/${productId}/discounts/${discountId}/deactivate`, {
        method: 'POST',
      });
      if (!res.ok) return;
      setEditDiscounts((prev) => prev.map((d) => (d.id === discountId ? { ...d, active: 0 } : d)));
      haptic('tap');
    } catch {
      /* best effort */
    }
  }

  // v10: revoke a license key (buyer's software stops verifying).
  async function revokeLicense(productId: string, licenseId: string) {
    if (!window.confirm('Revoke this license key? The buyer\u2019s software will stop activating.')) return;
    try {
      const res = await fetch(`/api/products/${productId}/licenses/${licenseId}/revoke`, { method: 'POST' });
      if (!res.ok) return;
      setEditLicenses((prev) => prev.map((l) => (l.id === licenseId ? { ...l, status: 'revoked' } : l)));
      haptic('success');
    } catch {
      /* best effort */
    }
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!me?.storeSlug) return;
    setSettingsError(null);
    if (settings.name.trim().length < 2) {
      setSettingsError('Store name needs at least 2 characters.');
      return;
    }
    setSettingsBusy(true);
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(me.storeSlug)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: settings.name.trim(),
          bio: settings.bio.trim(),
          payout_usdt_address: settings.payout.trim(),
          socials,
        }),
      });
      const data = (await res.json()) as { error?: string; store?: StoreRow };
      if (!res.ok || !data.store) {
        setSettingsError(data.error || 'Could not save settings.');
        return;
      }
      haptic('success');
      setSettings({ name: data.store.name, bio: data.store.bio, payout: data.store.payout_usdt_address });
      flash('Store settings saved.');
      await reload();
    } catch {
      setSettingsError('Network error.');
    } finally {
      setSettingsBusy(false);
    }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
    router.refresh();
  }

  if (phase === 'loading') {
    return (
      <div className="wrap" style={{ padding: '88px 24px' }}>
        <div className="skeleton" style={{ height: 44, width: 280, marginBottom: 24 }} />
        <div className="skeleton" style={{ height: 180 }} />
      </div>
    );
  }

  if (phase === 'no-store') {
    return (
      <div className="wrap" style={{ padding: '88px 24px', maxWidth: 640 }}>
        <span className="eyebrow">Seller dashboard</span>
        <h1>Open your store</h1>
        {me && !me.telegramVerified && <VerifyBanner />}
        <p style={{ color: 'var(--muted)' }}>
          Hi {me?.name?.split(' ')[0] ?? 'there'} — one more step. Name your store and you can start
          listing products right away.
        </p>
        <form onSubmit={createStore} className="form-card" style={{ marginTop: 24 }} noValidate>
          <div className="field">
            <label htmlFor="store-name">Store name</label>
            <input
              id="store-name"
              className="input"
              placeholder="Fern & Field"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              disabled={storeBusy}
            />
          </div>
          <div className="field">
            <label htmlFor="store-bio">Short bio</label>
            <textarea
              id="store-bio"
              className="textarea"
              placeholder="What do you make? One or two sentences."
              value={storeBio}
              onChange={(e) => setStoreBio(e.target.value)}
              disabled={storeBusy}
            />
          </div>
          {storeError && <div className="form-error" role="alert">{storeError}</div>}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={storeBusy}>
            {storeBusy ? 'Opening your store…' : 'Open my store'}
          </button>
        </form>
        <p style={{ marginTop: 20, fontSize: 14 }}>
          <Link href="/dashboard/purchases">View my purchases</Link>
          {' · '}
          <button type="button" onClick={logout} style={{ background: 'none', border: 'none', padding: 0, color: 'var(--moss)', cursor: 'pointer', fontSize: 14 }}>
            Log out
          </button>
        </p>
      </div>
    );
  }

  const paid = orders.filter((o) => o.status === 'paid');
  const revenue = paid.reduce((s, o) => s + o.seller_usd, 0);
  const feePaid = paid.reduce((s, o) => s + o.fee_usd, 0);
  const recent = orders.slice(0, 5);
  const editing = editingId ? products.find((p) => p.id === editingId) ?? null : null;

  return (
    <div className="dash">
      {me && !me.telegramVerified && (
        <div style={{ padding: '16px 24px 0' }}>
          <VerifyBanner />
        </div>
      )}
      <aside className="dash-side">
        <nav aria-label="Dashboard">
          {TABS.map((t) => (
            <a
              key={t.id}
              href="#"
              className={tab === t.id ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                haptic('tap');
                setTab(t.id);
              }}
            >
              {t.label}
            </a>
          ))}
          <Link href="/dashboard/purchases" style={{ marginTop: 12 }}>
            My purchases
          </Link>
          {me?.storeSlug && (
            <Link href={`/store/${me.storeSlug}`}>View my store</Link>
          )}
        </nav>
        <div style={{ marginTop: 32, padding: '0 16px', fontSize: 13, color: 'rgba(250,245,234,0.6)' }}>
          <div style={{ fontWeight: 700, color: 'var(--paper)' }}>{me?.name}</div>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{me?.email ?? 'Telegram account'}</div>
          <button
            type="button"
            onClick={logout}
            style={{ background: 'none', border: 'none', padding: '8px 0 0', color: 'rgba(250,245,234,0.75)', cursor: 'pointer', fontSize: 13 }}
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="dash-main">
        <h1 style={{ marginBottom: 4 }}>Seller dashboard</h1>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          {me?.storeSlug ? (
            <>
              Selling as <Link href={`/store/${me.storeSlug}`}><strong>{products[0]?.store_name ?? me.storeSlug}</strong></Link>
            </>
          ) : null}
        </p>
        {notice && <div className="alert alert-info" role="status">{notice}</div>}

        {tab === 'overview' && (
          <div>
            <div className="stat-grid">
              <div className="stat-card">
                <div className="label">Revenue</div>
                <div className="value">{formatUsd(revenue)}</div>
                <div className="sub">your 90% share, paid orders</div>
              </div>
              <div className="stat-card">
                <div className="label">Orders</div>
                <div className="value">{orders.length}</div>
                <div className="sub">{paid.length} paid</div>
              </div>
              <div className="stat-card">
                <div className="label">Products</div>
                <div className="value">{products.length}</div>
                <div className="sub">{products.filter((p) => p.status === 'published').length} published</div>
              </div>
              <div className="stat-card">
                <div className="label">Platform fees paid</div>
                <div className="value">{formatUsd(feePaid)}</div>
                <div className="sub">flat 10% on paid orders</div>
              </div>
            </div>
            <div className="panel">
              <h3>Recent orders</h3>
              {recent.length === 0 ? (
                <EmptyState
                  glyph={<BasketGlyph />}
                  title="No orders yet"
                  body="Share your store link and your first sale will land here."
                />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr><th>Order</th><th>Product</th><th>Buyer</th><th>Your share</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                      {recent.map((o) => (
                        <tr key={o.id}>
                          <td><code>{shortId(o.id)}</code></td>
                          <td>{o.product_title}</td>
                          <td>{o.buyer_email || '—'}</td>
                          <td>{formatUsd(o.seller_usd)}</td>
                          <td><span className={`chip badge-${o.status}`}>{o.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'products' && (
          <div>
            <div className="panel">
              <h3>New product</h3>
              <form onSubmit={createProduct} noValidate>
                <div className="field">
                  <label htmlFor="np-title">Title</label>
                  <input id="np-title" className="input" value={np.title} onChange={(e) => setNp({ ...np, title: e.target.value })} disabled={npBusy} placeholder="Evergreen — 24 Lightroom Presets" />
                </div>
                <div className="field">
                  <label htmlFor="np-desc">Description</label>
                  <textarea id="np-desc" className="textarea" value={np.description} onChange={(e) => setNp({ ...np, description: e.target.value })} disabled={npBusy} placeholder="What does the buyer get? What's inside?" />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                  <div className="field">
                    <label htmlFor="np-price">Price (USD)</label>
                    <input id="np-price" className="input" type="number" min="0.01" step="0.01" value={np.price} onChange={(e) => setNp({ ...np, price: e.target.value })} disabled={npBusy} placeholder="24.00" />
                  </div>
                  <div className="field">
                    <label htmlFor="np-cat">Category</label>
                    <select id="np-cat" className="select" value={np.category} onChange={(e) => setNp({ ...np, category: e.target.value })} disabled={npBusy}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="np-status">Status</label>
                    <select id="np-status" className="select" value={np.status} onChange={(e) => setNp({ ...np, status: e.target.value })} disabled={npBusy}>
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                    </select>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="np-tags">Tags (comma-separated)</label>
                  <input id="np-tags" className="input" value={np.tags} onChange={(e) => setNp({ ...np, tags: e.target.value })} disabled={npBusy} placeholder="lightroom, presets, moody" />
                </div>
                <div className="field">
                  <label htmlFor="np-video">Demo video <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(YouTube link, optional)</span></label>
                  <input id="np-video" className="input" type="url" value={np.videoUrl} onChange={(e) => setNp({ ...np, videoUrl: e.target.value })} disabled={npBusy} placeholder="https://www.youtube.com/watch?v=…" />
                  <p className="hint">Paste a YouTube link — buyers can watch it right on your product page, fullscreen included.</p>
                </div>
                <div className="field">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={np.stockLimited}
                      onChange={(e) => setNp({ ...np, stockLimited: e.target.checked })}
                      disabled={npBusy}
                    />
                    <span><strong>Limit buyers</strong> <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(sell to a fixed number of people)</span></span>
                  </label>
                  {np.stockLimited && (
                    <>
                      <input
                        id="np-stock"
                        className="input"
                        type="number"
                        min={1}
                        step={1}
                        value={np.stockLimit}
                        onChange={(e) => setNp({ ...np, stockLimit: e.target.value })}
                        disabled={npBusy}
                        placeholder="e.g. 50"
                        style={{ marginTop: 10 }}
                      />
                      <p className="hint">When all spots sell out, the product unlists and shows “Sold out”. Leave the toggle off for unlimited sales.</p>
                    </>
                  )}
                </div>
                <div className="field">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={np.licenseKeys}
                      onChange={(e) => setNp({ ...np, licenseKeys: e.target.checked })}
                      disabled={npBusy}
                    />
                    <span><strong>License keys</strong> <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Gumroad-style — each buyer gets a unique key)</span></span>
                  </label>
                  <p className="hint">For software: every paid order gets a unique license key, and your app can verify it via our API.</p>
                </div>
                <div className="field">
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={np.affiliateEnabled}
                      onChange={(e) => setNp({ ...np, affiliateEnabled: e.target.checked })}
                      disabled={npBusy}
                    />
                    <span><strong>Enable affiliates</strong> — let promoters sell this for a commission</span>
                  </label>
                  {np.affiliateEnabled && (
                    <div style={{ marginTop: 12 }}>
                      <label htmlFor="np-commission">
                        Affiliate commission: <strong>{np.affiliateCommission}%</strong> of each sale
                      </label>
                      <input
                        id="np-commission"
                        type="range"
                        min={5}
                        max={60}
                        step={1}
                        value={np.affiliateCommission}
                        onChange={(e) => setNp({ ...np, affiliateCommission: Number(e.target.value) })}
                        disabled={npBusy}
                        className="range"
                      />
                    </div>
                  )}
                </div>
                {npError && <div className="form-error" role="alert">{npError}</div>}
                <button type="submit" className="btn btn-dark" disabled={npBusy}>
                  {npBusy ? 'Creating…' : 'Create product'}
                </button>
              </form>
            </div>

            <div className="panel">
              <h3>Your products</h3>
              {products.length === 0 ? (
                <EmptyState
                  glyph={<SproutGlyph />}
                  title="No products yet"
                  body="Create your first product above — it takes a minute, and you can keep it as a draft until it's ready."
                />
              ) : (
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr><th>Title</th><th>Price</th><th>Status</th><th>Affiliates</th><th>Listed</th><th></th></tr>
                    </thead>
                    <tbody>
                      {products.map((p) => (
                        <tr key={p.id}>
                          <td>
                            <strong>{p.title}</strong>
                            {p.flagged === 1 && (
                              <span className="chip badge-flagged" title="Flagged for review by our safety scan — not public, not blocking.">review</span>
                            )}
                          </td>
                          <td>{formatUsd(p.price_usd)}</td>
                          <td><span className={`chip badge-${p.status}`}>{p.status}</span>
                            {p.stock_limit != null && (
                              <span className="chip" title={`${p.stock_limit} buyer limit`} style={{ marginLeft: 6 }}>
                                cap {p.stock_limit}
                              </span>
                            )}
                          </td>
                          <td>
                            {p.affiliate_enabled === 1 ? (
                              <span className="chip badge-aff">{p.affiliate_commission}% on</span>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>off</span>
                            )}
                          </td>
                          <td>{timeAgo(p.created_at)}</td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => { haptic('tap'); void startEdit(p); }}>
                              Edit
                            </button>{' '}
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => void deleteProduct(p)}>
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {editing && (
              <div className="panel" style={{ borderColor: 'var(--moss)' }}>
                <h3>Editing: {editing.title}</h3>
                <form onSubmit={saveEdit} noValidate>
                  <div className="field">
                    <label htmlFor="edit-title">Title</label>
                    <input id="edit-title" className="input" value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} disabled={editBusy} />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-desc">Description</label>
                    <textarea id="edit-desc" className="textarea" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} disabled={editBusy} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                    <div className="field">
                      <label htmlFor="edit-price">Price (USD)</label>
                      <input id="edit-price" className="input" type="number" min="0.01" step="0.01" value={edit.price} onChange={(e) => setEdit({ ...edit, price: e.target.value })} disabled={editBusy} />
                    </div>
                    <div className="field">
                      <label htmlFor="edit-cat">Category</label>
                      <select id="edit-cat" className="select" value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })} disabled={editBusy}>
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="edit-status">Status</label>
                      <select id="edit-status" className="select" value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} disabled={editBusy}>
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label htmlFor="edit-tags">Tags (comma-separated)</label>
                    <input id="edit-tags" className="input" value={edit.tags} onChange={(e) => setEdit({ ...edit, tags: e.target.value })} disabled={editBusy} />
                  </div>
                  <div className="field">
                    <label htmlFor="edit-video">Demo video <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(YouTube link, optional)</span></label>
                    <input id="edit-video" className="input" type="url" value={edit.videoUrl} onChange={(e) => setEdit({ ...edit, videoUrl: e.target.value })} disabled={editBusy} placeholder="https://www.youtube.com/watch?v=…" />
                    <p className="hint">Paste a YouTube link — buyers can watch it right on your product page, fullscreen included. Clear the field to remove the video.</p>
                  </div>
                  <div className="field">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={edit.stockLimited}
                        onChange={(e) => setEdit({ ...edit, stockLimited: e.target.checked })}
                        disabled={editBusy}
                      />
                      <span><strong>Limit buyers</strong> <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(sell to a fixed number of people)</span></span>
                    </label>
                    {edit.stockLimited && (
                      <>
                        <input
                          id="edit-stock"
                          className="input"
                          type="number"
                          min={1}
                          step={1}
                          value={edit.stockLimit}
                          onChange={(e) => setEdit({ ...edit, stockLimit: e.target.value })}
                          disabled={editBusy}
                          placeholder="e.g. 50"
                          style={{ marginTop: 10 }}
                        />
                        <p className="hint">When all spots sell out, the product unlists and shows “Sold out”. Leave the toggle off for unlimited sales.</p>
                      </>
                    )}
                  </div>
                  <div className="field">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={edit.licenseKeys}
                        onChange={(e) => setEdit({ ...edit, licenseKeys: e.target.checked })}
                        disabled={editBusy}
                      />
                      <span><strong>License keys</strong> <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(Gumroad-style — each buyer gets a unique key)</span></span>
                    </label>
                    <p className="hint">For software: every paid order gets a unique license key, and your app can verify it via our API.</p>
                  </div>
                  <div className="field">
                    <label>Pictures <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({editImages.length}/8)</span></label>
                    {editImages.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                        {editImages.map((im) => (
                          <div key={im.id} style={{ position: 'relative', width: 96, height: 72, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--line)' }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/images/${im.id}`} alt={im.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              type="button"
                              aria-label={`Delete ${im.filename}`}
                              disabled={imageBusy}
                              onClick={() => { if (editingId) void deleteImage(editingId, im.id); }}
                              style={{
                                position: 'absolute', top: 4, right: 4, width: 24, height: 24,
                                borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.65)',
                                color: '#fff', cursor: 'pointer', fontSize: 14, lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={imageBusy || editImages.length >= 8}
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []);
                        e.target.value = '';
                        if (editingId) {
                          for (const f of files.slice(0, 8 - editImages.length)) void uploadImage(editingId, f);
                        }
                      }}
                      aria-label="Upload product pictures"
                    />
                    <p className="hint">JPG, PNG or WebP, up to 10 MB each. These show in a gallery on your product page.</p>
                    {imageError && <div className="form-error" role="alert">{imageError}</div>}
                  </div>
                  <div className="field">
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={edit.affiliateEnabled}
                        onChange={(e) => setEdit({ ...edit, affiliateEnabled: e.target.checked })}
                        disabled={editBusy}
                      />
                      <span><strong>Enable affiliates</strong> — let promoters sell this for a commission</span>
                    </label>
                    {edit.affiliateEnabled && (
                      <div style={{ marginTop: 12 }}>
                        <label htmlFor="edit-commission">
                          Affiliate commission: <strong>{edit.affiliateCommission}%</strong> of each sale
                        </label>
                        <input
                          id="edit-commission"
                          type="range"
                          min={5}
                          max={60}
                          step={1}
                          value={edit.affiliateCommission}
                          onChange={(e) => setEdit({ ...edit, affiliateCommission: Number(e.target.value) })}
                          disabled={editBusy}
                          className="range"
                        />
                      </div>
                    )}
                  </div>
                  {editError && <div className="form-error" role="alert">{editError}</div>}
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button type="submit" className="btn btn-dark" disabled={editBusy}>
                      {editBusy ? 'Saving…' : 'Save changes'}
                    </button>
                    <button type="button" className="btn btn-outline" onClick={() => setEditingId(null)}>
                      Cancel
                    </button>
                  </div>
                </form>

                <h3 style={{ marginTop: 36 }}>Files</h3>
                {editFiles.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>
                    No files attached yet. Buyers can only download what you attach here.
                  </p>
                ) : (
                  <div className="table-wrap" style={{ marginBottom: 20 }}>
                    <table className="data">
                      <thead>
                        <tr><th>Filename</th><th>Size</th><th>Archived</th></tr>
                      </thead>
                      <tbody>
                        {editFiles.map((f) => (
                          <tr key={f.id}>
                            <td><code>{f.filename}</code></td>
                            <td>{fmtSize(f.size)}</td>
                            <td><span className="chip">{f.provider === 'telegram' ? 'Telegram channel' : 'Local disk'}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="field" style={{ maxWidth: 480 }}>
                  <label htmlFor="file-upload">Attach a file (max 100 MB)</label>
                  <input
                    id="file-upload"
                    type="file"
                    className="input"
                    disabled={uploadBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f && editingId) void uploadFile(editingId, f);
                      e.target.value = '';
                    }}
                  />
                  {uploadBusy && <p className="form-note" style={{ marginTop: 12 }}>Uploading and archiving…</p>}
                  {uploadError && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{uploadError}</div>}
                </div>

                <h3 style={{ marginTop: 36 }}>License keys</h3>
                {editLicenses.length === 0 ? (
                  <p style={{ color: 'var(--muted)', fontSize: 14.5 }}>
                    No keys issued yet. {edit.licenseKeys ? 'Keys are created automatically with each paid order.' : 'Turn on “License keys” above and save — every paid order will get a unique key.'}
                  </p>
                ) : (
                  <div className="table-wrap" style={{ marginBottom: 20 }}>
                    <table className="data">
                      <thead>
                        <tr><th>Key</th><th>Status</th><th>Activations</th><th>Issued</th><th></th></tr>
                      </thead>
                      <tbody>
                        {editLicenses.map((l) => (
                          <tr key={l.id}>
                            <td><code className="ref-code" style={{ fontSize: 13 }}>{l.license_key}</code></td>
                            <td>
                              <span className={`chip ${l.status === 'active' ? 'badge-published' : 'badge-suspended'}`}>
                                {l.status}
                              </span>
                            </td>
                            <td>{l.activations}{l.max_activations != null ? ` / ${l.max_activations}` : ''}</td>
                            <td style={{ color: 'var(--muted)', fontSize: 13 }}>{timeAgo(l.created_at)}</td>
                            <td>
                              {l.status === 'active' && editingId && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => void revokeLicense(editingId, l.id)}
                                >
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
                <h3 style={{ marginTop: 36 }}>Discount codes</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14.5, marginTop: 0 }}>
                  Promo codes buyers apply at checkout — percent off or a fixed amount off.
                </p>
                {editDiscounts.length > 0 && (
                  <div className="table-wrap" style={{ marginBottom: 20 }}>
                    <table className="data">
                      <thead>
                        <tr><th>Code</th><th>Discount</th><th>Uses</th><th>Status</th><th></th></tr>
                      </thead>
                      <tbody>
                        {editDiscounts.map((d) => (
                          <tr key={d.id}>
                            <td><code className="ref-code" style={{ fontSize: 13 }}>{d.code}</code></td>
                            <td>{d.kind === 'percent' ? `${d.value}% off` : `${formatUsd(d.value)} off`}</td>
                            <td>{d.used_count}{d.max_uses != null ? ` / ${d.max_uses}` : ''}</td>
                            <td>
                              <span className={`chip ${d.active === 1 ? 'badge-published' : 'badge-suspended'}`}>
                                {d.active === 1 ? 'active' : 'off'}
                              </span>
                            </td>
                            <td>
                              {d.active === 1 && editingId && (
                                <button
                                  type="button"
                                  className="btn btn-outline btn-sm"
                                  onClick={() => void deactivateDiscountCode(editingId, d.id)}
                                >
                                  Deactivate
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 560 }}>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="dc-code">Code</label>
                    <input
                      id="dc-code"
                      className="input"
                      placeholder="SAVE20"
                      value={dcCode}
                      onChange={(e) => setDcCode(e.target.value.toUpperCase())}
                      disabled={dcBusy}
                      maxLength={24}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="dc-kind">Type</label>
                    <select
                      id="dc-kind"
                      className="input"
                      value={dcKind}
                      onChange={(e) => setDcKind(e.target.value as 'percent' | 'fixed')}
                      disabled={dcBusy}
                    >
                      <option value="percent">Percent %</option>
                      <option value="fixed">Fixed amount (cents)</option>
                    </select>
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="dc-value">{dcKind === 'percent' ? 'Percent (1–90)' : 'Cents off'}</label>
                    <input
                      id="dc-value"
                      className="input"
                      type="number"
                      min={1}
                      max={dcKind === 'percent' ? 90 : undefined}
                      placeholder={dcKind === 'percent' ? '20' : '500'}
                      value={dcValue}
                      onChange={(e) => setDcValue(e.target.value)}
                      disabled={dcBusy}
                    />
                  </div>
                  <div className="field" style={{ margin: 0 }}>
                    <label htmlFor="dc-max">Max uses <span style={{ fontWeight: 400, color: 'var(--muted)' }}>(blank = unlimited)</span></label>
                    <input
                      id="dc-max"
                      className="input"
                      type="number"
                      min={1}
                      placeholder="Unlimited"
                      value={dcMaxUses}
                      onChange={(e) => setDcMaxUses(e.target.value)}
                      disabled={dcBusy}
                    />
                  </div>
                </div>
                {dcError && <div className="form-error" role="alert" style={{ marginTop: 12 }}>{dcError}</div>}
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className="btn btn-dark btn-sm"
                    disabled={dcBusy || !editingId}
                    onClick={() => { if (editingId) void createDiscountCode(editingId); }}
                  >
                    {dcBusy ? 'Creating…' : 'Create code'}
                  </button>
                </div>

                <div className="panel" style={{ marginBottom: 8, marginTop: 36 }}>
                  <h4 style={{ margin: '0 0 8px' }}>Verify keys from your app</h4>
                  <p className="form-note" style={{ margin: '0 0 12px' }}>
                    Call this endpoint when your software activates — it returns whether the key is valid.
                  </p>
                  <code className="ref-code" style={{ display: 'block', whiteSpace: 'pre-wrap', fontSize: 12.5 }}>
{`POST /api/licenses/verify
{ "key": "XXXX-XXXX-XXXX-XXXX", "product_id": "${editingId ?? '…'}" }

→ { "valid": true, "product_id": "…", "activations": 3 }
→ { "valid": false, "reason": "revoked" }`}
                  </code>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="panel">
            <h3>All orders</h3>
            {orders.length === 0 ? (
              <EmptyState
                glyph={<BasketGlyph />}
                title="No orders yet"
                body="When someone buys from your store, the order — and your 90% share — shows up here."
              />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Order</th><th>Product</th><th>Buyer</th><th>Total</th><th>Your share</th><th>Status</th><th>Date</th></tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><code>{shortId(o.id)}</code></td>
                        <td>{o.product_title}</td>
                        <td>{o.buyer_email || '—'}</td>
                        <td>{formatUsd(o.amount_usd)}</td>
                        <td><strong>{formatUsd(o.seller_usd)}</strong></td>
                        <td><span className={`chip badge-${o.status}`}>{o.status}</span></td>
                        <td>{timeAgo(o.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'store' && (
          <div className="panel">
            <h3>Store settings</h3>
            <form onSubmit={saveSettings} noValidate>
              <div className="field">
                <label htmlFor="set-name">Store name</label>
                <input id="set-name" className="input" value={settings.name} onChange={(e) => setSettings({ ...settings, name: e.target.value })} disabled={settingsBusy} />
              </div>
              <div className="field">
                <label htmlFor="set-bio">Bio</label>
                <textarea id="set-bio" className="textarea" value={settings.bio} onChange={(e) => setSettings({ ...settings, bio: e.target.value })} disabled={settingsBusy} />
              </div>
              <div className="field">
                <label htmlFor="set-payout">USDT payout address</label>
                <input
                  id="set-payout"
                  className="input"
                  value={settings.payout}
                  onChange={(e) => setSettings({ ...settings, payout: e.target.value })}
                  disabled={settingsBusy}
                  placeholder="Your TRC-20 / ERC-20 wallet address"
                />
                <p className="hint" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
                  Your 90% share of every paid order is sent here. Double-check it — payouts to a
                  wrong address can&apos;t be reversed.
                </p>
              </div>
              {settingsError && <div className="form-error" role="alert">{settingsError}</div>}
              <button type="submit" className="btn btn-dark" disabled={settingsBusy}>
                {settingsBusy ? 'Saving…' : 'Save settings'}
              </button>
            </form>

            <h3 style={{ marginTop: 36 }}>Social links</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, maxWidth: 640 }}>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="soc-website">Website</label>
                <input id="soc-website" className="input" placeholder="https://…" value={socials.website} onChange={(e) => setSocials({ ...socials, website: e.target.value })} disabled={settingsBusy} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="soc-telegram">Telegram</label>
                <input id="soc-telegram" className="input" placeholder="@channel" value={socials.telegram} onChange={(e) => setSocials({ ...socials, telegram: e.target.value })} disabled={settingsBusy} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="soc-x">X (Twitter)</label>
                <input id="soc-x" className="input" placeholder="@handle" value={socials.x} onChange={(e) => setSocials({ ...socials, x: e.target.value })} disabled={settingsBusy} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="soc-instagram">Instagram</label>
                <input id="soc-instagram" className="input" placeholder="@handle" value={socials.instagram} onChange={(e) => setSocials({ ...socials, instagram: e.target.value })} disabled={settingsBusy} />
              </div>
              <div className="field" style={{ margin: 0 }}>
                <label htmlFor="soc-youtube">YouTube</label>
                <input id="soc-youtube" className="input" placeholder="https://youtube.com/…" value={socials.youtube} onChange={(e) => setSocials({ ...socials, youtube: e.target.value })} disabled={settingsBusy} />
              </div>
            </div>
            <p className="hint">Saved with the settings above. Shown on your public store page and white-label storefront.</p>

            {me?.storeSlug && <StoreProfileExtras storeSlug={me.storeSlug} />}
          </div>
        )}
      </div>
    </div>
  );
}
