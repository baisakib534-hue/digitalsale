'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboardGlyph,
  PackageGlyph,
  ReceiptGlyph,
  CreditCardGlyph,
  UsersGlyph,
  SendGlyph,
  SettingsGlyph,
  PlusGlyph,
  EditGlyph,
  TrashGlyph,
  EyeGlyph,
  ExternalLinkGlyph,
  CopyGlyph,
  CheckGlyph,
  XGlyph,
  AlertTriangleGlyph,
  InfoGlyph,
  LoaderGlyph,
  ChevronDownGlyph,
  ChevronUpGlyph,
  SearchGlyph,
  FilterGlyph,
  DownloadGlyph,
  UploadGlyph,
  KeyGlyph,
  TagGlyph,
  ImageGlyph,
  VideoGlyph,
  GlobeGlyph,
  MailGlyph,
  WalletGlyph,
  BarChartGlyph,
  BellGlyph,
  ShieldGlyph,
  LockGlyph,
  UnlockGlyph,
  RefreshCwGlyph,
  MenuGlyph,
  XGlyph as CloseGlyph,
} from '@/components/icons';
import EmptyState, { SproutGlyph, BasketGlyph } from '../../components/EmptyState';
import ProductCard, { type CardProduct } from '../../components/ProductCard';
import WishlistButton from '../../components/WishlistButton';
import { formatUsd, shortId, timeAgo } from '@/lib/format';
import { CATEGORIES } from '@/lib/categories';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboardGlyph },
  { id: 'products', label: 'Products', icon: PackageGlyph },
  { id: 'orders', label: 'Orders', icon: ReceiptGlyph },
  { id: 'payouts', label: 'Payouts', icon: CreditCardGlyph },
  { id: 'affiliates', label: 'Affiliates', icon: UsersGlyph },
  { id: 'telegram', label: 'Telegram', icon: SendGlyph },
  { id: 'settings', label: 'Settings', icon: SettingsGlyph },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  verified: number;
  storeSlug: string | null;
  telegram_id: string | null;
  created_at: string;
}

interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price_usd: number;
  category: string;
  tags: string;
  cover_url: string | null;
  video_url: string | null;
  stock_limit: number | null;
  license_keys: number;
  status: string;
  flagged: number;
  affiliate_enabled: number | null;
  affiliate_commission: number | null;
  created_at: string;
  store_name: string;
  store_slug: string;
}

interface Order {
  id: string;
  product_id: string;
  product_title: string;
  buyer_email: string;
  amount_usd: number;
  fee_usd: number;
  seller_usd: number;
  status: string;
  nowpayments_invoice_id: string | null;
  created_at: string;
}

interface TgBot {
  bot_username: string | null;
  status: string;
}

interface TgChannel {
  id: string;
  channel_id: string;
  channel_title: string | null;
}

interface StoreSettings {
  name: string;
  bio: string;
  payout: string;
}

interface SocialLinks {
  website: string;
  telegram: string;
  x: string;
  instagram: string;
  youtube: string;
}

interface DiscountCode {
  id: string;
  code: string;
  kind: 'percent' | 'fixed';
  value: number;
  used_count: number;
  max_uses: number | null;
  active: number;
}

interface LicenseKey {
  id: string;
  license_key: string;
  status: string;
  activations: number;
  max_activations: number | null;
  created_at: string;
}

interface ProductFile {
  id: string;
  filename: string;
  size: number;
  provider: string;
}

interface ProductImage {
  id: string;
  filename: string;
}

interface PayoutSummary {
  totalEarned: number;
  totalPaidOut: number;
  pendingBalance: number;
  nextPayoutDate: string | null;
  payoutAddress: string;
}

interface AffiliateData {
  code: string;
  usdtAddress: string;
  joinedAt: string;
  totals: {
    clicks: number;
    sales: number;
    earnedUsd: number;
  };
  products: Array<{
    productId: string;
    title: string;
    priceUsd: number;
    commission: number | null;
    sales: number;
    earnedUsd: number;
    clicks: number;
  }>;
}

function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // User & store
  const [me, setMe] = useState<User | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);

  // Payouts
  const [payoutSummary, setPayoutSummary] = useState<PayoutSummary | null>(null);
  const [payoutsLoading, setPayoutsLoading] = useState(true);

  // Affiliates (seller view - products with affiliate enabled)
  const [affiliateProducts, setAffiliateProducts] = useState<Product[]>([]);
  const [affiliateLoading, setAffiliateLoading] = useState(true);

  // Telegram
  const [tgBot, setTgBot] = useState<TgBot | null>(null);
  const [tgChannels, setTgChannels] = useState<TgChannel[]>([]);
  const [tgBotBusy, setTgBotBusy] = useState(false);
  const [tgBotError, setTgBotError] = useState<string | null>(null);
  const [tgToken, setTgToken] = useState('');
  const [tgChanBusy, setTgChanBusy] = useState(false);
  const [tgChanError, setTgChanError] = useState<string | null>(null);
  const [tgChanInput, setTgChanInput] = useState('');

  // Settings
  const [settings, setSettings] = useState<StoreSettings>({ name: '', bio: '', payout: '' });
  const [socials, setSocials] = useState<SocialLinks>({ website: '', telegram: '', x: '', instagram: '', youtube: '' });
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Product editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<Partial<Product> & { price?: number; stockLimited?: boolean; stockLimit?: string; licenseKeys?: boolean; affiliateEnabled?: boolean; affiliateCommission?: number; videoUrl?: string; images?: ProductImage[]; files?: ProductFile[]; licenses?: LicenseKey[]; discounts?: DiscountCode[] }>({});
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editImages, setEditImages] = useState<ProductImage[]>([]);
  const [editFiles, setEditFiles] = useState<ProductFile[]>([]);
  const [editLicenses, setEditLicenses] = useState<LicenseKey[]>([]);
  const [editDiscounts, setEditDiscounts] = useState<DiscountCode[]>([]);
  const [imageBusy, setImageBusy] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Discount code form
  const [dcCode, setDcCode] = useState('');
  const [dcKind, setDcKind] = useState<'percent' | 'fixed'>('percent');
  const [dcValue, setDcValue] = useState('');
  const [dcMaxUses, setDcMaxUses] = useState('');
  const [dcBusy, setDcBusy] = useState(false);
  const [dcError, setDcError] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        setMe(data.user);
      }
    } catch {
      // ignore
    } finally {
      setLoadingMe(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const res = await fetch('/api/products?mine=1');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      } else {
        setProductsError('Failed to load products');
      }
    } catch {
      setProductsError('Failed to load products');
    } finally {
      setProductsLoading(false);
    }
  }, []);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch {
      // ignore
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  const fetchPayoutSummary = useCallback(async () => {
    setPayoutsLoading(true);
    try {
      const [ordersRes, meRes] = await Promise.all([
        fetch('/api/orders'),
        fetch('/api/me'),
      ]);
      if (ordersRes.ok && meRes.ok) {
        const ordersData = await ordersRes.json();
        const meData = await meRes.json();
        const paidOrders = (ordersData.orders || []).filter((o: Order) => o.status === 'paid');
        const totalEarned = paidOrders.reduce((sum: number, o: Order) => sum + o.seller_usd, 0);
        const payoutAddress = meData.user?.store?.payout_usdt_address || '';
        setPayoutSummary({
          totalEarned,
          totalPaidOut: 0,
          pendingBalance: totalEarned,
          nextPayoutDate: null,
          payoutAddress,
        });
      }
    } catch {
      // ignore
    } finally {
      setPayoutsLoading(false);
    }
  }, []);

  const fetchAffiliateProducts = useCallback(async () => {
    setAffiliateLoading(true);
    try {
      const res = await fetch('/api/products?mine=1&status=published');
      if (res.ok) {
        const data = await res.json();
        const withAffiliate = (data.products || []).filter((p: Product) => p.affiliate_enabled === 1);
        setAffiliateProducts(withAffiliate);
      }
    } catch {
      // ignore
    } finally {
      setAffiliateLoading(false);
    }
  }, []);

  const fetchTelegram = useCallback(async () => {
    try {
      const [botRes, channelsRes] = await Promise.all([
        fetch('/api/bot/status'),
        fetch('/api/bot/channels'),
      ]);
      if (botRes.ok) {
        const data = await botRes.json();
        setTgBot(data.bot);
      }
      if (channelsRes.ok) {
        const data = await channelsRes.json();
        setTgChannels(data.channels || []);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch('/api/me');
      if (res.ok) {
        const data = await res.json();
        if (data.user?.store) {
          setSettings({
            name: data.user.store.name || '',
            bio: data.user.store.bio || '',
            payout: data.user.store.payout_usdt_address || '',
          });
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (me) {
      fetchProducts();
      fetchOrders();
      fetchPayoutSummary();
      fetchAffiliateProducts();
      fetchTelegram();
      fetchSettings();
    }
  }, [me, fetchProducts, fetchOrders, fetchPayoutSummary, fetchAffiliateProducts, fetchTelegram, fetchSettings]);

  // Product actions
  const createProduct = async () => {
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Untitled product',
          description: '',
          price_usd: 0,
          category: CATEGORIES[0],
          status: 'draft',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setEditingId(data.product.id);
        fetchProducts();
      }
    } catch {
      // ignore
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product? Buyers who purchased it keep access.')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchProducts();
        if (editingId === id) setEditingId(null);
      }
    } catch {
      // ignore
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'published' ? 'draft' : 'published';
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) fetchProducts();
    } catch {
      // ignore
    }
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setEdit({
      title: p.title,
      description: p.description,
      price: p.price_usd,
      category: p.category,
      tags: p.tags,
      status: p.status,
      stockLimited: !!p.stock_limit,
      stockLimit: p.stock_limit?.toString() || '',
      licenseKeys: !!p.license_keys,
      affiliateEnabled: !!p.affiliate_enabled,
      affiliateCommission: p.affiliate_commission || 20,
      videoUrl: p.video_url || '',
    });
    fetchProductImages(p.id);
    fetchProductFiles(p.id);
    fetchLicenses(p.id);
    fetchDiscounts(p.id);
  };

  const fetchProductImages = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}/images`);
      if (res.ok) {
        const data = await res.json();
        setEditImages(data.images || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchProductFiles = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}/files`);
      if (res.ok) {
        const data = await res.json();
        setEditFiles(data.files || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchLicenses = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}/licenses`);
      if (res.ok) {
        const data = await res.json();
        setEditLicenses(data.licenses || []);
      }
    } catch {
      // ignore
    }
  };

  const fetchDiscounts = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}/discounts`);
      if (res.ok) {
        const data = await res.json();
        setEditDiscounts(data.discounts || []);
      }
    } catch {
      // ignore
    }
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditBusy(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/products/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: edit.title,
          description: edit.description,
          price_usd: Number(edit.price),
          category: edit.category,
          tags: edit.tags,
          status: edit.status,
          stock_limit: edit.stockLimited ? Number(edit.stockLimit) : null,
          license_keys: edit.licenseKeys ? 1 : 0,
          affiliate_enabled: edit.affiliateEnabled ? 1 : 0,
          affiliate_commission: edit.affiliateEnabled ? Number(edit.affiliateCommission) : null,
          video_url: edit.videoUrl,
        }),
      });
      if (res.ok) {
        fetchProducts();
        fetchProductImages(editingId);
        fetchProductFiles(editingId);
      } else {
        const data = await res.json();
        setEditError(data.error || 'Failed to save');
      }
    } catch {
      setEditError('Failed to save');
    } finally {
      setEditBusy(false);
    }
  };

  const uploadImage = async (productId: string, file: File) => {
    setImageBusy(true);
    setImageError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/products/${productId}/images`, {
        method: 'POST',
        body: form,
      });
      if (res.ok) {
        fetchProductImages(productId);
      } else {
        const data = await res.json();
        setImageError(data.error || 'Upload failed');
      }
    } catch {
      setImageError('Upload failed');
    } finally {
      setImageBusy(false);
    }
  };

  const deleteImage = async (productId: string, imageId: string) => {
    try {
      const res = await fetch(`/api/products/${productId}/images/${imageId}`, { method: 'DELETE' });
      if (res.ok) fetchProductImages(productId);
    } catch {
      // ignore
    }
  };

  const uploadFile = async (productId: string, file: File) => {
    setUploadBusy(true);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/products/${productId}/files`, {
        method: 'POST',
        body: form,
      });
      if (res.ok) {
        fetchProductFiles(productId);
      } else {
        const data = await res.json();
        setUploadError(data.error || 'Upload failed');
      }
    } catch {
      setUploadError('Upload failed');
    } finally {
      setUploadBusy(false);
    }
  };

  const revokeLicense = async (productId: string, licenseId: string) => {
    try {
      const res = await fetch(`/api/products/${productId}/licenses/${licenseId}/revoke`, { method: 'POST' });
      if (res.ok) fetchLicenses(productId);
    } catch {
      // ignore
    }
  };

  const createDiscountCode = async (productId: string) => {
    if (!dcCode.trim() || !dcValue) return;
    setDcBusy(true);
    setDcError(null);
    try {
      const res = await fetch(`/api/products/${productId}/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: dcCode.toUpperCase(),
          kind: dcKind,
          value: Number(dcValue),
          max_uses: dcMaxUses ? Number(dcMaxUses) : null,
        }),
      });
      if (res.ok) {
        fetchDiscounts(productId);
        setDcCode('');
        setDcValue('');
        setDcMaxUses('');
      } else {
        const data = await res.json();
        setDcError(data.error || 'Failed to create');
      }
    } catch {
      setDcError('Failed to create');
    } finally {
      setDcBusy(false);
    }
  };

  const deactivateDiscountCode = async (productId: string, discountId: string) => {
    try {
      const res = await fetch(`/api/products/${productId}/discounts/${discountId}/deactivate`, { method: 'POST' });
      if (res.ok) fetchDiscounts(productId);
    } catch {
      // ignore
    }
  };

  // Telegram actions
  const connectBot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgToken.trim()) return;
    setTgBotBusy(true);
    setTgBotError(null);
    try {
      const res = await fetch('/api/bot/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tgToken.trim() }),
      });
      if (res.ok) {
        setTgToken('');
        fetchTelegram();
      } else {
        const data = await res.json();
        setTgBotError(data.error || 'Failed to connect');
      }
    } catch {
      setTgBotError('Failed to connect');
    } finally {
      setTgBotBusy(false);
    }
  };

  const disconnectBot = async () => {
    if (!confirm('Disconnect your bot? Auto-posting and buyer notifications will stop.')) return;
    try {
      const res = await fetch('/api/bot/disconnect', { method: 'POST' });
      if (res.ok) fetchTelegram();
    } catch {
      // ignore
    }
  };

  const linkChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tgChanInput.trim()) return;
    setTgChanBusy(true);
    setTgChanError(null);
    try {
      const res = await fetch('/api/bot/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channel: tgChanInput.trim() }),
      });
      if (res.ok) {
        setTgChanInput('');
        fetchTelegram();
      } else {
        const data = await res.json();
        setTgChanError(data.error || 'Failed to link');
      }
    } catch {
      setTgChanError('Failed to link');
    } finally {
      setTgChanBusy(false);
    }
  };

  const unlinkChannel = async (channelId: string) => {
    try {
      const res = await fetch(`/api/bot/channels/${channelId}`, { method: 'DELETE' });
      if (res.ok) fetchTelegram();
    } catch {
      // ignore
    }
  };

  // Settings actions
  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsBusy(true);
    setSettingsError(null);
    try {
      const res = await fetch('/api/stores', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: settings.name,
          bio: settings.bio,
          payout_usdt_address: settings.payout,
          socials,
        }),
      });
      if (res.ok) {
        fetchMe();
      } else {
        const data = await res.json();
        setSettingsError(data.error || 'Failed to save');
      }
    } catch {
      setSettingsError('Failed to save');
    } finally {
      setSettingsBusy(false);
    }
  };

  const copyStoreLink = () => {
    if (me?.storeSlug) {
      navigator.clipboard.writeText(`${window.location.origin}/store/${me.storeSlug}`);
    }
  };

  // Render helpers
  const renderTabContent = () => {
    switch (tab) {
      case 'overview':
        return renderOverview();
      case 'products':
        return renderProducts();
      case 'orders':
        return renderOrders();
      case 'payouts':
        return renderPayouts();
      case 'affiliates':
        return renderAffiliates();
      case 'telegram':
        return renderTelegram();
      case 'settings':
        return renderSettings();
    }
  };

  const renderOverview = () => (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240, 1fr))', gap: 16 }}>
      <StatCard
        icon={<BarChartGlyph />}
        label="Total products"
        value={products.length}
      />
      <StatCard
        icon={<PackageGlyph />}
        label="Published"
        value={products.filter(p => p.status === 'published').length}
      />
      <StatCard
        icon={<ReceiptGlyph />}
        label="Total orders"
        value={orders.length}
      />
      <StatCard
        icon={<CreditCardGlyph />}
        label="Earnings (paid)"
        value={formatUsd(orders.filter(o => o.status === 'paid').reduce((sum, o) => sum + o.seller_usd, 0))}
      />
      <StatCard
        icon={<UsersGlyph />}
        label="Affiliate products"
        value={affiliateProducts.length}
      />
      <StatCard
        icon={<SendGlyph />}
        label="Telegram connected"
        value={tgBot?.status === 'active' ? 'Yes' : 'No'}
      />
    </div>
  );

  const renderProducts = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3>Your products</h3>
        <button className="btn btn-dark" onClick={createProduct}>
          <PlusGlyph /> New product
        </button>
      </div>
      {productsLoading ? (
        <div className="skeleton-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280, 1fr))' }}>
          {[1, 2, 3, 4].map(i => <ProductSkeleton key={i} />)}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          glyph={<PackageGlyph />}
          title="No products yet"
          body="Create your first digital product — ebooks, software, courses, templates, anything you can deliver as a file."
        />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280, 1fr))', gap: 16 }}>
          {products.map(p => (
            <ProductRow key={p.id} product={p} onEdit={() => startEdit(p)} onDelete={() => deleteProduct(p.id)} onToggle={() => toggleStatus(p.id, p.status)} />
          ))}
        </div>
      )}
    </div>
  );

  const renderOrders = () => (
    <div className="panel">
      <h3>All orders</h3>
      {ordersLoading ? (
        <div className="skeleton-table">
          {[1, 2, 3, 4, 5].map(i => <OrderSkeleton key={i} />)}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          glyph={<ReceiptGlyph />}
          title="No orders yet"
          body="When someone buys from your store, the order — and your 90% share — shows up here."
        />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Order</th>
                <th>Product</th>
                <th>Buyer</th>
                <th>Total</th>
                <th>Your share</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.map(o => (
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
  );

  const renderPayouts = () => (
    <div>
      {payoutsLoading ? (
        <div className="skeleton-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200, 1fr))' }}>
          {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard
              icon={<WalletGlyph />}
              label="Total earned"
              value={payoutSummary ? formatUsd(payoutSummary.totalEarned) : '$0.00'}
            />
            <StatCard
              icon={<CreditCardGlyph />}
              label="Paid out"
              value={payoutSummary ? formatUsd(payoutSummary.totalPaidOut) : '$0.00'}
            />
            <StatCard
              icon={<BarChartGlyph />}
              label="Pending balance"
              value={payoutSummary ? formatUsd(payoutSummary.pendingBalance) : '$0.00'}
              highlight
            />
            <StatCard
              icon={<InfoGlyph />}
              label="Next payout"
              value={payoutSummary?.nextPayoutDate ? timeAgo(payoutSummary.nextPayoutDate) : 'Not scheduled'}
            />
          </div>

          <div className="panel">
            <h3>Payout address</h3>
            <p className="hint" style={{ marginBottom: 16 }}>
              Your 90% share of every paid order is sent to this USDT address (TRC-20 or ERC-20).
              <strong>Double-check it — payouts to a wrong address can't be reversed.</strong>
            </p>
            <div className="field">
              <label htmlFor="payout-address">USDT address</label>
              <input
                id="payout-address"
                className="input"
                value={payoutSummary?.payoutAddress || ''}
                readOnly
              />
              <p className="hint">Update this in Settings → Store settings.</p>
            </div>
          </div>

          <div className="panel">
            <h3>Payout history</h3>
            <p className="hint" style={{ marginBottom: 16 }}>
              Automatic payouts run weekly. Manual payouts can be requested from Settings.
            </p>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr><th>Date</th><th>Amount</th><th>Status</th><th>Transaction</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>
                      No payouts processed yet. Earnings accumulate and pay out automatically.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderAffiliates = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <h3>Affiliate products</h3>
        <span className="chip" style={{ fontSize: 14 }}>
          {affiliateProducts.length} product{affiliateProducts.length !== 1 ? 's' : ''} with affiliates enabled
        </span>
      </div>
      {affiliateLoading ? (
        <div className="skeleton-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280, 1fr))' }}>
          {[1, 2, 3].map(i => <ProductSkeleton key={i} />)}
        </div>
      ) : affiliateProducts.length === 0 ? (
        <EmptyState
          glyph={<UsersGlyph />}
          title="No affiliate products"
          body="Enable affiliates on any published product to let promoters sell it for a commission. You'll see those products listed here."
        />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320, 1fr))', gap: 16 }}>
          {affiliateProducts.map(p => (
            <AffiliateProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );

  const renderTelegram = () => (
    <div>
      <div className="panel">
        <h3>Your Telegram bot</h3>
        <p className="hint" style={{ marginBottom: 16 }}>
          Connect your own bot (from @BotFather) so Digitalsale can notify buyers and auto-post your products to your channel.
          Your token is encrypted and never shown again.
        </p>
        {tgBot && tgBot.status === 'active' ? (
          <div>
            <p style={{ marginBottom: 12 }}>
              Connected: <strong>{tgBot.bot_username ? `@${tgBot.bot_username}` : 'your bot'}</strong>
            </p>
            <button type="button" className="btn btn-ghost" onClick={disconnectBot} disabled={tgBotBusy}>
              Disconnect bot
            </button>
          </div>
        ) : (
          <form onSubmit={connectBot} noValidate>
            <div className="field">
              <label htmlFor="tg-token">Bot token</label>
              <input
                id="tg-token"
                className="input"
                placeholder="123456:ABC-DEF…"
                value={tgToken}
                onChange={e => setTgToken(e.target.value)}
                disabled={tgBotBusy}
                autoComplete="off"
              />
            </div>
            {tgBotError && <div className="form-error" role="alert">{tgBotError}</div>}
            <button type="submit" className="btn btn-primary" disabled={tgBotBusy || !tgToken.trim()}>
              {tgBotBusy ? 'Connecting…' : 'Connect bot'}
            </button>
            <p className="hint" style={{ marginTop: 12 }}>
              Get a token: open @BotFather in Telegram → /newbot → copy the token it gives you.
            </p>
          </form>
        )}
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3>Linked channels</h3>
        <p className="hint" style={{ marginBottom: 16 }}>
          New published products auto-post to these channels through your bot.
          Add your bot as an <strong>admin</strong> of the channel first.
        </p>
        {tgChannels.length > 0 && (
          <ul className="list">
            {tgChannels.map(c => (
              <li key={c.id} className="list-row">
                <span>{c.channel_title || c.channel_id}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => unlinkChannel(c.channel_id)}
                  disabled={tgChanBusy}
                >
                  Unlink
                </button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={linkChannel} noValidate style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="tg-channel">Channel username or ID</label>
            <input
              id="tg-channel"
              className="input"
              placeholder="@yourchannel or -1001234567890"
              value={tgChanInput}
              onChange={e => setTgChanInput(e.target.value)}
              disabled={tgChanBusy || !tgBot}
            />
          </div>
          {tgChanError && <div className="form-error" role="alert">{tgChanError}</div>}
          <button type="submit" className="btn btn-primary" disabled={tgChanBusy || !tgChanInput.trim() || !tgBot}>
            {tgChanBusy ? 'Linking…' : 'Link channel'}
          </button>
          {!tgBot && <p className="hint" style={{ marginTop: 8 }}>Connect your bot above first.</p>}
        </form>
      </div>
    </div>
  );

  const renderSettings = () => (
    <div>
      <div className="panel">
        <h3>Store settings</h3>
        <form onSubmit={saveSettings} noValidate>
          <div className="field">
            <label htmlFor="set-name">Store name</label>
            <input
              id="set-name"
              className="input"
              value={settings.name}
              onChange={e => setSettings({ ...settings, name: e.target.value })}
              disabled={settingsBusy}
            />
          </div>
          <div className="field">
            <label htmlFor="set-bio">Bio</label>
            <textarea
              id="set-bio"
              className="textarea"
              value={settings.bio}
              onChange={e => setSettings({ ...settings, bio: e.target.value })}
              disabled={settingsBusy}
            />
          </div>
          <div className="field">
            <label htmlFor="set-payout">USDT payout address</label>
            <input
              id="set-payout"
              className="input"
              value={settings.payout}
              onChange={e => setSettings({ ...settings, payout: e.target.value })}
              disabled={settingsBusy}
              placeholder="Your TRC-20 / ERC-20 wallet address"
            />
            <p className="hint" style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8 }}>
              Your 90% share of every paid order is sent here. Double-check it — payouts to a
              wrong address can't be reversed.
            </p>
          </div>
          {settingsError && <div className="form-error" role="alert">{settingsError}</div>}
          <button type="submit" className="btn btn-dark" disabled={settingsBusy}>
            {settingsBusy ? 'Saving…' : 'Save settings'}
          </button>
        </form>

        <h3 style={{ marginTop: 36 }}>Social links</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240, 1fr))', gap: 12, maxWidth: 640 }}>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="soc-website">Website</label>
            <input
              id="soc-website"
              className="input"
              placeholder="https://…"
              value={socials.website}
              onChange={e => setSocials({ ...socials, website: e.target.value })}
              disabled={settingsBusy}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="soc-telegram">Telegram</label>
            <input
              id="soc-telegram"
              className="input"
              placeholder="@channel"
              value={socials.telegram}
              onChange={e => setSocials({ ...socials, telegram: e.target.value })}
              disabled={settingsBusy}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="soc-x">X (Twitter)</label>
            <input
              id="soc-x"
              className="input"
              placeholder="@handle"
              value={socials.x}
              onChange={e => setSocials({ ...socials, x: e.target.value })}
              disabled={settingsBusy}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="soc-instagram">Instagram</label>
            <input
              id="soc-instagram"
              className="input"
              placeholder="@handle"
              value={socials.instagram}
              onChange={e => setSocials({ ...socials, instagram: e.target.value })}
              disabled={settingsBusy}
            />
          </div>
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="soc-youtube">YouTube</label>
            <input
              id="soc-youtube"
              className="input"
              placeholder="https://youtube.com/…"
              value={socials.youtube}
              onChange={e => setSocials({ ...socials, youtube: e.target.value })}
              disabled={settingsBusy}
            />
          </div>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Saved with the settings above. Shown on your public store page and white-label storefront.
        </p>

        {me?.storeSlug && (
          <div className="panel" style={{ marginTop: 24 }}>
            <h3>Store profile</h3>
            <p className="hint" style={{ marginBottom: 12 }}>
              Your public store: <strong><a href={`${window.location.origin}/store/${me.storeSlug}`} target="_blank" rel="noopener">{`${window.location.origin}/store/${me.storeSlug}`}</a></strong>
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn btn-dark" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/store/${me.storeSlug}`); }}>
                <CopyGlyph /> Copy link
              </button>
              <a href={`${window.location.origin}/store/${me.storeSlug}`} target="_blank" rel="noopener" className="btn btn-outline">
                <ExternalLinkGlyph /> Open store
              </a>
              <a href={`/s/${me.storeSlug}`} className="btn btn-outline">
                <GlobeGlyph /> White-label
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (loadingMe) {
    return (
      <div className="dashboard-shell">
        <aside className="sidebar" aria-label="Dashboard navigation">
          <nav>
            <ul>
              {TABS.map(t => (
                <li key={t.id}>
                  <button className={tab === t.id ? 'active' : ''} disabled>
                    <t.icon /> {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>
        <main className="main" style={{ padding: 24 }}>
          <div className="skeleton-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200, 1fr))' }}>
            {[1, 2, 3, 4, 5, 6].map(i => <StatCardSkeleton key={i} />)}
          </div>
        </main>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="dashboard-shell">
        <main className="main" style={{ padding: 24, textAlign: 'center' }}>
          <EmptyState
            glyph={<LockGlyph />}
            title="Please sign in"
            body="You need to be signed in to access your seller dashboard."
          />
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <aside className="sidebar" aria-label="Dashboard navigation">
        <div className="sidebar-header">
          <Link href="/dashboard" className="brand" aria-label="Dashboard home">
            <PackageGlyph /> Sellbridge
          </Link>
          <button
            className="mobile-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          >
            <CloseGlyph />
          </button>
        </div>
        <nav>
          <ul>
            {TABS.map(t => (
              <li key={t.id}>
                <button
                  className={tab === t.id ? 'active' : ''}
                  onClick={() => {
                    setTab(t.id);
                    setMobileMenuOpen(false);
                  }}
                >
                  <t.icon /> {t.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <p className="hint">Signed in as {me.email}</p>
        </div>
      </aside>

      <header className="mobile-header">
        <button className="menu-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <MenuGlyph />
        </button>
        <span className="mobile-title">Dashboard</span>
        <span className="mobile-tab">{TABS.find(t => t.id === tab)?.label}</span>
      </header>

      <main className="main">
        <div className="page-header">
          <h1>{TABS.find(t => t.id === tab)?.label}</h1>
        </div>
        {renderTabContent()}
      </main>
    </div>
  );
}

// Components
function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="panel stat-card" style={{ ...(highlight && { borderColor: 'var(--ember)' }) }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ color: highlight ? 'var(--ember)' : 'var(--muted)', fontSize: 22 }}>{icon}</div>
        <div>
          <p style={{ margin: '0 0 4px', color: 'var(--muted)', fontSize: 13.5 }}>{label}</p>
          <p style={{ margin: 0, fontSize: 22, fontWeight: 600, color: highlight ? 'var(--ember)' : 'var(--ink)' }}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="panel stat-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div className="skeleton" style={{ width: 22, height: 22, borderRadius: 6 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '60%', height: 13, borderRadius: 4, marginBottom: 6 }} />
          <div className="skeleton" style={{ width: '40%', height: 22, borderRadius: 4 }} />
        </div>
      </div>
    </div>
  );
}

function ProductRow({ product, onEdit, onDelete, onToggle }: { product: Product; onEdit: () => void; onDelete: () => void; onToggle: () => void }) {
  const isPublished = product.status === 'published';
  return (
    <div className="panel product-row">
      <div style={{ display: 'flex', gap: 12 }}>
        {product.cover_url && (
          <img src={`/api/images/${product.cover_url}`} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', background: 'var(--moss)' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h4 style={{ margin: 0, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.title}</h4>
            <span className={`chip ${isPublished ? 'badge-published' : 'badge-draft'}`}>{isPublished ? 'Published' : 'Draft'}</span>
            {product.flagged && <span className="chip badge-flagged"><AlertTriangleGlyph /> Flagged</span>}
            {product.affiliate_enabled && <span className="chip" style={{ background: 'var(--ember)', opacity: 0.12, color: 'var(--ember)' }}><UsersGlyph /> Affiliate: {product.affiliate_commission}%</span>}
          </div>
          <p className="hint" style={{ margin: '4px 0 0', fontSize: 13 }}>
            {formatUsd(product.price_usd)} · {product.category} · {timeAgo(product.created_at)}
          </p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn btn-outline btn-sm" onClick={onEdit} title="Edit">
            <EditGlyph />
          </button>
          <button className="btn btn-outline btn-sm" onClick={onToggle} title={isPublished ? 'Unpublish' : 'Publish'}>
            {isPublished ? <EyeGlyph style={{ opacity: 0.6 }} /> : <EyeGlyph />}
          </button>
          <button className="btn btn-ghost btn-sm" onClick={onDelete} title="Delete">
            <TrashGlyph />
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="panel product-row">
      <div style={{ display: 'flex', gap: 12 }}>
        <div className="skeleton" style={{ width: 64, height: 64, borderRadius: 8 }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton" style={{ width: '60%', height: 16, borderRadius: 4, marginBottom: 6 }} />
          <div className="skeleton" style={{ width: '40%', height: 13, borderRadius: 4 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
          <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 6 }} />
        </div>
      </div>
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div className="skeleton" style={{ height: 48, borderRadius: 4 }} />
  );
}

function AffiliateProductCard({ product }: { product: Product }) {
  return (
    <div className="panel">
      <div style={{ display: 'flex', gap: 12 }}>
        {product.cover_url && (
          <img src={`/api/images/${product.cover_url}`} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: 'cover', background: 'var(--moss)' }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{product.title}</h4>
          <p className="hint" style={{ margin: 0, fontSize: 13 }}>
            {formatUsd(product.price_usd)} · Affiliate commission: {product.affiliate_commission}% · {timeAgo(product.created_at)}
          </p>
        </div>
        <a href={`/store/${product.store_slug}/${product.slug}`} target="_blank" rel="noopener" className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }}>
          <ExternalLinkGlyph /> View
        </a>
      </div>
    </div>
  );
}

export default Dashboard;