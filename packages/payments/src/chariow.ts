import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  PaymentProviderError,
  type CheckoutInput,
  type CheckoutStarted,
  type Money,
  type Notification,
  type PaymentProvider,
  type Product,
  type Sale,
  type SaleStatus,
} from './provider.js';

export interface ChariowOptions {
  apiKey: string;
  /** The signing secret of the store's Pulse (`whsec_…`); not the API key. */
  pulseSecret: string;
  baseUrl?: string;
  timeoutMs?: number;
  fetch?: typeof fetch;
}

type Json = Record<string, unknown>;

function object(value: unknown): Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Json)
    : {};
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

function money(value: unknown): Money | null {
  const amount = object(value);
  const number = typeof amount.value === 'number' ? amount.value : Number(amount.value);
  const currency = text(amount.currency);
  return Number.isFinite(number) && currency ? { value: number, currency } : null;
}

function date(value: unknown): Date | null {
  const raw = text(value);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Chariow reports `settled` once the payout is done: the sale was paid before that. Its status is
 * a string, sometimes an object with a `value` (both seen in practice).
 */
function status(value: unknown): SaleStatus {
  const raw = typeof value === 'string' ? value : text(object(value).value);
  switch (raw) {
    case 'completed':
    case 'settled':
      return 'completed';
    case 'awaiting_payment':
    case 'failed':
    case 'abandoned':
      return raw;
    default:
      return 'unknown';
  }
}

/** Chariow (https://chariow.dev): checkout by API, sales re-read by API, signed Pulses. */
export function chariowProvider(options: ChariowOptions): PaymentProvider {
  const baseUrl = (options.baseUrl ?? 'https://api.chariow.com/v1').replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? 15_000;
  const http = options.fetch ?? fetch;

  async function call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Json> {
    let response: Response;
    try {
      response = await http(`${baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${options.apiKey}`,
          accept: 'application/json',
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new PaymentProviderError('unreachable', `${method} ${path}: provider unreachable`);
    }
    if (!response.ok) {
      throw new PaymentProviderError('refused', `${method} ${path}: status ${response.status}`);
    }
    const json = object(await response.json().catch(() => null));
    return object(json.data);
  }

  return {
    name: 'chariow',

    async startCheckout(input: CheckoutInput): Promise<CheckoutStarted> {
      const data = await call('POST', '/checkout', {
        product_id: input.productId,
        email: input.customer.email,
        first_name: input.customer.firstName.slice(0, 50),
        last_name: input.customer.lastName.slice(0, 50),
        phone: { number: input.customer.phoneNumber, country_code: input.customer.countryCode },
        ...(input.paymentCurrency ? { payment_currency: input.paymentCurrency } : {}),
        redirect_url: input.returnUrl,
        custom_metadata: input.metadata,
      });
      if (data.step === 'already_purchased') {
        throw new PaymentProviderError('already_purchased', 'checkout: already purchased');
      }
      const saleId = text(object(data.purchase).id);
      const checkoutUrl = text(object(data.payment).checkout_url);
      if (data.step !== 'payment' || !saleId || !checkoutUrl) {
        throw new PaymentProviderError(
          'invalid_response',
          `checkout: unexpected step ${String(data.step)}`,
        );
      }
      return { saleId, checkoutUrl };
    },

    async getSale(saleId: string): Promise<Sale> {
      const data = await call('GET', `/sales/${encodeURIComponent(saleId)}`);
      const id = text(data.id);
      if (!id) throw new PaymentProviderError('invalid_response', 'sale: no identifier');
      return {
        id,
        status: status(data.status),
        productId: text(object(data.product).id),
        amount: money(data.amount),
        completedAt: date(data.completed_at),
      };
    },

    async getProduct(productId: string): Promise<Product> {
      const data = await call('GET', `/products/${encodeURIComponent(productId)}`);
      const pricing = object(data.pricing);
      const price = money(pricing.current_price) ?? money(pricing.price);
      const id = text(data.id);
      if (!id || !price) throw new PaymentProviderError('invalid_response', 'product: no price');
      return { id, name: text(data.name) ?? id, price };
    },

    async verifyNotification(rawBody: string, headers: Headers): Promise<Notification | null> {
      const signature = headers.get('x-chariow-signature') ?? '';
      const deliveryId = headers.get('x-pulse-delivery-id');
      if (!/^sha256=[0-9a-f]{64}$/.test(signature) || !deliveryId) return null;
      const expected = createHmac('sha256', options.pulseSecret).update(rawBody, 'utf8').digest();
      const given = Buffer.from(signature.slice('sha256='.length), 'hex');
      if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
      let payload: Json;
      try {
        payload = object(JSON.parse(rawBody));
      } catch {
        return null;
      }
      // `{ event, sale: { id, … }, product, customer, store, checkout }`
      const sale = object(payload.sale);
      return {
        deliveryId,
        event: headers.get('x-pulse-event') ?? text(payload.event) ?? 'unknown',
        saleId: text(sale.id),
      };
    },
  };
}
