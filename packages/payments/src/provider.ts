/**
 * The payment port. Business code starts checkouts, reads sales and accepts notifications through
 * it; adapters (`chariowProvider`, `fakeProvider`) implement it. No provider name leaves adapters.
 */
export interface PaymentProvider {
  readonly name: string;
  /** Opens a payment page for one product; the sale id is known before the customer pays. */
  startCheckout(input: CheckoutInput): Promise<CheckoutStarted>;
  /** The provider's current truth about a sale; the only thing that may activate access. */
  getSale(saleId: string): Promise<Sale>;
  /** A product as sold by the provider: its price is the reference. */
  getProduct(productId: string): Promise<Product>;
  /** The products the store sells, for operators choosing what becomes an offer. */
  listProducts(): Promise<Product[]>;
  /**
   * Authenticates a notification from its raw body and headers. Returns null when it is not
   * genuine. A genuine notification is only a hint: callers re-read the sale with `getSale`.
   */
  verifyNotification(rawBody: string, headers: Headers): Promise<Notification | null>;
}

export interface Money {
  /** Major units, as the provider states them (e.g. 1 for $1, 5000 for 5 000 F CFA). */
  value: number;
  /** ISO 4217. */
  currency: string;
}

export interface CheckoutInput {
  productId: string;
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    /** Digits only. */
    phoneNumber: string;
    /** ISO 3166-1 alpha-2. */
    countryCode: string;
  };
  /** Currency the customer pays in; the provider converts from the product's price. */
  paymentCurrency?: string;
  /** Where the customer comes back after paying. */
  returnUrl: string;
  /** Echoed in notifications; never trusted to decide anything. */
  metadata: Record<string, string>;
}

export interface CheckoutStarted {
  saleId: string;
  checkoutUrl: string;
}

export type SaleStatus = 'awaiting_payment' | 'completed' | 'failed' | 'abandoned' | 'unknown';

export interface Sale {
  id: string;
  status: SaleStatus;
  productId: string | null;
  /** In the product's currency. */
  amount: Money | null;
  completedAt: Date | null;
}

export interface Product {
  id: string;
  name: string;
  price: Money;
}

export interface Notification {
  /** Stable across retries: the idempotency key. */
  deliveryId: string;
  event: string;
  saleId: string | null;
}

export class PaymentProviderError extends Error {
  constructor(
    readonly code: 'unreachable' | 'refused' | 'invalid_response' | 'already_purchased',
    message: string,
  ) {
    super(message);
    this.name = 'PaymentProviderError';
  }
}

/** A paid sale: its status is final and positive. */
export function isPaid(sale: Sale): boolean {
  return sale.status === 'completed' && sale.completedAt !== null;
}

/** Two amounts are equal when their currency is and their value is, to the cent. */
export function sameMoney(a: Money | null, b: Money | null): boolean {
  if (!a || !b) return false;
  return (
    a.currency.toUpperCase() === b.currency.toUpperCase() &&
    Math.round(a.value * 100) === Math.round(b.value * 100)
  );
}
