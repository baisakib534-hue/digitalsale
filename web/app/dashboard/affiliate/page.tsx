'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatUsd } from '../../../lib/format';
import { haptic } from '../../../lib/telegram-client';
import { IconCheck } from '../../../components/doodles';

interface MeData {
  code: string;
  usdtAddress: string;
  joinedAt: string;
  totals: { clicks: number; sales: number; earnedUsd: number };
  products: {
    productId: string;
    title: string;
    priceUsd: number;
    commission: number | null;
    sales: number;
    earnedUsd: number;
    clicks: number;
  }[];
}

interface ShareableProduct {
  id: string;
  title: string;
  priceUsd: number;
  category: string;
  commission: number;
  storeName: string;
  link: string | null;
}

interface Creative {
  link: string;
  commission: number;
  swipes: string[];
  card: { title: string; storeName: string; price: string; commission: number; blurb: string; link: string };
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-outline btn-sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        haptic('success');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <IconCheck size={14} /> Copied
        </span>
      ) : (
        label
      )}
    </button>
  );
}

export default function AffiliateDashboardPage() {
  const [phase, setPhase] = useState<'loading' | 'join' | 'ready'>('loading');
  const [me, setMe] = useState<MeData | null>(null);
  const [shareable, setShareable] = useState<ShareableProduct[]>([]);
  const [usdt, setUsdt] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [creative, setCreative] = useState<Creative | null>(null);
  const [creativeFor, setCreativeFor] = useState<string | null>(null);
  const [creativeBusy, setCreativeBusy] = useState(false);

  const load = useCallback(async () => {
    const [meRes, prodRes] = await Promise.all([
      fetch('/api/affiliate/me', { cache: 'no-store' }),
      fetch('/api/affiliate/products', { cache: 'no-store' }),
    ]);
    if (meRes.status === 401) {
      window.location.href = '/auth';
      return;
    }
    if (meRes.ok) {
      setMe(await meRes.json());
      setPhase('ready');
    } else {
      setPhase('join');
    }
    if (prodRes.ok) {
      const j = await prodRes.json();
      setShareable(j.products ?? []);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setJoinError(null);
    setJoinBusy(true);
    try {
      const res = await fetch('/api/affiliate/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ usdtAddress: usdt.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(
          data.error === 'telegram-verification-required'
            ? 'Verify with Telegram first — then you can join the affiliate program.'
            : data.error === 'already-joined'
              ? 'You already joined — reloading…'
              : data.error || 'Could not join.'
        );
        if (data.error === 'already-joined') await load();
        return;
      }
      haptic('success');
      await load();
    } catch {
      setJoinError('Network error. Try again.');
    } finally {
      setJoinBusy(false);
    }
  }

  async function openCreative(p: ShareableProduct) {
    if (creativeFor === p.id) {
      setCreativeFor(null);
      setCreative(null);
      return;
    }
    setCreativeBusy(true);
    setCreativeFor(p.id);
    try {
      const res = await fetch(`/api/affiliate/creative?product=${encodeURIComponent(p.id)}`, {
        cache: 'no-store',
      });
      if (res.ok) setCreative(await res.json());
    } finally {
      setCreativeBusy(false);
    }
  }

  if (phase === 'loading') {
    return (
      <div className="wrap" style={{ padding: '88px 24px' }}>
        <p>Loading your affiliate dashboard…</p>
      </div>
    );
  }

  if (phase === 'join') {
    return (
      <div className="wrap" style={{ padding: '88px 24px', maxWidth: 640 }}>
        <span className="eyebrow">Affiliate program</span>
        <h1>Join the affiliate program</h1>
        <p style={{ color: 'var(--muted)' }}>
          Free to join, no approval wait. Share products you love with your own referral link and earn
          the seller-set commission (5–60% of each sale), tracked for 30 days and paid in USDT.
        </p>
        <form onSubmit={join} className="form-card" style={{ marginTop: 24 }} noValidate>
          <div className="field">
            <label htmlFor="aff-usdt">USDT payout address (TRC-20)</label>
            <input
              id="aff-usdt"
              className="input"
              placeholder="T…"
              value={usdt}
              onChange={(e) => setUsdt(e.target.value)}
              disabled={joinBusy}
            />
            <p className="fineprint">You can add or change this later from this dashboard.</p>
          </div>
          {joinError && (
            <div className="form-error" role="alert">
              {joinError}{' '}
              {joinError.includes('Telegram') && (
                <Link href="/verify" style={{ fontWeight: 700 }}>
                  Verify now
                </Link>
              )}
            </div>
          )}
          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={joinBusy}>
            {joinBusy ? 'Joining…' : 'Join free — get my referral link'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="wrap" style={{ padding: '64px 24px 88px', maxWidth: 960 }}>
      <span className="eyebrow">Affiliate dashboard</span>
      <h1>Earn by recommending</h1>
      {me && (
        <>
          <div className="stat-row" style={{ marginTop: 24 }}>
            <div className="panel stat">
              <b>{me.totals.clicks}</b>
              <span>link clicks</span>
            </div>
            <div className="panel stat">
              <b>{me.totals.sales}</b>
              <span>sales</span>
            </div>
            <div className="panel stat">
              <b>{formatUsd(me.totals.earnedUsd)}</b>
              <span>earned</span>
            </div>
          </div>

          <div className="panel" style={{ marginTop: 24 }}>
            <h3 style={{ marginTop: 0 }}>Your referral code</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <code className="ref-code">{me.code}</code>
              <CopyButton text={me.code} label="Copy code" />
            </div>
            <p className="fineprint" style={{ marginBottom: 0 }}>
              Every link looks like <code>digitalsale…/product/&lt;id&gt;?ref={me.code}</code>. Clicks are
              tracked for 30 days; payouts go to{' '}
              {me.usdtAddress ? <code>{me.usdtAddress}</code> : 'your USDT address (not set yet)'}.
            </p>
          </div>

          <h2 style={{ marginTop: 48 }}>Products you can promote</h2>
          {shareable.length === 0 ? (
            <p style={{ color: 'var(--muted)' }}>
              No products have affiliates enabled yet. Check back soon — or{' '}
              <Link href="/market">browse the market</Link>.
            </p>
          ) : (
            <div className="aff-list">
              {shareable.map((p) => (
                <div className="panel aff-row" key={p.id}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{p.title}</strong>
                    <div className="fineprint">
                      {p.storeName} · {formatUsd(p.priceUsd)} ·{' '}
                      <span className="chip badge-aff">{p.commission}% commission</span>
                    </div>
                    {p.link && <code className="ref-link">{p.link}</code>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {p.link && <CopyButton text={p.link} label="Copy link" />}
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => void openCreative(p)}
                    >
                      {creativeFor === p.id ? 'Hide promo kit' : 'Promo kit'}
                    </button>
                  </div>
                  {creativeFor === p.id && (
                    <div className="promo-kit">
                      {creativeBusy && <p>Loading promo kit…</p>}
                      {creative && (
                        <>
                          <h4>Swipe copy — pick one, make it yours</h4>
                          {creative.swipes.map((s, i) => (
                            <div className="swipe" key={i}>
                              <p>{s}</p>
                              <CopyButton text={s} label="Copy" />
                            </div>
                          ))}
                          <h4>Creative card</h4>
                          <div className="creative-card">
                            <div className="creative-card-body">
                              <span className="eyebrow">Digitalsale pick</span>
                              <strong>{creative.card.title}</strong>
                              <p>{creative.card.blurb}</p>
                              <div className="creative-card-meta">
                                <span>{creative.card.price !== '0.00' ? `$${creative.card.price}` : ''}</span>
                                <span>{creative.card.commission}% commission</span>
                              </div>
                              <code className="ref-link">{creative.card.link}</code>
                            </div>
                            <CopyButton text={creative.card.link} label="Copy card link" />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {me.products.length > 0 && (
            <>
              <h2 style={{ marginTop: 48 }}>Your attributed sales</h2>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Clicks</th>
                      <th>Sales</th>
                      <th>Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {me.products.map((p) => (
                      <tr key={p.productId}>
                        <td>
                          <strong>{p.title}</strong>
                          <div className="fineprint">{p.commission}% commission</div>
                        </td>
                        <td>{p.clicks}</td>
                        <td>{p.sales}</td>
                        <td>{formatUsd(p.earnedUsd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
