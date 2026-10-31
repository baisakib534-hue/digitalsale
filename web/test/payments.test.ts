import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createInvoice, paymentsConfigured, splitOrder, verifyIpn } from '../lib/nowpayments';

describe('order fee math (10% platform fee)', () => {
  it('splits amount into fee + seller share', () => {
    assert.deepEqual(splitOrder(2500), { fee: 250, seller: 2250 });
    assert.deepEqual(splitOrder(100), { fee: 10, seller: 90 });
  });

  it('rounds the fee to the nearest cent', () => {
    // 1999 * 10% = 199.9 -> 200
    assert.deepEqual(splitOrder(1999), { fee: 200, seller: 1799 });
    // 1 cent: fee rounds to 0, seller keeps everything
    assert.deepEqual(splitOrder(1), { fee: 0, seller: 1 });
  });

  it('fee + seller always equals the amount', () => {
    for (const cents of [1, 99, 100, 333, 1999, 10000, 99999]) {
      const { fee, seller } = splitOrder(cents);
      assert.equal(fee + seller, cents, `split broken for ${cents}`);
    }
  });
});

describe('NOWPayments invoice creation', () => {
  it('reports honestly when the API key is missing', async () => {
    const saved = process.env.NOWPAYMENTS_API_KEY;
    delete process.env.NOWPAYMENTS_API_KEY;
    try {
      assert.equal(paymentsConfigured(), false);
      const result = await createInvoice({ orderId: 'order-1', amountUsd: 24 });
      assert.deepEqual(result, { configured: false });
    } finally {
      if (saved !== undefined) process.env.NOWPAYMENTS_API_KEY = saved;
    }
  });
});

describe('NOWPayments IPN signature verification', () => {
  const SECRET = 'test-ipn-secret-123';

  /** Sign a payload independently of the implementation under test. */
  function sign(payload: Record<string, unknown>, secret: string = SECRET): string {
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(payload).sort()) sorted[k] = payload[k];
    return createHmac('sha512', secret).update(JSON.stringify(sorted), 'utf8').digest('hex');
  }

  function withSecret<T>(fn: () => T): T {
    const saved = process.env.NOWPAYMENTS_IPN_SECRET;
    process.env.NOWPAYMENTS_IPN_SECRET = SECRET;
    try {
      return fn();
    } finally {
      if (saved === undefined) delete process.env.NOWPAYMENTS_IPN_SECRET;
      else process.env.NOWPAYMENTS_IPN_SECRET = saved;
    }
  }

  const payload = {
    payment_id: 5678901234,
    payment_status: 'finished',
    order_id: 'order-abc',
    price_amount: 24,
    price_currency: 'usd',
  };

  it('accepts a valid signature', () => {
    withSecret(() => {
      const raw = JSON.stringify(payload);
      assert.equal(verifyIpn(raw, sign(payload)), true);
    });
  });

  it('accepts valid signatures regardless of key order', () => {
    withSecret(() => {
      const shuffled = JSON.stringify({
        order_id: 'order-abc',
        price_currency: 'usd',
        payment_status: 'finished',
        price_amount: 24,
        payment_id: 5678901234,
      });
      assert.equal(verifyIpn(shuffled, sign(payload)), true);
    });
  });

  it('rejects tampered bodies', () => {
    withSecret(() => {
      const raw = JSON.stringify(payload);
      const sig = sign(payload);
      const tampered = raw.replace('"finished"', '"failed"');
      assert.equal(verifyIpn(tampered, sig), false);
    });
  });

  it('rejects wrong signatures and missing secrets', () => {
    withSecret(() => {
      const raw = JSON.stringify(payload);
      assert.equal(verifyIpn(raw, 'deadbeef'), false);
      assert.equal(verifyIpn(raw, null), false);
      assert.equal(verifyIpn('not-json', sign(payload)), false);
    });
    const saved = process.env.NOWPAYMENTS_IPN_SECRET;
    delete process.env.NOWPAYMENTS_IPN_SECRET;
    try {
      assert.equal(verifyIpn(JSON.stringify(payload), sign(payload)), false);
    } finally {
      if (saved !== undefined) process.env.NOWPAYMENTS_IPN_SECRET = saved;
    }
  });
});
