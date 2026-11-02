import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { verifyIpn } from '../../../lib/nowpayments';
import { issueLicenseKey } from '../../../lib/licenses';
import { incrementDiscountUse } from '../../../lib/discounts';
import { notifyPurchaseConfirmed, cleanupExpiredNotifications } from '../../../lib/bot-notify';
import { checkMilestone } from '../../../lib/stores';

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
      const order = db.prepare('SELECT id, product_id, status, discount_code FROM orders WHERE id = ?').get(orderId) as
        | { id: string; product_id: string; status: string; discount_code: string | null }
        | undefined;
      if (order && order.status === 'pending') {
        // Affiliate stats derive from paid orders carrying affiliate_code —
        // nothing extra to write here.
        db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(order.id);
        // v14.13: best-seller milestone → seller's own channel auto-post.
        try {
          const prod = db
            .prepare('SELECT store_id FROM products WHERE id = ?')
            .get(order.product_id) as { store_id: string } | undefined;
          if (prod) checkMilestone(db, prod.store_id, order.product_id);
        } catch {
          /* milestone is best-effort */
        }
        // v11: count the discount code use.
        if (order.discount_code) {
          const dc = db
            .prepare('SELECT id FROM discount_codes WHERE product_id = ? AND code = ?')
            .get(order.product_id, order.discount_code) as { id: string } | undefined;
          if (dc) {
            try {
              incrementDiscountUse(db, dc.id);
            } catch (err) {
              console.error('[ipn] discount use increment failed:', (err as Error).message);
            }
          }
        }
        // v10: Gumroad-style license key per paid order (idempotent).
        const product = db
          .prepare('SELECT license_keys FROM products WHERE id = ?')
          .get(order.product_id) as { license_keys: number } | undefined;
        if (product?.license_keys === 1) {
          try {
            issueLicenseKey(db, order.product_id, order.id);
          } catch (err) {
            console.error('[ipn] license key issue failed:', (err as Error).message);
          }
        }
        // v14: bot purchase-confirmation (main bot + seller's own bot when
        // registered). Never throws; self-deletes after 1 hour.
        await notifyPurchaseConfirmed(db, order.id);
        // v14.1: sweep expired self-deleting notifications while we're here
        // (Hobby plan only allows a daily Vercel cron).
        try {
          await cleanupExpiredNotifications(db);
        } catch {
          /* best-effort */
        }
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[ipn] processing failed:', (err as Error).message);
    return NextResponse.json({ error: 'processing-failed' }, { status: 400 });
  }
}
