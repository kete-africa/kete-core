import { inOrganization, type SqlExecutor } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  formatNumber,
  lastNumber,
  nextNumber,
  SequenceError,
  sequencesMigrationSql,
} from '../src/index.js';

// Spec 095: an organization's documents are numbered without a gap and without a duplicate. The
// number is taken in the transaction that writes the document; each organization has its own.

let db: TestSchema;
const as = <T>(organizationId: string, work: (client: SqlExecutor) => Promise<T>) =>
  inOrganization(db.app, organizationId, work);
const BLEU = 'org_bleu_001';
const VERT = 'org_vert_002';
const invoices = { series: 'invoice', period: '2026' };

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(sequencesMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

describe('the numbers of an organization’s documents', () => {
  it('follow each other from 1, each organization on its own', async () => {
    expect(await as(BLEU, (client) => nextNumber(client, BLEU, invoices))).toBe(1);
    expect(await as(BLEU, (client) => nextNumber(client, BLEU, invoices))).toBe(2);
    expect(await as(VERT, (client) => nextNumber(client, VERT, invoices))).toBe(1);
    expect(await as(BLEU, (client) => lastNumber(client, invoices))).toBe(2);
    // One organization never reads another's series.
    expect(await as(VERT, (client) => lastNumber(client, invoices))).toBe(1);
    expect(await as('org_autre_003', (client) => lastNumber(client, invoices))).toBe(0);
  });

  it('keep each series and each period apart', async () => {
    expect(await as(BLEU, (client) => nextNumber(client, BLEU, { series: 'quote' }))).toBe(1);
    expect(
      await as(BLEU, (client) => nextNumber(client, BLEU, { series: 'invoice', period: '2027' })),
    ).toBe(1);
    expect(await as(BLEU, (client) => lastNumber(client, invoices))).toBe(2);
  });

  it('leave no gap when the document is not written', async () => {
    await expect(
      as(BLEU, async (client) => {
        expect(await nextNumber(client, BLEU, invoices)).toBe(3);
        throw new Error('the invoice could not be written');
      }),
    ).rejects.toThrow('could not be written');
    // The number went back with the transaction: the next invoice takes it.
    expect(await as(BLEU, (client) => nextNumber(client, BLEU, invoices))).toBe(3);
  });

  it('never give the same number twice, whoever asks at the same moment', async () => {
    const taken = await Promise.all(
      Array.from({ length: 12 }, () => as(VERT, (client) => nextNumber(client, VERT, invoices))),
    );
    expect([...taken].sort((a, b) => a - b)).toEqual(Array.from({ length: 12 }, (_, i) => i + 2));
  });

  it('are not hers to rewind: no row is deleted by the application', async () => {
    await expect(as(BLEU, (client) => client.query('delete from kete_sequences'))).rejects.toThrow(
      /permission denied/,
    );
  });

  it('refuse a series or a period that is not one', async () => {
    await expect(
      as(BLEU, (client) => nextNumber(client, BLEU, { series: 'Factures 2026' })),
    ).rejects.toBeInstanceOf(SequenceError);
    await expect(
      as(BLEU, (client) => nextNumber(client, BLEU, { series: 'invoice', period: 'octobre' })),
    ).rejects.toBeInstanceOf(SequenceError);
  });
});

describe('a document’s reference', () => {
  const day = new Date('2026-10-13T09:00:00Z');

  it('is written from its number and its date', () => {
    expect(formatNumber('F-{YYYY}-{N:4}', 412, day)).toBe('F-2026-0412');
    expect(formatNumber('D-{N:4}', 98, day)).toBe('D-0098');
    expect(formatNumber('BC{YY}{MM}-{N}', 7, day)).toBe('BC2610-7');
    // A number larger than its padding is never cut.
    expect(formatNumber('F-{N:4}', 12_345, day)).toBe('F-12345');
  });

  it('refuses a pattern without a number, and a number that is not one', () => {
    expect(() => formatNumber('F-{YYYY}', 1, day)).toThrow(SequenceError);
    expect(() => formatNumber('F-{N}', 0, day)).toThrow(SequenceError);
    expect(() => formatNumber('F-{N}', 1.5, day)).toThrow(SequenceError);
  });
});
