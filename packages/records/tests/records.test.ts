import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  addMoney,
  assertTransition,
  canTransition,
  defineRecord,
  field,
  formatMoney,
  isEffective,
  isId,
  minorDigits,
  moneySchema,
  newId,
  prefixOf,
  redactPersonal,
  TransitionError,
} from '../src/index.js';

const deposit = defineRecord({
  type: 'deposit',
  prefix: 'dep',
  schema: z.object({
    customerName: field(z.string().min(1), { label: 'deposit.customer_name', personal: true }),
    customerPhone: field(z.string().optional(), {
      label: 'deposit.customer_phone',
      personal: true,
      verify: true,
    }),
    items: field(z.number().int().positive(), { label: 'deposit.items', verify: true }),
    total: field(moneySchema, { label: 'deposit.total' }),
    note: z.string().optional(),
  }),
  summarize: (d) => `Dépôt de ${d.items} articles pour ${d.customerName}`,
});

describe('defineRecord', () => {
  it('describes every field once, with its metadata', () => {
    expect(deposit.fields).toEqual([
      {
        name: 'customerName',
        required: true,
        label: 'deposit.customer_name',
        personal: true,
        verify: false,
      },
      {
        name: 'customerPhone',
        required: false,
        label: 'deposit.customer_phone',
        personal: true,
        verify: true,
      },
      { name: 'items', required: true, label: 'deposit.items', personal: false, verify: true },
      { name: 'total', required: true, label: 'deposit.total', personal: false, verify: false },
      { name: 'note', required: false, label: 'note', personal: false, verify: false },
    ]);
  });

  it('gives its JSON Schema, for MCP tools and other languages', () => {
    const schema = deposit.jsonSchema() as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(Object.keys(schema.properties)).toEqual([
      'customerName',
      'customerPhone',
      'items',
      'total',
      'note',
    ]);
    expect(schema.required).toEqual(['customerName', 'items', 'total']);
  });

  it('summarizes a record in one sentence', () => {
    expect(
      deposit.summarize({
        customerName: 'Ama',
        items: 3,
        total: { amount: 1500, currency: 'XOF' },
      }),
    ).toBe('Dépôt de 3 articles pour Ama');
  });

  it('redacts personal fields', () => {
    expect(
      redactPersonal(deposit.schema, { customerName: 'Ama', customerPhone: null, items: 3 }),
    ).toEqual({ customerName: '[personal]', customerPhone: null, items: 3 });
  });

  it('refuses a type or a prefix that is not plain', () => {
    expect(() => defineRecord({ ...deposit, type: 'Deposit' })).toThrow(TypeError);
    expect(() => defineRecord({ ...deposit, prefix: 'deposit' })).toThrow(TypeError);
  });
});

describe('lifecycle', () => {
  it('follows draft → to verify → validated → cancelled or archived', () => {
    expect(canTransition('draft', 'to_verify')).toBe(true);
    expect(canTransition('to_verify', 'validated')).toBe(true);
    expect(canTransition('to_verify', 'draft')).toBe(true);
    expect(canTransition('validated', 'cancelled')).toBe(true);
    expect(canTransition('cancelled', 'archived')).toBe(true);
    expect(canTransition('validated', 'draft')).toBe(false);
    expect(canTransition('archived', 'validated')).toBe(false);
    expect(() => assertTransition('cancelled', 'validated')).toThrow(TransitionError);
  });

  it('counts a record only once validated', () => {
    expect(isEffective('validated')).toBe(true);
    expect(isEffective('draft')).toBe(false);
    expect(isEffective('to_verify')).toBe(false);
  });
});

describe('identifiers', () => {
  it('are prefixed, time-ordered and recognizable', () => {
    const first = newId('dep');
    const second = newId('dep');
    expect(first).toMatch(/^dep_[0-9a-f-]{36}$/);
    expect(prefixOf(first)).toBe('dep');
    expect(isId('dep', first)).toBe(true);
    expect(isId('cli', first)).toBe(false);
    expect(first < second || first.slice(0, 17) === second.slice(0, 17)).toBe(true);
    expect(() => newId('Dep')).toThrow(TypeError);
  });
});

describe('money', () => {
  it('is an integer of the smallest unit, with its currency', () => {
    expect(moneySchema.safeParse({ amount: 5000, currency: 'XOF' }).success).toBe(true);
    expect(moneySchema.safeParse({ amount: 12.5, currency: 'EUR' }).success).toBe(false);
    expect(moneySchema.safeParse({ amount: 5000, currency: 'cfa' }).success).toBe(false);
  });

  it('knows each currency has its own decimals', () => {
    expect(minorDigits('XOF')).toBe(0);
    expect(minorDigits('GHS')).toBe(2);
    expect(formatMoney({ amount: 1250, currency: 'EUR' }, 'en')).toBe('€12.50');
    expect(formatMoney({ amount: 5000, currency: 'XOF' }, 'fr')).toMatch(/5\s000/);
  });

  it('adds amounts of one currency, never two', () => {
    expect(addMoney({ amount: 1000, currency: 'XOF' }, { amount: 2500, currency: 'XOF' })).toEqual({
      amount: 3500,
      currency: 'XOF',
    });
    expect(() =>
      addMoney({ amount: 1000, currency: 'XOF' }, { amount: 100, currency: 'GHS' }),
    ).toThrow(TypeError);
  });
});
