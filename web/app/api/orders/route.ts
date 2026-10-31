import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { getSessionUserId } from '../../../lib/auth';

interface OrderRow {
  id: string;
  product_id: string;
  product_title: string;
  buyer_email: string;
  amount_usd: number;
  fee_usd: number;
  seller_usd: number;
  status: string;
  nowpayments_invoice_id: string | null;
  created_at: string;
}

/** Seller view: every order across the seller's own store. */
export async function GET(req: Request) {
  const uid = getSessionUserId(req);
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const db = getDb();
  const orders = db
    .prepare(
      `SELECT o.id, o.product_id, p.title AS product_title, o.buyer_email,
              o.amount_usd, o.fee_usd, o.seller_usd, o.status,
              o.nowpayments_invoice_id, o.created_at
       FROM orders o
       JOIN products p ON p.id = o.product_id
       JOIN stores s ON s.id = p.store_id
       WHERE s.user_id = ?
       ORDER BY o.created_at DESC`
    )
    .all(uid) as OrderRow[];
  return NextResponse.json({ orders });
}
