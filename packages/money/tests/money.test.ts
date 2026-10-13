import { describe, expect, it } from 'vitest';
import {
  add,
  allocate,
  compare,
  decimalsOf,
  formatMoney,
  money,
  MoneyError,
  moneySchema,
  multiply,
  parseMoney,
  percent,
  subtract,
  sum,
  toDecimal,
  zero,
} from '../src/index.js';

// Spec 094: an amount is an integer count of its currency's smallest unit. Every figure is
// computed here — never a float, never two currencies in one sum, never a unit lost in a split.

const cfa = (amount: number) => money(amount, 'XOF');
const text = (value: string) => value.replace(/\s/g, ' ');

describe('an amount of money', () => {
  it('is a whole number of its currency’s smallest unit', () => {
    expect(decimalsOf('XOF')).toBe(0);
    expect(decimalsOf('EUR')).toBe(2);
    expect(money(2_480_000, 'XOF')).toEqual({ amount: 2_480_000, currency: 'XOF' });
    expect(() => money(12.5, 'XOF')).toThrow(MoneyError);
    expect(() => money(Number.NaN, 'XOF')).toThrow(MoneyError);
    expect(() => money(100, 'cfa')).toThrow(MoneyError);
  });

  it('is read exactly as a person writes it, and never rounded on the way in', () => {
    expect(parseMoney('2 480 000', 'XOF')).toEqual(cfa(2_480_000));
    expect(parseMoney('12,50', 'EUR')).toEqual(money(1250, 'EUR'));
    expect(parseMoney('1 250.5', 'EUR')).toEqual(money(125_050, 'EUR'));
    expect(parseMoney('-40 000', 'XOF')).toEqual(cfa(-40_000));
    expect(parseMoney('18500,00', 'XOF')).toEqual(cfa(18_500));
    expect(() => parseMoney('18 500,50', 'XOF')).toThrow(MoneyError);
    expect(() => parseMoney('12,505', 'EUR')).toThrow(MoneyError);
    expect(() => parseMoney('douze', 'EUR')).toThrow(MoneyError);
  });

  it('adds up without a float’s drift, and never across currencies', () => {
    // 0.1 + 0.2 is not 0.3 in floats; ten cents and twenty cents are thirty.
    expect(add(money(10, 'EUR'), money(20, 'EUR'))).toEqual(money(30, 'EUR'));
    expect(sum([cfa(620_000), cfa(180_000), cfa(96_000)], 'XOF')).toEqual(cfa(896_000));
    expect(sum([], 'XOF')).toEqual(zero('XOF'));
    expect(subtract(cfa(992_000), cfa(896_000))).toEqual(cfa(96_000));
    expect(() => add(cfa(1000), money(1000, 'EUR'))).toThrow(MoneyError);
    expect(() => compare(cfa(1), money(1, 'EUR'))).toThrow(MoneyError);
    expect(compare(cfa(190_000), cfa(130_000))).toBe(1);
  });

  it('is multiplied and taxed with one rounding, half away from zero', () => {
    expect(multiply(cfa(245_000), 8)).toEqual(cfa(1_960_000));
    expect(multiply(cfa(8_000), 2.5)).toEqual(cfa(20_000));
    expect(multiply(cfa(333), 0.5)).toEqual(cfa(167));
    expect(multiply(cfa(-333), 0.5)).toEqual(cfa(-167));
    expect(percent(cfa(2_480_000), 18)).toEqual(cfa(446_400));
    expect(percent(money(1999, 'EUR'), 20)).toEqual(money(400, 'EUR'));
    expect(percent(cfa(2_480_000), 5)).toEqual(cfa(124_000));
  });

  it('is split without losing a unit', () => {
    // A deposit of 40 %, then 30 % and 30 %.
    expect(allocate(cfa(2_480_000), [40, 30, 30])).toEqual([
      cfa(992_000),
      cfa(744_000),
      cfa(744_000),
    ]);
    // 100 F in three: the parts add up to the whole.
    const thirds = allocate(cfa(100), [1, 1, 1]);
    expect(thirds).toEqual([cfa(34), cfa(33), cfa(33)]);
    expect(sum(thirds, 'XOF')).toEqual(cfa(100));
    expect(sum(allocate(money(1001, 'EUR'), [70, 20, 10]), 'EUR')).toEqual(money(1001, 'EUR'));
    expect(allocate(cfa(-100), [1, 1, 1])).toEqual([cfa(-34), cfa(-33), cfa(-33)]);
    expect(() => allocate(cfa(100), [])).toThrow(MoneyError);
    expect(() => allocate(cfa(100), [0, 0])).toThrow(MoneyError);
    expect(() => allocate(cfa(100), [1, -1])).toThrow(MoneyError);
  });

  it('is shown as a person reads it, in her language', () => {
    expect(toDecimal(money(1250, 'EUR'))).toBe('12.50');
    expect(toDecimal(money(-5, 'EUR'))).toBe('-0.05');
    expect(toDecimal(cfa(2_480_000))).toBe('2480000');
    expect(text(formatMoney(cfa(2_480_000)))).toBe('2 480 000 F CFA');
    expect(text(formatMoney(money(1250, 'EUR')))).toBe('12,50 €');
    expect(text(formatMoney(cfa(2_480_000), { display: 'code' }))).toBe('2 480 000 XOF');
    expect(formatMoney(money(1250, 'EUR'), { locale: 'en' })).toBe('€12.50');
  });

  it('travels as an integer and a currency code', () => {
    expect(moneySchema.safeParse({ amount: 2_480_000, currency: 'XOF' }).success).toBe(true);
    expect(moneySchema.safeParse({ amount: 12.5, currency: 'EUR' }).success).toBe(false);
    expect(moneySchema.safeParse({ amount: 12, currency: 'eur' }).success).toBe(false);
  });
});
