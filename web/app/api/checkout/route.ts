import { NextResponse } from 'next/server';
import { getDb } from '../../../lib/db';
import { randomId } from '../../../lib/crypto';
import { getSessionUserId } from '../../../lib/auth';
import { paymentsConfigured, splitOrder } from '../../../lib/nowpayments';
import { stockInfo } from '../../../lib/stock';
import { BRAND } from '../../../lib/brand';
import { validateDiscount } from '../../../lib/discounts';
import { liveDealForProduct, flashDealPrice, discountedPrice } from '../../../lib/flashDeals';
import {
  getRefCode,
  clearRefCookieHeader,
  resolveAffiliate,
} from '../../../lib/affiliate';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface CheckoutBody {
  productId?: unknown;
  email?: unknown;
  discountCode?: unknown;
}

/** Create a pending order for a published product. */
export async function POST(req: Request) {
  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json({ error: 'invalid-json' }, { status: 400 });
  }
  const productId = typeof body.productId === 'string' ? body.productId : '';
  if (!productId) return NextResponse.json({ error: 'missing-product' }, { status: 400 });

  const db = getDb();
  const product = db
    .prepare('SELECT id, title, price_usd, status, stock_limit FROM products WHERE id = ?')
    .get(productId) as
    | { id: string; title: string; price_usd: number; status: string; stock_limit: number | null }
    | undefined;
  if (!product || product.status !== 'published') {
    return NextResponse.json({ error: 'product-unavailable' }, { status: 404 });
  }
  // v7: enforce the seller's buyer cap.
  if (stockInfo(db, product).soldOut) {
    return NextResponse.json({ error: 'sold-out' }, { status: 409 });
  }

  // Resolve the buyer: logged-in user first, otherwise require an email.
  const uid = getSessionUserId(req);
  let buyerId: string | null = null;
  let email = typeof body.email === 'string' ? body.email.trim() : '';
  if (uid) {
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(uid) as
      | { id: string; email: string | null }
      | undefined;
    if (user) {
      buyerId = user.id;
      if (user.email) email = user.email;
    }
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: 'invalid-email' }, { status: 400 });
  }

  // v17: flash deal — applied automatically if live. Lower price wins vs discount code.
  const deal = liveDealForProduct(db, product.id);
  let dealId: string | null = null;
  let dealPrice = product.price_usd;
  if (deal) {
    dealId = deal.id;
    dealPrice = discountedPrice(product.price_usd, deal.discount_percent);
  }

  // v11: discount code — validated fresh; invalid codes are ignored silently
  // so a stale code never blocks checkout.
  let discountCode: string | null = null;
  let discountUsd = 0;
  let finalPrice = dealPrice;
  if (body.discountCode !== undefined && body.discountCode !== null && String(body.discountCode).trim() !== '') {
    const check = validateDiscount(db, product.id, dealPrice, body.discountCode);
    if (check.ok) {
      discountCode = check.row.code;
      discountUsd = dealPrice - check.finalPriceCents;
      finalPrice = check.finalPriceCents;
    }
  } else if (deal) {
    // No code applied, but deal was applied — record savings from deal
    discountUsd = product.price_usd - dealPrice;
  }

  // Affiliate attribution (v2): ?ref=CODE cookie → affiliate cut of the sale.
  // Invalid codes (or products with affiliates off) are ignored silently;
  // the cookie is consumed either way.
  let affiliateCode: string | null = null;
  let affiliateUsd = 0;
  const resolved = resolveAffiliate(db, product.id, finalPrice, getRefCode(req));
  if (resolved) {
    affiliateCode = resolved.code;
    affiliateUsd = resolved.affiliateUsd;
  }
  const { fee, seller } = splitOrder(finalPrice, BRAND.feePercent);
  const sellerUsd = seller - affiliateUsd;

  const id = randomId();
  db.prepare(
    `INSERT INTO orders (id, product_id, buyer_id, buyer_email, amount_usd, fee_usd, seller_usd,
       affiliate_code, affiliate_usd, discount_code, discount_usd, flash_deal_id, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
  ).run(id, product.id, buyerId, email, finalPrice, fee, sellerUsd, affiliateCode, affiliateUsd, discountCode, discountUsd, dealId);

  const res = NextResponse.json(
    {
      orderId: id,
      paymentsConfigured: paymentsConfigured(),
      ...(affiliateCode ? { affiliateCode } : {}),
      ...(discountCode ? { discountCode, discountUsd } : {}),
      ...(dealId ? { flashDealId: dealId, flashDealDiscountUsd: discountUsd } : {}),
    },
    { status: 201 }
  );
  res.headers.append('Set-Cookie', clearRefCookieHeader());
  return res;
}
