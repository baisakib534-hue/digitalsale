import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer, dbEnabled } from '@/lib/supabase';

/** GET /api/products — list all products with seller email. */
export async function GET() {
  if (!dbEnabled()) return NextResponse.json({ products: [] });
  const db = supabaseServer();
  const { data, error } = await db
    .from('products')
    .select('id, title, description, price_usd, sellers(email)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ products: [], error: error.message });
  const products = (data || []).map((p: Record<string, unknown>) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    price_usd: p.price_usd,
    seller_email: (p.sellers as { email?: string } | null)?.email || 'seller',
  }));
  return NextResponse.json({ products });
}

/** POST /api/products — publish a product (creates seller row if needed). */
export async function POST(req: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 500 });
  }
  const { email, usdtAddress, title, description, priceUsd, fileUrl } = await req.json();
  if (!email?.includes('@') || !title?.trim() || !priceUsd || !fileUrl?.trim()) {
    return NextResponse.json({ error: 'Email, title, price and file URL are required.' }, { status: 400 });
  }
  const db = supabaseServer();

  // upsert seller
  const { data: existing } = await db.from('sellers').select('id').eq('email', email).single();
  let sellerId: string;
  if (existing) {
    sellerId = (existing as { id: string }).id;
    if (usdtAddress) {
      await db.from('sellers').update({ usdt_address: usdtAddress }).eq('id', sellerId);
    }
  } else {
    const { data, error } = await db
      .from('sellers')
      .insert({ email, usdt_address: usdtAddress || null })
      .select('id')
      .single();
    if (error || !data) return NextResponse.json({ error: 'Could not create seller.' }, { status: 500 });
    sellerId = (data as { id: string }).id;
  }

  const { data: product, error } = await db
    .from('products')
    .insert({
      seller_id: sellerId,
      title: title.trim(),
      description: (description || '').trim(),
      price_usd: Number(priceUsd),
      file_url: fileUrl.trim(),
    })
    .select('id')
    .single();
  if (error || !product) {
    return NextResponse.json({ error: 'Could not publish product.' }, { status: 500 });
  }
  return NextResponse.json({ id: (product as { id: string }).id });
}
