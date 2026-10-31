import { NextResponse } from 'next/server';
import { getDb } from '../../../../lib/db';
import { createInvoice, paymentsConfigured } from '../../../../lib/nowpayments';

interface PayBody {
  orderId?: unknown;
}

function getOrigin(req: Request): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? 'localhost:3000';
  return `${proto}://${host}`;
}

/** Turn a pending order into a NOWPayments hosted invoice. */
export async function POST(req: Request) {
  let body: PayBody;
  try {
    body = (await req.json()) as PayBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const orderId = typeof body.orderId === 'string' ? body.orderId : '';
  if (!orderId) return NextResponse.json({ error: 'missing-order' }, { status: 400 });

  const db = getDb();
  const order = db
    .prepare('SELECT id, buyer_email, amount_usd, status, nowpayments_invoice_id FROM orders WHERE id = ?')
    .get(orderId) as
    | { id: string; buyer_email: string; amount_usd: number; status: string; nowpayments_invoice_id: string | null }
    | undefined;
  if (!order) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  if (order.status !== 'pending') {
    return NextResponse.json({ error: 'order-not-pending', status: order.status }, { status: 400 });
  }
  if (!paymentsConfigured()) {
    return NextResponse.json({ error: 'payments-not-configured' }, { status: 409 });
  }

  const origin = getOrigin(req);
  let invoice: { configured: false } | { configured: true; invoiceId: string; invoiceUrl: string };
  try {
    invoice = await createInvoice({
      orderId: order.id,
      amountUsd: order.amount_usd / 100,
      buyerEmail: order.buyer_email || undefined,
      successUrl: `${origin}/dashboard/purchases?paid=1`,
      cancelUrl: `${origin}/checkout/${order.id}`,
      ipnCallbackUrl: `${origin}/api/ipn`,
    });
  } catch (err) {
    console.error('[checkout/pay] invoice creation failed:', (err as Error).message);
    return NextResponse.json({ error: 'invoice-failed' }, { status: 502 });
  }
  if (!invoice.configured) {
    return NextResponse.json({ error: 'payments-not-configured' }, { status: 409 });
  }

  db.prepare('UPDATE orders SET nowpayments_invoice_id = ? WHERE id = ?').run(invoice.invoiceId, order.id);
  return NextResponse.json({ invoiceUrl: invoice.invoiceUrl });
}
