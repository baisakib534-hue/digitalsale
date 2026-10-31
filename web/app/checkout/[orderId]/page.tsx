import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getDb } from '../../../lib/db';
import { paymentsConfigured } from '../../../lib/nowpayments';
import { formatUsd, shortId, timeAgo } from '../../../lib/format';
import PayPanel from '../../../components/PayPanel';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Checkout' };

interface OrderPageRow {
  id: string;
  product_id: string;
  buyer_email: string;
  amount_usd: number;
  fee_usd: number;
  seller_usd: number;
  status: string;
  created_at: string;
  product_title: string;
  product_cover: string | null;
  store_name: string;
  store_slug: string;
}

function Summary({ order }: { order: OrderPageRow }) {
  return (
    <div className="panel">
      <h3>Order summary</h3>
      <div className="order-line" style={{ border: 'none', background: 'transparent', padding: 0, marginBottom: 20 }}>
        {order.product_cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={order.product_cover}
            alt=""
            style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 10, flex: 'none' }}
          />
        )}
        <div>
          <Link href={`/product/${order.product_id}`} style={{ fontWeight: 700 }}>
            {order.product_title}
          </Link>
          <p style={{ margin: '4px 0 0', fontSize: 13.5, color: 'var(--muted)' }}>
            from <Link href={`/store/${order.store_slug}`}>{order.store_name}</Link>
          </p>
        </div>
      </div>
      <div className="buy-rows">
        <div className="row">
          <span>Order</span>
          <code>{shortId(order.id)}</code>
        </div>
        <div className="row">
          <span>Buyer email</span>
          <span>{order.buyer_email || '—'}</span>
        </div>
        <div className="row">
          <span>Reserved</span>
          <span>{timeAgo(order.created_at)}</span>
        </div>
        <div className="row">
          <span>Total</span>
          <strong>{formatUsd(order.amount_usd)}</strong>
        </div>
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--muted)', margin: '16px 0 0' }}>
        The seller keeps {formatUsd(order.seller_usd)} (90%); Digitalsale&apos;s flat fee is{' '}
        {formatUsd(order.fee_usd)}.
      </p>
    </div>
  );
}

export default function CheckoutPage({ params }: { params: { orderId: string } }) {
  const db = getDb();
  const order = db
    .prepare(
      `SELECT o.id, o.product_id, o.buyer_email, o.amount_usd, o.fee_usd, o.seller_usd,
              o.status, o.created_at,
              p.title AS product_title, p.cover_url AS product_cover,
              s.name AS store_name, s.slug AS store_slug
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN stores s ON s.id = p.store_id
       WHERE o.id = ?`
    )
    .get(params.orderId) as OrderPageRow | undefined;

  if (!order) notFound();

  if (order.status === 'paid') {
    return (
      <>
        <div className="page-hero">
          <div className="wrap">
            <h1>Checkout</h1>
            <p>Order {shortId(order.id)}</p>
          </div>
        </div>
        <div className="wrap" style={{ paddingTop: 48, paddingBottom: 88, maxWidth: 760 }}>
          <div className="panel" style={{ textAlign: 'center', padding: '48px 32px' }}>
            <h2>Already paid</h2>
            <p style={{ color: 'var(--muted)', maxWidth: 440, margin: '0 auto 24px' }}>
              This order is complete — your download links are waiting in your purchases.
            </p>
            <Link href="/dashboard/purchases" className="btn btn-primary">
              Go to my purchases
            </Link>
          </div>
        </div>
      </>
    );
  }

  if (!paymentsConfigured()) {
    return (
      <>
        <div className="page-hero">
          <div className="wrap">
            <h1>Checkout</h1>
            <p>Order {shortId(order.id)}</p>
          </div>
        </div>
        <div className="wrap" style={{ paddingTop: 48, paddingBottom: 88, maxWidth: 760 }}>
          <div className="alert alert-warn" role="alert">
            <strong>Crypto payments aren&apos;t configured on this deployment yet</strong> — the
            seller hasn&apos;t connected NOWPayments. Your order <code>{shortId(order.id)}</code> is
            reserved as pending; <strong>no charge was made</strong>. Once payments are connected you
            can come back and pay, or reach out to the seller directly.
          </div>
          <Summary order={order} />
          <Link href={`/product/${order.product_id}`} className="btn btn-outline">
            ← Back to the product
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-hero">
        <div className="wrap">
          <h1>Checkout</h1>
          <p>Order {shortId(order.id)} — pay securely with crypto.</p>
        </div>
      </div>
      <div className="wrap" style={{ paddingTop: 48, paddingBottom: 88 }}>
        <div className="checkout-grid">
          <Summary order={order} />
          <div className="buy-panel">
            <span className="eyebrow">Payment</span>
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '2.25rem',
                fontWeight: 600,
                color: 'var(--ink)',
                margin: '8px 0 20px',
              }}
            >
              {formatUsd(order.amount_usd)}
            </div>
            <PayPanel orderId={order.id} amountCents={order.amount_usd} />
          </div>
        </div>
      </div>
    </>
  );
}
