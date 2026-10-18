import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, dbEnabled } from '@/lib/supabase';

/** GET /api/download?order=ID — redirect buyer to the file after payment. */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get('order');
  if (!orderId || !dbEnabled()) {
    return NextResponse.json({ error: 'Invalid link.' }, { status: 400 });
  }
  const db = supabaseServer();
  const { data: order } = await db
    .from('orders')
    .select('status, product_id')
    .eq('id', orderId)
    .single();
  const o = order as { status?: string; product_id?: string } | null;
  if (!o || o.status !== 'paid' || !o.product_id) {
    return NextResponse.json({ error: 'Payment not confirmed yet.' }, { status: 402 });
  }
  const { data: product } = await db
    .from('products')
    .select('file_url')
    .eq('id', o.product_id)
    .single();
  const url = (product as { file_url?: string } | null)?.file_url;
  if (!url) return NextResponse.json({ error: 'File missing.' }, { status: 404 });
  return NextResponse.redirect(url);
}
