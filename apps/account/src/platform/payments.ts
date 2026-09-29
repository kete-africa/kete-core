import { chariowProvider, fakeProvider, type PaymentProvider, type Product } from '@kete/payments';
import { env } from './env';

let provider: PaymentProvider | undefined;

/**
 * `PAYMENTS_PROVIDER=fake` (development and tests only) uses an in-memory provider whose products
 * come from `PAYMENTS_FAKE_PRODUCTS` (JSON: [{ id, name, price: { value, currency } }]).
 */
function fromEnvironment(): PaymentProvider {
  if (process.env.PAYMENTS_PROVIDER !== 'fake') return chariowProvider(env.payments);
  if (process.env.KETE_ENVIRONMENT === 'production') {
    throw new Error('PAYMENTS_PROVIDER=fake is refused in production.');
  }
  const fake = fakeProvider(process.env.PAYMENTS_CHARIOW_PULSE_SECRET || 'whsec_fake_development');
  const products = JSON.parse(process.env.PAYMENTS_FAKE_PRODUCTS ?? '[]') as Product[];
  for (const product of products) fake.products.set(product.id, product);
  return fake;
}

/** The payment provider of this service, created on first use. */
export function getPaymentProvider(): PaymentProvider {
  provider ??= fromEnvironment();
  return provider;
}

/** Tests swap the adapter (e.g. `fakeProvider()`). */
export function usePaymentProvider(next: PaymentProvider): void {
  provider = next;
}
