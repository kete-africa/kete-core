import { z } from 'zod';

// Amounts of money (spec 094): an integer count of the currency's smallest unit, with its
// currency. No float ever holds an amount: 2 480 000 F CFA is `{ amount: 2480000, currency:
// 'XOF' }`, 12,50 € is `{ amount: 1250, currency: 'EUR' }`. Every figure a screen shows is computed
// here — added, split, rounded once — never written by a model.

export interface Money {
  /** In the currency's smallest unit: francs for XOF, cents for EUR. A safe integer. */
  amount: number;
  /** ISO 4217, upper case: XOF, XAF, EUR, USD… */
  currency: string;
}

/** What the amounts refuse: two currencies in one sum, or a number that is not an amount. */
export class MoneyError extends Error {
  constructor(
    readonly code: 'currency_mismatch' | 'not_an_amount' | 'unknown_currency' | 'invalid_ratios',
    message: string,
  ) {
    super(message);
    this.name = 'MoneyError';
  }
}

const code = /^[A-Z]{3}$/;

/** The decimals of a currency, as ISO 4217 has them: 0 for XOF and XAF, 2 for EUR. */
export function decimalsOf(currency: string): number {
  if (!code.test(currency)) throw new MoneyError('unknown_currency', `Not a currency: ${currency}`);
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

/** An amount, in the currency's smallest unit. */
export function money(amount: number, currency: string): Money {
  if (!Number.isSafeInteger(amount)) {
    throw new MoneyError('not_an_amount', 'An amount is a whole number of the smallest unit.');
  }
  decimalsOf(currency);
  return { amount, currency };
}

export const zero = (currency: string): Money => money(0, currency);

/**
 * An amount as a person writes it — « 2 480 000 », « 12,50 », « 1 250.5 » — read exactly, digit by
 * digit. More decimals than the currency has is refused: nothing is rounded on the way in.
 */
export function parseMoney(text: string, currency: string): Money {
  const decimals = decimalsOf(currency);
  const clean = text.replace(/[\s']/g, '').replace(',', '.');
  const match = /^(-)?(\d+)(?:\.(\d+))?$/.exec(clean);
  if (!match) throw new MoneyError('not_an_amount', `Not an amount: ${text}`);
  const fraction = (match[3] ?? '').replace(/0+$/, '');
  if (fraction.length > decimals) {
    throw new MoneyError('not_an_amount', `${currency} has ${decimals} decimal(s).`);
  }
  const units = Number(`${match[2]}${fraction.padEnd(decimals, '0')}`);
  return money(match[1] ? -units : units, currency);
}

function same(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError('currency_mismatch', `${a.currency} and ${b.currency} do not add up.`);
  }
}

export function add(a: Money, b: Money): Money {
  same(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  same(a, b);
  return money(a.amount - b.amount, a.currency);
}

/** The sum of amounts of one currency; of none, zero of the currency named. */
export function sum(amounts: readonly Money[], currency: string): Money {
  return amounts.reduce(add, zero(currency));
}

export const negate = (a: Money): Money => money(-a.amount, a.currency);
export const isZero = (a: Money): boolean => a.amount === 0;
export const isNegative = (a: Money): boolean => a.amount < 0;

/** -1, 0 or 1: for sorting, and for « does it fit in what is left ». */
export function compare(a: Money, b: Money): -1 | 0 | 1 {
  same(a, b);
  return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0;
}

/** Half away from zero, on an exact decimal: what an invoice's reader expects. */
function round(value: number): number {
  const rounded = Math.sign(value) * Math.round(Math.abs(value) + Number.EPSILON);
  if (!Number.isSafeInteger(rounded)) {
    throw new MoneyError('not_an_amount', 'The amount is too large.');
  }
  return rounded === 0 ? 0 : rounded;
}

/** A unit price by a quantity — 8 × 245 000, or 2,5 h × 8 000 — rounded once, to the unit. */
export function multiply(a: Money, factor: number): Money {
  if (!Number.isFinite(factor)) throw new MoneyError('not_an_amount', 'Not a quantity.');
  return money(round(a.amount * factor), a.currency);
}

/** A share of an amount: 18 % of tax, 5 % of retention. `rate` is in percent. */
export function percent(a: Money, rate: number): Money {
  if (!Number.isFinite(rate)) throw new MoneyError('not_an_amount', 'Not a rate.');
  return money(round((a.amount * rate) / 100), a.currency);
}

/**
 * Splits an amount by ratios without losing a unit: a deposit of 40 %, then 30 % and 30 % — the
 * parts add up to the whole, whatever the rounding. The remainder goes to the largest fractions.
 */
export function allocate(a: Money, ratios: readonly number[]): Money[] {
  const total = ratios.reduce((s, r) => s + r, 0);
  if (ratios.length === 0 || ratios.some((r) => !Number.isFinite(r) || r < 0) || total <= 0) {
    throw new MoneyError('invalid_ratios', 'Ratios are positive numbers, not all zero.');
  }
  const sign = a.amount < 0 ? -1 : 1;
  const whole = Math.abs(a.amount);
  const exact = ratios.map((r) => (whole * r) / total);
  const parts = exact.map(Math.floor);
  let left = whole - parts.reduce((s, p) => s + p, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((x, y) => y.fraction - x.fraction || x.index - y.index);
  for (const { index } of order) {
    if (left <= 0) break;
    parts[index] = (parts[index] ?? 0) + 1;
    left -= 1;
  }
  return parts.map((p) => money(p === 0 ? 0 : sign * p, a.currency));
}

/** The amount in the currency's main unit, as a decimal text: `1250` cents is `12.50`. */
export function toDecimal(a: Money): string {
  const decimals = decimalsOf(a.currency);
  const digits = String(Math.abs(a.amount)).padStart(decimals + 1, '0');
  const text = decimals === 0 ? digits : `${digits.slice(0, -decimals)}.${digits.slice(-decimals)}`;
  return a.amount < 0 ? `-${text}` : text;
}

/**
 * The amount as a person reads it, in her language: « 2 480 000 F CFA », « 12,50 € ». `code` shows
 * the ISO code instead of the symbol, for a document that leaves the country.
 */
export function formatMoney(
  a: Money,
  options: { locale?: string; display?: 'symbol' | 'code' } = {},
): string {
  return new Intl.NumberFormat(options.locale ?? 'fr', {
    style: 'currency',
    currency: a.currency,
    currencyDisplay: options.display === 'code' ? 'code' : 'symbol',
  }).format(Number(toDecimal(a)));
}

/** An amount as it travels in a contract, a command's input, an event. */
export const moneySchema = z.object({
  amount: z.number().int().refine(Number.isSafeInteger, 'A safe integer.'),
  currency: z.string().regex(code),
});
