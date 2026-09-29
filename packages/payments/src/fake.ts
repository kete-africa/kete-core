import { createHmac, randomBytes } from 'node:crypto';
import {
  PaymentProviderError,
  type CheckoutInput,
  type Notification,
  type PaymentProvider,
  type Product,
  type Sale,
} from './provider.js';

export interface FakeProvider extends PaymentProvider {
  products: Map<string, Product>;
  sales: Map<string, Sale & { input: CheckoutInput }>;
  /** What the provider would do once the customer pays (or gives up). */
  settle(
    saleId: string,
    outcome: 'completed' | 'failed' | 'abandoned',
    amount?: Sale['amount'],
  ): void;
  /** A notification signed as the provider would sign it. */
  notify(saleId: string, event: string, deliveryId?: string): { body: string; headers: Headers };
}

/**
 * A provider that lives in memory, for tests. It signs its notifications with its own secret, so
 * the verification path is the real one.
 */
export function fakeProvider(secret = 'whsec_fake'): FakeProvider {
  const products = new Map<string, Product>();
  const sales = new Map<string, Sale & { input: CheckoutInput }>();
  let counter = 0;
  // Unique per instance: sale ids never collide with a previous run's records.
  const prefix = `SALEFAKE${randomBytes(4).toString('hex').toUpperCase()}`;

  function sign(body: string): string {
    return `sha256=${createHmac('sha256', secret).update(body, 'utf8').digest('hex')}`;
  }

  return {
    name: 'fake',
    products,
    sales,

    async startCheckout(input) {
      if (!products.has(input.productId)) {
        throw new PaymentProviderError('refused', `unknown product ${input.productId}`);
      }
      counter += 1;
      const saleId = `${prefix}${String(counter).padStart(4, '0')}`;
      sales.set(saleId, {
        id: saleId,
        status: 'awaiting_payment',
        productId: input.productId,
        amount: products.get(input.productId)?.price ?? null,
        completedAt: null,
        input,
      });
      return { saleId, checkoutUrl: `https://pay.fake.test/${saleId}` };
    },

    async getSale(saleId) {
      const sale = sales.get(saleId);
      if (!sale) throw new PaymentProviderError('refused', `unknown sale ${saleId}`);
      return {
        id: sale.id,
        status: sale.status,
        productId: sale.productId,
        amount: sale.amount,
        completedAt: sale.completedAt,
      };
    },

    async listProducts() {
      return [...products.values()];
    },

    async getProduct(productId) {
      const product = products.get(productId);
      if (!product) throw new PaymentProviderError('refused', `unknown product ${productId}`);
      return product;
    },

    async verifyNotification(rawBody, headers): Promise<Notification | null> {
      const deliveryId = headers.get('x-pulse-delivery-id');
      if (!deliveryId || headers.get('x-chariow-signature') !== sign(rawBody)) return null;
      const payload = JSON.parse(rawBody) as { event?: string; sale?: { id?: string } };
      return { deliveryId, event: payload.event ?? 'unknown', saleId: payload.sale?.id ?? null };
    },

    settle(saleId, outcome, amount) {
      const sale = sales.get(saleId);
      if (!sale) throw new Error(`unknown sale ${saleId}`);
      sale.status = outcome;
      sale.completedAt = outcome === 'completed' ? new Date() : null;
      if (amount !== undefined) sale.amount = amount;
    },

    notify(saleId, event, deliveryId = `pd_${saleId}_${event}`) {
      const body = JSON.stringify({ event, sale: { id: saleId } });
      return {
        body,
        headers: new Headers({
          'x-chariow-signature': sign(body),
          'x-pulse-delivery-id': deliveryId,
          'x-pulse-event': event,
        }),
      };
    },
  };
}
