import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, dbEnabled } from '@/lib/supabase';
import { verifyIpn } from '@/lib/nowpayments';

/**
 * POST /api/ipn — NOWPayments payment webhook.
 * On "finished" payment: mark order paid + credit seller balance (minus platform fee).
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get('x-nowpayments-sig');
  if (!verifyIpn(raw, sig)) {
    console.error('IPN signature invalid');
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const status = String(body.payment_status || '');
  const orderId = String(body.order_id || '');
  if (!orderId || !dbEnabled()) return NextResponse.json({ ok: true });

  if (status === 'finished' || status === 'confirmed') {
    const db = supabaseServer();
    const { data: order } = await db
      .from('orders')
      .select('id, status, amount_usd, product_id')
      .eq('id', orderId)
      .single();
    const o = order as { id: string; status: string; amount_usd: number; product_id: string } | null;
    if (o && o.status !== 'paid') {
      await db.from('orders').update({ status: 'paid' }).eq('id', orderId);
      const feePct = Number(process.env.PLATFORM_FEE_PCT || 5);
      const sellerAmount = Number(o.amount_usd) * (1 - feePct / 100);
      const { data: product } = await db
        .from('products')
        .select('seller_id')
        .eq('id', o.product_id)
        .single();
      const sellerId = (product as { seller_id?: string } | null)?.seller_id;
      if (sellerId) {
        const { data: seller } = await db
          .from('sellers')
          .select('balance_usd')
          .eq('id', sellerId)
          .single();
        const bal = Number((seller as { balance_usd?: number } | null)?.balance_usd || 0);
        await db
          .from('sellers')
          .update({ balance_usd: bal + sellerAmount })
          .eq('id', sellerId);
      }
      console.log(`Order ${orderId} paid. Seller credited $${sellerAmount.toFixed(2)}`);
    }
  }
  return NextResponse.json({ ok: true });
}
