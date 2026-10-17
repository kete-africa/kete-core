import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  consumption,
  defineMeters,
  keteMeters,
  measure,
  meteringMigrationSql,
  unavailable,
} from '../src/index.js';

// Spec 120: who consumed what — KYA's assistant spends tokens, Pono's sandbox runs minutes, a
// provider is silent one day: each total says whether it is known, estimated or has a gap.

const meters = defineMeters(keteMeters, [
  { name: 'pono.previews', unit: 'preview', label: { fr: 'Aperçus', en: 'Previews' } },
]);

describe('meters', () => {
  it('are declared once, with a name and a unit', () => {
    expect(() => defineMeters(keteMeters, keteMeters)).toThrow(/twice/);
    expect(() =>
      defineMeters([{ name: 'Tokens', unit: 'token', label: { fr: 'x', en: 'x' } }]),
    ).toThrow(/name/);
    expect(() =>
      defineMeters([{ name: 'ai.x', unit: 'Kilo Tokens', label: { fr: 'x', en: 'x' } }]),
    ).toThrow(/unit/);
    expect(meters.require('pono.previews').unit).toBe('preview');
    expect(() => meters.require('ai.nope')).toThrow(/No meter/);
  });
});

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(meteringMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

const day = (d: number, h = 9) => new Date(Date.UTC(2026, 9, d, h));

describe('consumption', () => {
  const org = 'org_kya';

  it('adds what was counted, says when a figure was estimated or has a gap', async () => {
    await inOrganization(db.app, org, async (tx) => {
      const assistant = { kind: 'agent', id: 'agt_assistant' } as const;
      const afi = { kind: 'person', id: 'usr_afi' } as const;
      expect(
        await measure(tx, org, meters, {
          meter: 'ai.tokens',
          quantity: 12_000,
          certainty: 'known',
          subject: assistant,
          source: 'kete-ai',
          from: day(14),
          key: 'call-1',
        }),
      ).toBe(true);
      // A retried job: kept once.
      expect(
        await measure(tx, org, meters, {
          meter: 'ai.tokens',
          quantity: 12_000,
          certainty: 'known',
          subject: assistant,
          source: 'kete-ai',
          from: day(14),
          key: 'call-1',
        }),
      ).toBe(false);
      await measure(tx, org, meters, {
        meter: 'ai.tokens',
        quantity: 3_000,
        certainty: 'known',
        subject: afi,
        source: 'kete-ai',
        from: day(15),
      });
      await measure(tx, org, meters, {
        meter: 'sandbox.minutes',
        quantity: 42.5,
        certainty: 'estimated',
        source: 'sandbox',
        from: day(15, 8),
        to: day(15, 9),
      });
      await unavailable(tx, org, meters, {
        meter: 'sandbox.minutes',
        source: 'sandbox',
        from: day(16),
        to: day(17),
        reason: 'The provider did not answer.',
      });
      await expect(
        measure(tx, org, meters, {
          meter: 'ai.tokens',
          quantity: -1,
          certainty: 'known',
          source: 'kete-ai',
          from: day(15),
        }),
      ).rejects.toMatchObject({ code: 'invalid_measure' });
      await expect(
        measure(tx, org, meters, {
          meter: 'ai.nope',
          quantity: 1,
          certainty: 'known',
          source: 'kete-ai',
          from: day(15),
        }),
      ).rejects.toMatchObject({ code: 'unknown_meter' });

      const october = await consumption(tx, { from: day(1, 0), to: day(31, 0) });
      expect(october).toEqual([
        { meter: 'ai.tokens', subject: null, quantity: 15_000, certainty: 'known', gaps: 0 },
        {
          meter: 'sandbox.minutes',
          subject: null,
          quantity: 42.5,
          certainty: 'unavailable',
          gaps: 1,
        },
      ]);
      // Before the gap, the sandbox's figure is an estimate.
      expect(
        await consumption(tx, { from: day(15, 0), to: day(16, 0), meter: 'sandbox.minutes' }),
      ).toMatchObject([{ quantity: 42.5, certainty: 'estimated', gaps: 0 }]);
      // By who consumed.
      expect(
        await consumption(tx, {
          from: day(1, 0),
          to: day(31, 0),
          meter: 'ai.tokens',
          bySubject: true,
        }),
      ).toEqual([
        { meter: 'ai.tokens', subject: assistant, quantity: 12_000, certainty: 'known', gaps: 0 },
        { meter: 'ai.tokens', subject: afi, quantity: 3_000, certainty: 'known', gaps: 0 },
      ]);
    });
  });

  it('keeps each organization to its own measures, never changed', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_measures',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (tx, organizationId) => {
        await measure(tx, organizationId, meters, {
          meter: 'deploy.count',
          quantity: 1,
          certainty: 'known',
          source: 'pono',
          from: day(15),
        });
      },
    });
    await expect(
      inOrganization(db.app, org, (tx) => tx.query(`update kete_measures set quantity = 0`)),
    ).rejects.toThrow(/permission denied/);
  });
});
