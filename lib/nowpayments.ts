import crypto from 'crypto';

/** Create a NOWPayments hosted invoice. Buyer pays on NOWPayments' page. */
export async function createInvoice(opts: {
  orderId: string;
  amountUsd: number;
  buyerEmail?: string;
}): Promise<{ invoice_url: string; id: string }> {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) throw new Error('NOWPAYMENTS_API_KEY is not set');
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');

  const res = await fetch('https://api.nowpayments.io/v1/invoice', {
    method: 'POST',
    headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      price_amount: opts.amountUsd,
      price_currency: 'usd',
      order_id: opts.orderId,
      order_description: `SellBridge order ${opts.orderId}`,
      ipn_callback_url: `${site}/api/ipn`,
      success_url: `${site}/market?paid=1`,
      cancel_url: `${site}/market?cancelled=1`,
    }),
  });
  if (!res.ok) {
    throw new Error(`NOWPayments ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

/** Verify NOWPayments IPN signature. Returns true if valid (or if no secret configured). */
export function verifyIpn(rawBody: string, sig: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    console.warn('NOWPAYMENTS_IPN_SECRET not set — skipping IPN verification');
    return true;
  }
  if (!sig) return false;
  try {
    const parsed = JSON.parse(rawBody);
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(parsed).sort()) sorted[k] = parsed[k];
    const hmac = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(sorted))
      .digest('hex');
    return hmac === sig;
  } catch {
    return false;
  }
}
