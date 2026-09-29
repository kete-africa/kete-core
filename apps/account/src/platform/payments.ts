import { chariowProvider, type PaymentProvider } from '@kete/payments';
import { env } from './env';

let provider: PaymentProvider | undefined;

/** The payment provider of this service, created on first use. */
export function getPaymentProvider(): PaymentProvider {
  provider ??= chariowProvider(env.payments);
  return provider;
}

/** Tests swap the adapter (e.g. `fakeProvider()`). */
export function usePaymentProvider(next: PaymentProvider): void {
  provider = next;
}
