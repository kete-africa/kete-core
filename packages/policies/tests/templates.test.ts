import { inOrganization } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createPolicyEngine,
  decideGesture,
  fillTemplate,
  policiesMigrationSql,
  policyTemplates,
  savePolicy,
  simulatePolicy,
  TemplateError,
} from '../src/index.js';
import { entities, gesture, schema } from './kya.js';

// Spec 139, FR-014: the six policies as sentences with blanks, and what one would have decided.

const engine = createPolicyEngine({ schema });
const filled = {
  amount: 1_000_000,
  approver: 'direction' as const,
  channels: ['whatsapp' as const, 'mail' as const],
  from: 8,
  to: 19,
  days: 3650,
};

describe('the templates', () => {
  it('cover the six families and each gives a rule the schema accepts', () => {
    expect(new Set(policyTemplates.map((t) => t.family))).toEqual(
      new Set(['commits', 'speaks', 'spending', 'deputies', 'retention', 'consent']),
    );
    for (const template of policyTemplates) {
      const policy = fillTemplate(template.id, filled, { owner: 'usr_abla' });
      expect(engine.check(policy.rule), template.id).toEqual({ ok: true, errors: [] });
      expect(policy.status).toBe('trial');
    }
  });

  it('say the sentence with its blanks, in French and in English', () => {
    expect(fillTemplate('spending.above', filled, { owner: 'usr_abla' })).toMatchObject({
      sentence: 'Au-delà de 1 000 000 F, la direction approuve l’achat',
      set: 'approval',
      approver: 'direction',
    });
    expect(
      fillTemplate('speaks.channels', filled, { owner: 'usr_abla', locale: 'en' }).sentence,
    ).toBe('The company writes to clients by WhatsApp or e-mail');
    expect(() =>
      fillTemplate('speaks.agent-hours', { from: 19, to: 8 }, { owner: 'usr_abla' }),
    ).toThrow(TemplateError);
    expect(() => fillTemplate('spending.above', { amount: -1 }, { owner: 'usr_abla' })).toThrow(
      TemplateError,
    );
  });
});

describe('a simulation', () => {
  let db: TestSchema;
  beforeAll(async () => {
    db = await createTestSchema({
      migrate: async (owner, { schema: name, appRole }) => {
        await owner.query(policiesMigrationSql({ schema: name, appRole }));
      },
    });
  });
  afterAll(async () => {
    await db.drop();
  });

  it('says which gestures of the period a policy would have decided otherwise', async () => {
    const org = 'org_pol_simulated';
    await inOrganization(db.app, org, async (tx) => {
      const people = fillTemplate('spending.people', {}, { owner: 'usr_abla' });
      await savePolicy(tx, org, engine, { ...people, status: 'active', writtenBy: 'usr_abla' });
      const since = new Date(Date.now() - 60_000);
      const purchase = (amount: number) =>
        gesture(
          { kind: 'person', id: 'abla' },
          'purchase.commit',
          { kind: 'project', id: 'colombe' },
          {
            amount: { value: amount, currency: 'XOF' },
          },
        );
      for (const amount of [300_000, 1_500_000, 2_500_000]) {
        await decideGesture(tx, org, { engine, gesture: purchase(amount), entities });
      }
      const above = fillTemplate('spending.above', filled, { owner: 'usr_abla' });
      const seen = await simulatePolicy(tx, {
        engine,
        policy: above,
        since,
        entitiesOf: () => entities,
      });
      expect(seen.replayed).toBe(3);
      expect(seen.changed.map((c) => [c.gesture.amount?.value, c.before, c.after])).toEqual([
        [1_500_000, 'allow', 'approve'],
        [2_500_000, 'allow', 'approve'],
      ]);
    });
  });
});
