import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, dbEnabled } from '@/lib/supabase';
import { createInvoice } from '@/lib/nowpayments';

/** POST /api/checkout — create order + NOWPayments invoice, return invoice URL. */
export async function POST(req: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 500 });
  }
  const { productId, buyerEmail } = await req.json();
  if (!productId) return NextResponse.json({ error: 'Missing product.' }, { status: 400 });

  const db = supabaseServer();
  const { data: product } = await db
    .from('products')
    .select('id, price_usd')
    .eq('id', productId)
    .single();
  if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

  const p = product as { id: string; price_usd: number };
  const { data: order, error } = await db
    .from('orders')
    .insert({
      product_id: p.id,
      buyer_email: buyerEmail || null,
      amount_usd: Number(p.price_usd),
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !order) {
    return NextResponse.json({ error: 'Could not create order.' }, { status: 500 });
  }
  const orderId = (order as { id: string }).id;

  try {
    const invoice = await createInvoice({
      orderId,
      amountUsd: Number(p.price_usd),
      buyerEmail,
    });
    await db.from('orders').update({ nowpayments_invoice_id: invoice.id }).eq('id', orderId);
    return NextResponse.json({ invoiceUrl: invoice.invoice_url, orderId });
  } catch (e) {
    console.error('checkout error:', e);
    return NextResponse.json(
      { error: 'Payment provider error. Check NOWPayments API key.' },
      { status: 502 }
    );
  }
}
