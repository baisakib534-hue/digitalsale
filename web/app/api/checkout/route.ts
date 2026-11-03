import { getDb } from '@/lib/db';
import { getSessionUserId } from '@/lib/auth';
import { randomId } from '@/lib/crypto';
import { validateDiscount } from '@/lib/discounts';
import { flashDealPrice } from '@/lib/flashDeals';
import { stockInfo, soldCount } from '@/lib/stock';
import { createInvoice } from '@/lib/nowpayments';
import { queueChannelPost } from '@/lib/stores';
import { bundleItems, bundleSumCents, effectiveBundlePrice, getBundle, isSellerBanned } from '@/lib/bundles';
import { NextResponse } from 'next/server';

interface CartItem {
  product_id?: string;
  bundle_id?: string;
  discount_code?: string;
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = await request.json();
    const items: CartItem[] = body.items;
    const buyer_email = body.buyer_email;
    const affiliate_code = body.affiliate_code;

    if (!items || !items.length) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });
    }
    if (!buyer_email || !buyer_email.includes('@')) {
      return NextResponse.json({ error: 'Valid buyer email required' }, { status: 400 });
    }

    // Validate each item and calculate prices
    const orderItems: {
      product_id: string;
      price_cents: number;
      discount_usd: number;
      flash_deal_id: string | null;
    }[] = [];
    let bundle_id: string | null = null;
    let price_winner: 'bundle' | 'sum' = 'bundle';

    for (const item of items) {
      if (item.bundle_id) {
        // Bundle purchase
        if (bundle_id) {
          return NextResponse.json(
            { error: 'Only one bundle allowed per order' },
            { status: 400 }
          );
        }
        const bundle = getBundle(db, item.bundle_id);
        if (!bundle) {
          return NextResponse.json({ error: 'Bundle not found' }, { status: 404 });
        }
        if (bundle.status !== 'live') {
          return NextResponse.json({ error: 'Bundle is not available' }, { status: 400 });
        }

        // Check seller not banned
        const store = db
          .prepare('SELECT id, user_id FROM stores WHERE id = ?')
          .get(bundle.seller_id) as { id: string; user_id: string } | undefined;
        if (!store || isSellerBanned(db, store.id)) {
          return NextResponse.json({ error: 'Bundle not available' }, { status: 400 });
        }

        // Compute effective bundle price (lower of bundle price vs deal-adjusted sum)
        const { chargedCents, winner, sumCents, breakdown } = effectiveBundlePrice(db, bundle.id);
        price_winner = winner;

        // Check stock for all bundle items
        const productIds = breakdown.map((b) => b.product_id);
        const products = db
          .prepare(
            `SELECT id, stock_limit, status FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`
          )
          .all(...productIds) as { id: string; stock_limit: number | null; status: string }[];

        for (const p of products) {
          if (p.status !== 'published') {
            return NextResponse.json(
              { error: 'One or more bundle items are unavailable' },
              { status: 400 }
            );
          }
          const info = stockInfo(db, { id: p.id, stock_limit: p.stock_limit });
          if (info.soldOut) {
            return NextResponse.json(
              { error: 'One or more bundle items are out of stock' },
              { status: 400 }
            );
          }
        }

        // Distribute chargedCents proportionally based on individual effective prices
        const totalSum = breakdown.reduce((acc, b) => acc + b.effective_price_cents, 0);
        for (const b of breakdown) {
          const itemPrice = Math.round((b.effective_price_cents / totalSum) * chargedCents);
          orderItems.push({
            product_id: b.product_id,
            price_cents: itemPrice,
            discount_usd: 0,
            flash_deal_id: b.flash_deal_id,
          });
        }

        bundle_id = bundle.id;
      } else if (item.product_id) {
        // Single product purchase
        if (bundle_id) {
          return NextResponse.json(
            { error: 'Cannot mix bundle and individual products' },
            { status: 400 }
          );
        }
        const product = db
          .prepare(
            `SELECT id, price_usd, status, store_id, stock_limit FROM products WHERE id = ?`
          )
          .get(item.product_id) as
          | { id: string; price_usd: number; status: string; store_id: string; stock_limit: number | null }
          | undefined;

        if (!product) {
          return NextResponse.json({ error: 'Product not found' }, { status: 404 });
        }
        if (product.status !== 'published') {
          return NextResponse.json({ error: 'Product is not available' }, { status: 400 });
        }

        // Check store not suspended
        const store = db
          .prepare('SELECT status FROM stores WHERE id = ?')
          .get(product.store_id) as { status: string } | undefined;
        if (!store || store.status === 'suspended') {
          return NextResponse.json({ error: 'Product not available' }, { status: 400 });
        }

        // Check stock
        const info = stockInfo(db, { id: product.id, stock_limit: product.stock_limit });
        if (info.soldOut) {
          return NextResponse.json({ error: 'Product out of stock' }, { status: 400 });
        }

        // Calculate price with flash deal
        const { finalPriceCents, dealId } = flashDealPrice(db, product.id, product.price_usd);

        // Apply discount code if provided
        let finalPrice = finalPriceCents;
        let discount_usd = 0;
        if (item.discount_code) {
          const result = validateDiscount(db, product.id, finalPriceCents, item.discount_code);
          if (result.ok) {
            discount_usd = result.discountCents;
            finalPrice = result.finalPriceCents;
          }
        }

        orderItems.push({
          product_id: product.id,
          price_cents: finalPrice,
          discount_usd,
          flash_deal_id: dealId,
        });
      }
    }

    if (orderItems.length === 0) {
      return NextResponse.json({ error: 'No valid items' }, { status: 400 });
    }

    // Calculate total amount
    const amount_usd = orderItems.reduce((sum, oi) => sum + oi.price_cents, 0);
    if (amount_usd < 1) {
      return NextResponse.json({ error: 'Invalid total amount' }, { status: 400 });
    }

    // Platform fee 5%
    const fee_usd = Math.round(amount_usd * 0.05);
    const seller_usd = amount_usd - fee_usd;

    // Affiliate handling
    let affiliate_usd = 0;
    let final_affiliate_code: string | null = null;
    if (affiliate_code) {
      const affiliate = db
        .prepare(
          `SELECT a.code, pa.commission_percent
           FROM affiliates a
           JOIN product_affiliates pa ON pa.product_id = ? AND pa.enabled = 1
           WHERE a.code = ?`
        )
        .get(orderItems[0].product_id, affiliate_code) as
        | { code: string; commission_percent: number }
        | undefined;
      if (affiliate) {
        final_affiliate_code = affiliate.code;
        affiliate_usd = Math.round(amount_usd * (affiliate.commission_percent / 100));
      }
    }

    // Create order
    const orderId = randomId();
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ');

    db.prepare(
      `INSERT INTO orders (id, product_id, buyer_id, buyer_email, amount_usd, fee_usd, seller_usd,
        affiliate_code, affiliate_usd, discount_code, discount_usd, flash_deal_id, status,
        nowpayments_invoice_id, created_at, bundle_id, price_winner)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      orderItems[0].product_id, // primary product (first item)
      null, // buyer_id - guest checkout
      buyer_email,
      amount_usd,
      fee_usd,
      seller_usd,
      final_affiliate_code,
      affiliate_usd,
      null, // discount_code - per-item now
      orderItems.reduce((sum, oi) => sum + oi.discount_usd, 0),
      orderItems[0].flash_deal_id, // first flash deal for reference
      'pending',
      null,
      now,
      bundle_id,
      price_winner
    );

    // Create order_items
    const insertOrderItem = db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, price_cents, created_at)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const oi of orderItems) {
      insertOrderItem.run(randomId(), orderId, oi.product_id, oi.price_cents, now);
    }

    // Update flash deal usage count if applicable
    if (bundle_id) {
      for (const oi of orderItems) {
        if (oi.flash_deal_id) {
          db.prepare('UPDATE flash_deals SET current_uses = current_uses + 1 WHERE id = ?').run(
            oi.flash_deal_id
          );
        }
      }
    } else {
      if (orderItems[0].flash_deal_id) {
        db.prepare('UPDATE flash_deals SET current_uses = current_uses + 1 WHERE id = ?').run(
          orderItems[0].flash_deal_id
        );
      }
    }

    // Increment discount usage
    // (discounts are per-item, we'd need to track which discount was used per item)
    // For simplicity, skip for now - discounts are validated but usage not incremented here

    // Create NOWPayments invoice
    const payment = await createInvoice({
      orderId,
      amountUsd: amount_usd / 100, // Convert cents to dollars
      buyerEmail: buyer_email,
      ipnCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/checkout/pay`,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${orderId}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/${orderId}`,
    });

    if (!payment.configured || !payment.invoiceUrl || !payment.invoiceId) {
      return NextResponse.json({ error: 'Payment not configured' }, { status: 500 });
    }

    // Update order with invoice ID
    db.prepare('UPDATE orders SET nowpayments_invoice_id = ? WHERE id = ?').run(
      payment.invoiceId,
      orderId
    );

    return NextResponse.json({
      orderId,
      paymentUrl: payment.invoiceUrl,
      invoiceId: payment.invoiceId,
    });
  } catch (error) {
    console.error('POST /api/checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
  }
}