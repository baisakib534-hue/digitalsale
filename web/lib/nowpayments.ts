import { hmacSha512Hex, safeEqualHex } from './crypto';

/**
 * NOWPayments integration.
 *
 * - createInvoice(): hosted invoice via NOWPayments API (sandbox when
 *   NOWPAYMENTS_SANDBOX=1). Returns {configured:false} when NOWPAYMENTS_API_KEY
 *   is missing — the checkout UI renders an honest "not configured" state.
 * - verifyIpn(): HMAC-SHA512 over the canonical (key-sorted) JSON body using
 *   NOWPAYMENTS_IPN_SECRET. Never trust unverified callbacks.
 */

export interface InvoiceInput {
  orderId: string;
  amountUsd: number; // dollars
  buyerEmail?: string;
  successUrl?: string;
  cancelUrl?: string;
  ipnCallbackUrl?: string;
}

export type InvoiceResult =
  | { configured: false }
  | { configured: true; invoiceId: string; invoiceUrl: string };

export function paymentsConfigured(): boolean {
  return !!process.env.NOWPAYMENTS_API_KEY;
}

function apiBase(): string {
  return process.env.NOWPAYMENTS_SANDBOX === '1'
    ? 'https://api-sandbox.nowpayments.io'
    : 'https://api.nowpayments.io';
}

export async function createInvoice(input: InvoiceInput): Promise<InvoiceResult> {
  const apiKey = process.env.NOWPAYMENTS_API_KEY;
  if (!apiKey) return { configured: false };

  const res = await fetch(`${apiBase()}/v1/invoice`, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: input.amountUsd,
      price_currency: 'usd',
      order_id: input.orderId,
      order_description: `Digitalsale order ${input.orderId}`,
      ipn_callback_url: input.ipnCallbackUrl,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      ...(input.buyerEmail ? { customer_email: input.buyerEmail } : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`NOWPayments invoice failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { id?: string; invoice_url?: string };
  if (!json.id || !json.invoice_url) {
    throw new Error('NOWPayments returned an unexpected invoice payload.');
  }
  return { configured: true, invoiceId: String(json.id), invoiceUrl: json.invoice_url };
}

/**
 * Verify an IPN callback. NOWPayments signs the raw JSON body with
 * HMAC-SHA512 using the IPN secret; we canonicalize by sorting keys so
 * key order never breaks verification.
 */
export function verifyIpn(rawBody: string, signature: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const canonical = JSON.stringify(sortKeys(parsed));
  const expected = hmacSha512Hex(secret, canonical);
  // NOWPayments sends the hex digest (case-insensitive compare via lowercase).
  return safeEqualHex(expected, signature.toLowerCase());
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = sortKeys((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** Fee math: 10% platform fee, integer cents, fee rounded to nearest cent. */
export function splitOrder(amountCents: number, feePercent = 10): { fee: number; seller: number } {
  const fee = Math.round((amountCents * feePercent) / 100);
  return { fee, seller: amountCents - fee };
}
