import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { verifyIpn } from '../../../lib/nowpayments';

interface IpnBody {
  order_id?: unknown;
  payment_status?: unknown;
}

/** NOWPayments IPN receiver. Never trusts unverified callbacks. */
export async function POST(req: Request) {
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return NextResponse.json({ error: 'unreadable-body' }, { status: 400 });
  }

  let parsed: IpnBody;
  try {
    parsed = JSON.parse(raw) as IpnBody;
  } catch {
    return NextResponse.json({ error: 'malformed-json' }, { status: 400 });
  }

  const signature = req.headers.get('x-nowpayments-sig');
  if (!verifyIpn(raw, signature)) {
    return NextResponse.json({ error: 'invalid-signature' }, { status: 401 });
  }

  try {
    const orderId = typeof parsed.order_id === 'string' ? parsed.order_id : '';
    const status = typeof parsed.payment_status === 'string' ? parsed.payment_status : '';
    if (status === 'finished' && orderId) {
      const db = getDb();
      const order = db.prepare('SELECT id, status FROM orders WHERE id = ?').get(orderId) as
        | { id: string; status: string }
        | undefined;
      if (order && order.status === 'pending') {
        // Affiliate stats derive from paid orders carrying affiliate_code —
        // nothing extra to write here.
        db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[ipn] processing failed:', (err as Error).message);
    return NextResponse.json({ error: 'processing-failed' }, { status: 400 });
  }
}
