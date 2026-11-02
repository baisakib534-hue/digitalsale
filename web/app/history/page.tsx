'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatUsd, timeAgo } from '../../lib/format';
import { IconDownload, IconSend, IconBox, IconClock } from '../../components/doodles';
import EmptyState from '../../components/EmptyState';

type HistoryItem = {
  id: string;
  productId: string;
  productTitle: string;
  productCover?: string;
  seller: { slug: string; name: string };
  price: number;
  fee: number;
  status: 'completed' | 'pending' | 'refunded' | 'disputed';
  createdAt: string;
  downloadUrl?: string;
};

function statusBadge(status: HistoryItem['status']) {
  const config = {
    completed: { label: 'Completed', color: 'var(--mint)', bg: 'rgba(34,197,94,0.12)' },
    pending: { label: 'Pending', color: 'var(--amber)', bg: 'rgba(245,158,11,0.12)' },
    refunded: { label: 'Refunded', color: 'var(--faint)', bg: 'var(--line-soft)' },
    disputed: { label: 'Disputed', color: 'var(--coral)', bg: 'rgba(239,68,68,0.12)' },
  };
  const c = config[status];
  return (
    <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600 }}>
      {c.label}
    </span>
  );
}

function HistoryContent() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [filter, setFilter] = useState<'all' | 'completed' | 'pending'>('all');

  useEffect(() => {
    fetch('/api/me/purchases')
      .then((r) => r.json())
      .then((data) => {
        setItems(data.items || []);
        setEmpty((data.items || []).length === 0);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setEmpty(true);
      });
  }, []);

  const filtered = items.filter((i) => filter === 'all' || i.status === filter);

  return (
    <div className="wrap" style={{ paddingTop: 'var(--space-6)', paddingBottom: 'var(--space-8)' }}>
      <header style={{ marginBottom: 'var(--space-6)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Purchase history</h1>
          <p style={{ color: 'var(--muted)', fontSize: 15 }}>{items.length} order{items.length !== 1 ? 's' : ''} total</p>
        </div>
        <div className="tabs" role="tablist" style={{ display: 'flex', gap: 4 }}>
          {(['all', 'completed', 'pending'] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? 'on' : ''}
              onClick={() => setFilter(f)}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-full)', fontSize: 13.5, fontWeight: 500, border: '1px solid var(--line-soft)', background: 'transparent', color: 'var(--body)', cursor: 'pointer', transition: 'all 0.15s ease' }}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="history-skeleton" style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="history-item skeleton" style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 'var(--space-4)', alignItems: 'start', padding: 'var(--space-4)', background: 'var(--panel)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-lg)' }}>
              <div className="skeleton" style={{ width: 96, height: 96, borderRadius: 'var(--radius-md)' }} />
              <div style={{ display: 'grid', gap: 8 }}>
                <div className="skeleton" style={{ height: 20, width: '60%', borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ height: 16, width: '40%', borderRadius: 'var(--radius-sm)' }} />
                <div className="skeleton" style={{ height: 16, width: '30%', borderRadius: 'var(--radius-sm)' }} />
              </div>
              <div className="skeleton" style={{ height: 28, width: 80, borderRadius: 'var(--radius-full)' }} />
            </div>
          ))}
        </div>
      ) : empty ? (
        <EmptyState
          glyph={<IconBox size={48} />}
          title="No purchases yet"
          body="Your completed and pending orders will appear here."
          action={{ label: 'Explore the market', href: '/market' }}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          glyph={<IconClock size={48} />}
          title="No {filter} orders"
          body={filter === 'completed' ? 'Completed purchases will show up here.' : filter === 'pending' ? 'Pending orders will appear here.' : 'No orders match this filter.'}
        />
      ) : (
        <div className="history-grid" style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {filtered.map((item) => (
            <article key={item.id} className="history-item" style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 'var(--space-4)', alignItems: 'start', padding: 'var(--space-4)', background: 'var(--panel)', border: '1px solid var(--line-soft)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ width: 96, height: 96, borderRadius: 'var(--radius-md)', background: 'var(--line-soft)', overflow: 'hidden', flexShrink: 0 }}>
                {item.productCover ? (
                  <img src={item.productCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                    <IconBox size={28} />
                  </div>
                )}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)', marginBottom: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{item.productTitle}</div>
                    <p style={{ color: 'var(--muted)', fontSize: 13.5, marginTop: 2 }}>
                      from <span style={{ fontWeight: 500 }}>{item.seller.name}</span>
                    </p>
                  </div>
                  {statusBadge(item.status)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--ink)' }}>{formatUsd(item.price)}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 13.5 }}>{timeAgo(item.createdAt)}</span>
                  <span style={{ color: 'var(--muted)', fontSize: 13.5 }}>Fee: {formatUsd(item.fee)}</span>
                </div>
                {item.downloadUrl && item.status === 'completed' && (
                  <a href={item.downloadUrl} className="btn btn-primary" style={{ marginTop: 8, width: 'max-content', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <IconDownload size={16} /> Download
                  </a>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <button className="btn btn-ghost" style={{ width: 'max-content', fontSize: 13 }} onClick={() => router.push(`/store/${item.seller.slug}`)}>
                  <IconSend size={14} /> View store
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense fallback={<div className="history-skeleton" style={{ display: 'grid', gap: 'var(--space-4)' }}><div className="skeleton" style={{ height: 140 }} /></div>}>
      <HistoryContent />
    </Suspense>
  );
}