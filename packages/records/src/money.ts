import { z } from 'zod';

/**
 * An amount of money (CONCEPTION A.5): an integer number of the currency's smallest unit, with its
 * ISO 4217 code. The CFA franc has no cents, so 5 000 XOF is `{ amount: 5000, currency: 'XOF' }`;
 * 12.50 EUR is `{ amount: 1250, currency: 'EUR' }`. Never a float.
 */
export const moneySchema = z.object({
  amount: z.number().int().refine(Number.isSafeInteger, 'The amount is too large.'),
  currency: z.string().regex(/^[A-Z]{3}$/, 'An ISO 4217 code, like XOF or GHS.'),
});
export type Money = z.infer<typeof moneySchema>;

/** How many decimals a currency has (XOF 0, GHS 2, EUR 2), as the platform's Intl says. */
export function minorDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** Formats an amount for people, in their language: `formatMoney(m, 'fr')` → « 5 000 F CFA ». */
export function formatMoney(money: Money, locale: string): string {
  const digits = minorDigits(money.currency);
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(money.amount / 10 ** digits);
}

/** Adds amounts of the same currency; refuses to mix currencies. */
export function addMoney(...amounts: Money[]): Money {
  const [first] = amounts;
  if (!first) throw new TypeError('Nothing to add.');
  let total = 0;
  for (const money of amounts) {
    if (money.currency !== first.currency) {
      throw new TypeError(`Cannot add ${money.currency} to ${first.currency}.`);
    }
    total += money.amount;
  }
  if (!Number.isSafeInteger(total)) throw new RangeError('The total is too large.');
  return { amount: total, currency: first.currency };
}
