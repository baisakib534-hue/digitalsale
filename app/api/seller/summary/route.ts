import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, dbEnabled } from '@/lib/supabase';

/** GET /api/seller/summary?email= — dashboard stats for a seller. */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email');
  if (!email || !dbEnabled()) {
    return NextResponse.json({ products: 0, sales: 0, revenue: 0, balance: 0, items: [] });
  }
  const db = supabaseServer();
  const { data: seller } = await db.from('sellers').select('id, balance_usd').eq('email', email).single();
  const s = seller as { id?: string; balance_usd?: number } | null;
  if (!s?.id) {
    return NextResponse.json({ products: 0, sales: 0, revenue: 0, balance: 0, items: [] });
  }
  const { data: products } = await db
    .from('products')
    .select('id, title, price_usd')
    .eq('seller_id', s.id)
    .order('created_at', { ascending: false });
  const items = (products || []) as { id: string; title: string; price_usd: number }[];
  const productIds = items.map((p) => p.id);
  let sales = 0;
  let revenue = 0;
  if (productIds.length > 0) {
    const { data: orders } = await db
      .from('orders')
      .select('amount_usd')
      .in('product_id', productIds)
      .eq('status', 'paid');
    const paid = (orders || []) as { amount_usd: number }[];
    sales = paid.length;
    revenue = paid.reduce((sum, o) => sum + Number(o.amount_usd), 0);
  }
  return NextResponse.json({
    products: items.length,
    sales,
    revenue,
    balance: Number(s.balance_usd || 0),
    items,
  });
}
