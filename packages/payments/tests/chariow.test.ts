import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  chariowProvider,
  isPaid,
  PaymentProviderError,
  sameMoney,
  type CheckoutInput,
} from '../src/index.js';

const secret = 'whsec_test_secret';

/** A fetch that answers like Chariow, with the shapes seen on the real API. */
function fakeFetch(routes: Record<string, { status?: number; body: unknown }>) {
  const calls: { method: string; url: string; body: unknown; auth: string | null }[] = [];
  const handler = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({
      method,
      url,
      body: init?.body ? JSON.parse(String(init.body)) : null,
      auth: new Headers(init?.headers).get('authorization'),
    });
    const route = routes[`${method} ${new URL(url).pathname}`];
    if (!route) return new Response('{}', { status: 404 });
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200 });
  }) as typeof fetch;
  return { handler, calls };
}

const input: CheckoutInput = {
  productId: 'prd_abc',
  customer: {
    email: 'awa@example.test',
    firstName: 'Awa',
    lastName: 'Mensah',
    phoneNumber: '90000000',
    countryCode: 'TG',
  },
  paymentCurrency: 'XOF',
  returnUrl: 'https://compte.example.test/espace/abonnements?paiement=chk_1',
  metadata: { kete_checkout: 'chk_1' },
};

describe('chariowProvider', () => {
  it('starts a checkout and returns the sale and the payment page', async () => {
    const { handler, calls } = fakeFetch({
      'POST /v1/checkout': {
        body: {
          data: {
            step: 'payment',
            purchase: { id: 'SALEABC', status: 'awaiting_payment' },
            payment: { checkout_url: 'https://pay.chariow.test/SALEABC' },
          },
        },
      },
    });
    const provider = chariowProvider({ apiKey: 'sk_test', pulseSecret: secret, fetch: handler });
    expect(await provider.startCheckout(input)).toEqual({
      saleId: 'SALEABC',
      checkoutUrl: 'https://pay.chariow.test/SALEABC',
    });
    expect(calls[0]).toMatchObject({
      method: 'POST',
      auth: 'Bearer sk_test',
      body: {
        product_id: 'prd_abc',
        phone: { number: '90000000', country_code: 'TG' },
        payment_currency: 'XOF',
        custom_metadata: { kete_checkout: 'chk_1' },
      },
    });
  });

  it('refuses a checkout that would not start a new payment', async () => {
    const already = chariowProvider({
      apiKey: 'k',
      pulseSecret: secret,
      fetch: fakeFetch({ 'POST /v1/checkout': { body: { data: { step: 'already_purchased' } } } })
        .handler,
    });
    await expect(already.startCheckout(input)).rejects.toMatchObject({ code: 'already_purchased' });
    const broken = chariowProvider({
      apiKey: 'k',
      pulseSecret: secret,
      fetch: fakeFetch({ 'POST /v1/checkout': { status: 422, body: { message: 'invalid' } } })
        .handler,
    });
    await expect(broken.startCheckout(input)).rejects.toBeInstanceOf(PaymentProviderError);
  });

  it('reads a settled sale as paid, in the product currency', async () => {
    const provider = chariowProvider({
      apiKey: 'k',
      pulseSecret: secret,
      fetch: fakeFetch({
        'GET /v1/sales/SALE6X': {
          body: {
            data: {
              id: 'SALE6X',
              status: 'settled',
              amount: { value: 1, formatted: '$1', short: '1', currency: 'USD' },
              payment: { amount: { value: 582, currency: 'XOF' }, status: 'success' },
              product: { id: 'prd_abc' },
              completed_at: '2026-08-12T05:59:35.000000Z',
            },
          },
        },
      }).handler,
    });
    const sale = await provider.getSale('SALE6X');
    expect(sale).toMatchObject({ id: 'SALE6X', status: 'completed', productId: 'prd_abc' });
    expect(isPaid(sale)).toBe(true);
    expect(sameMoney(sale.amount, { value: 1, currency: 'usd' })).toBe(true);
    expect(sameMoney(sale.amount, { value: 582, currency: 'XOF' })).toBe(false);
  });

  it('never reads an abandoned, failed or unknown sale as paid', async () => {
    for (const raw of ['abandoned', 'failed', 'awaiting_payment', { value: 'refunded' }, null]) {
      const provider = chariowProvider({
        apiKey: 'k',
        pulseSecret: secret,
        fetch: fakeFetch({
          'GET /v1/sales/S1': {
            body: { data: { id: 'S1', status: raw, completed_at: '2026-08-12T05:59:35Z' } },
          },
        }).handler,
      });
      expect(isPaid(await provider.getSale('S1'))).toBe(false);
    }
  });

  it('reads the reference price of a product', async () => {
    const provider = chariowProvider({
      apiKey: 'k',
      pulseSecret: secret,
      fetch: fakeFetch({
        'GET /v1/products/prd_abc': {
          body: {
            data: {
              id: 'prd_abc',
              name: 'Nettio — 30 jours',
              pricing: { current_price: { value: 5000, currency: 'XOF' } },
            },
          },
        },
      }).handler,
    });
    expect(await provider.getProduct('prd_abc')).toEqual({
      id: 'prd_abc',
      name: 'Nettio — 30 jours',
      price: { value: 5000, currency: 'XOF' },
    });
  });

  describe('notifications', () => {
    const provider = chariowProvider({ apiKey: 'k', pulseSecret: secret });
    const body = JSON.stringify({ event: 'successful.sale', sale: { id: 'SALEABC' } });
    const signature = (raw: string, key = secret) =>
      `sha256=${createHmac('sha256', key).update(raw).digest('hex')}`;
    const headers = (overrides: Record<string, string> = {}) =>
      new Headers({
        'x-chariow-signature': signature(body),
        'x-pulse-delivery-id': 'pd_1',
        'x-pulse-event': 'successful.sale',
        ...overrides,
      });

    it('accepts a notification signed with the Pulse secret', async () => {
      expect(await provider.verifyNotification(body, headers())).toEqual({
        deliveryId: 'pd_1',
        event: 'successful.sale',
        saleId: 'SALEABC',
      });
    });

    it('refuses everything when no secret is configured', async () => {
      const unconfigured = chariowProvider({ apiKey: 'k', pulseSecret: '' });
      const emptyKeySigned = new Headers({
        'x-chariow-signature': signature(body, ''),
        'x-pulse-delivery-id': 'pd_1',
      });
      expect(await unconfigured.verifyNotification(body, emptyKeySigned)).toBeNull();
    });

    it('refuses a forged, altered, unsigned or anonymous notification', async () => {
      const forged = signature(body, 'whsec_other');
      expect(
        await provider.verifyNotification(body, headers({ 'x-chariow-signature': forged })),
      ).toBeNull();
      const altered = body.replace('SALEABC', 'SALEXYZ');
      expect(await provider.verifyNotification(altered, headers())).toBeNull();
      const unsigned = new Headers({ 'x-pulse-delivery-id': 'pd_1' });
      expect(await provider.verifyNotification(body, unsigned)).toBeNull();
      const anonymous = new Headers({ 'x-chariow-signature': signature(body) });
      expect(await provider.verifyNotification(body, anonymous)).toBeNull();
    });
  });
});

// Read-only checks against the real API, run where the key is present (never in CI).
describe.runIf(process.env.CHARIOW_API_KEY)('chariowProvider on the real API (read-only)', () => {
  const provider = chariowProvider({
    apiKey: process.env.CHARIOW_API_KEY ?? '',
    pulseSecret: 'unused',
  });

  it('reads a product price and a sale the way the adapter expects', async () => {
    const productId = process.env.CHARIOW_LIVE_PRODUCT_ID;
    const saleId = process.env.CHARIOW_LIVE_SALE_ID;
    if (productId) expect((await provider.getProduct(productId)).price.value).toBeGreaterThan(0);
    if (saleId) expect((await provider.getSale(saleId)).id).toBe(saleId);
  });
});
