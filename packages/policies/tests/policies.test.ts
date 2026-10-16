import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Policy } from '@kete/sdk';
import {
  authorizeWith,
  createPolicyEngine,
  currentPolicies,
  decideGesture,
  PolicyError,
  policiesMigrationSql,
  policyVersions,
  readDecisions,
  savePolicy,
  unmet,
} from '../src/index.js';
import { entities, expectations, gesture, policies, schema } from './kya.js';

// Spec 112: one policy engine at the gesture, for a person and an agent alike.

const engine = createPolicyEngine({ schema });

/** An item of a fixture list, which must be there. */
function nth<T>(list: readonly T[], index: number): T {
  const item = list[index];
  if (item === undefined) throw new Error(`No item ${index}.`);
  return item;
}

/** A policy as a person writes it: its version is the store's. */
const said = ({ version, ...policy }: Policy) => {
  void version;
  return policy;
};

describe('the six policies', () => {
  it('decide every gesture of KYA as expected', () => {
    expect(unmet(engine, policies, entities, expectations)).toEqual([]);
  });

  it('read the same gesture by Kossi and by his agent through the same policies', () => {
    const [byKossi, byAgent] = [nth(expectations, 2), nth(expectations, 3)].map((e) =>
      engine.decide({ policies, gesture: e.gesture, entities }),
    );
    expect(byKossi).toMatchObject({ effect: 'approve', approvers: ['manager'] });
    expect(byAgent).toMatchObject({ effect: 'approve', approvers: ['on_behalf_of'] });
  });

  it('say which policy refused, its version and its sentence', () => {
    const stop = engine.decide({ policies, gesture: nth(expectations, 12).gesture, entities });
    expect(stop).toEqual({
      effect: 'refuse',
      policies: [
        {
          id: 'consent.stop',
          version: 1,
          effect: 'refuse',
          reason: 'Un contact qui a écrit STOP ne reçoit plus rien',
        },
      ],
      trial: [],
    });
    // Nothing gave the power: a refusal without a policy.
    expect(
      engine.decide({ policies, gesture: nth(expectations, 6).gesture, entities }),
    ).toMatchObject({
      effect: 'refuse',
      policies: [],
    });
  });
});

describe('a policy on trial', () => {
  const friday = {
    id: 'spend.trial-friday',
    version: 1,
    sentence: 'Un agent n’engage pas plus de 100 000 F',
    rule: `forbid (principal is Kete::Agent, action == Kete::Action::"purchase.commit", resource)
      when { context.amount > 100000 };`,
    set: 'authority' as const,
    owner: 'usr_abla',
    status: 'trial' as const,
  };

  it('never blocks, and says what it would have done', () => {
    const decided = engine.decide({
      policies: [...policies, friday],
      gesture: nth(expectations, 1).gesture,
      entities,
    });
    expect(decided.effect).toBe('allow');
    expect(decided.trial).toEqual([
      { id: 'spend.trial-friday', version: 1, effect: 'refuse', reason: friday.sentence },
    ]);
  });

  it('once active, a contradiction with the table is caught', () => {
    const mismatches = unmet(
      engine,
      [...policies, { ...friday, status: 'active' }],
      entities,
      expectations,
    );
    expect(mismatches.map((m) => m.name)).toEqual([
      'son agent achète 120 000 F pour lui',
      'son agent achète 180 000 F',
    ]);
  });
});

describe('a policy that fails to evaluate', () => {
  it('refuses: the engine never fails open', () => {
    const broken = {
      ...nth(policies, 4),
      id: 'clients.hours-broken',
      // Reads a context attribute the gesture does not carry.
      rule: `forbid (principal is Kete::Agent, action == Kete::Action::"message.client", resource)
        when { context.minute > 30 };`,
    };
    const decided = engine.decide({
      policies: [...policies, broken],
      gesture: nth(expectations, 8).gesture,
      entities,
    });
    expect(decided).toMatchObject({ effect: 'refuse' });
    expect(decided.policies.map((p) => p.id)).toEqual(['clients.hours-broken']);
  });

  it('asks, when it is an approval: never allowed for want of an answer', () => {
    const broken: Policy = {
      ...nth(policies, 5),
      id: 'clients.minute-broken',
      approver: 'direction',
      rule: `permit (principal is Kete::Agent, action == Kete::Action::"message.client", resource)
        when { context.minute > 30 };`,
    };
    const decided = engine.decide({
      policies: [...policies, broken],
      gesture: nth(expectations, 8).gesture,
      entities,
    });
    expect(decided).toMatchObject({ effect: 'approve', approvers: ['direction'] });
  });
});

describe('policies of the same id and version in two organizations', () => {
  it('are decided each by its own rule', () => {
    const one = (rule: string): Policy => ({
      id: 'docs.read',
      version: 1,
      sentence: 'On lit les documents',
      rule,
      set: 'authority',
      owner: 'usr_abla',
      status: 'active',
    });
    const read = gesture({ kind: 'person', id: 'abla' }, 'document.read', {
      kind: 'document',
      id: 'paie',
    });
    const permits = `permit (principal, action == Kete::Action::"document.read", resource);`;
    const forbids = `forbid (principal, action == Kete::Action::"document.read", resource);`;
    expect(engine.decide({ policies: [one(permits)], gesture: read, entities }).effect).toBe(
      'allow',
    );
    expect(engine.decide({ policies: [one(forbids)], gesture: read, entities }).effect).toBe(
      'refuse',
    );
  });
});

describe('checking a rule', () => {
  it('accepts one rule that fits the schema, and refuses the rest', () => {
    expect(engine.check(nth(policies, 0).rule)).toEqual({ ok: true, errors: [] });
    expect(
      engine.check(
        `permit (principal is Kete::Person, action, resource) when { principal.salary > 3 };`,
      ).ok,
    ).toBe(false);
    expect(engine.check(`${nth(policies, 0).rule}\n${nth(policies, 1).rule}`).ok).toBe(false);
    expect(engine.check('permit (principal').ok).toBe(false);
  });
});

describe('kept and journaled', () => {
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

  it('versions a policy and refuses a rule that does not fit', async () => {
    await inOrganization(db.app, 'org_pol_1', async (tx) => {
      const first = said(nth(policies, 4));
      expect(
        await savePolicy(tx, 'org_pol_1', engine, {
          ...first,
          status: 'trial',
          writtenBy: 'usr_abla',
        }),
      ).toMatchObject({ version: 1, status: 'trial' });
      expect(
        await savePolicy(tx, 'org_pol_1', engine, { ...first, writtenBy: 'usr_abla' }),
      ).toMatchObject({ version: 2, status: 'active' });
      expect((await policyVersions(tx, first.id)).map((p) => p.status)).toEqual([
        'trial',
        'active',
      ]);
      await expect(
        savePolicy(tx, 'org_pol_1', engine, {
          ...first,
          rule: 'permit (principal',
          writtenBy: 'usr_abla',
        }),
      ).rejects.toBeInstanceOf(PolicyError);
    });
  });

  it('journals each decision with the policies and versions that made it', async () => {
    await inOrganization(db.app, 'org_pol_2', async (tx) => {
      for (const policy of policies) {
        await savePolicy(tx, 'org_pol_2', engine, { ...said(policy), writtenBy: 'usr_abla' });
      }
      expect(await currentPolicies(tx)).toHaveLength(policies.length);
      const night = await decideGesture(tx, 'org_pol_2', {
        engine,
        gesture: nth(expectations, 9).gesture,
        entities,
      });
      expect(night).toMatchObject({
        effect: 'refuse',
        policies: [{ id: 'clients.hours', version: 1 }],
      });
      await expect(
        decideGesture(tx, 'org_pol_2', {
          engine,
          gesture: gesture({ kind: 'person', id: 'abla' }, 'Purchase', {
            kind: 'project',
            id: 'x',
          }),
          entities,
        }),
      ).rejects.toMatchObject({ code: 'invalid_gesture' });
      const journal = await readDecisions(tx, { policyId: 'clients.hours' });
      expect(journal.map((d) => d.decisionId)).toEqual([night.decisionId]);

      // As @kete/commands asks it: the command's input read as a gesture, decided, journaled.
      const authorize = authorizeWith(tx, 'org_pol_2', {
        engine,
        gestureOf: (input, actor) =>
          gesture(
            { kind: actor.kind as 'person', id: actor.id },
            'purchase.commit',
            { kind: 'project', id: 'colombe' },
            { amount: { value: (input as { amount: number }).amount, currency: 'XOF' } },
          ),
        entitiesOf: () => entities,
      });
      expect(await authorize({ amount: 180000 }, { kind: 'person', id: 'kossi' })).toMatchObject({
        effect: 'approve',
        approvers: ['manager'],
      });
      expect(await readDecisions(tx)).toHaveLength(2);
    });
  });

  it('keeps each organization to its own policies and decisions', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_policies',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (client, organization) => {
        await savePolicy(client, organization, engine, {
          ...said(nth(policies, 0)),
          writtenBy: 'usr_x',
        });
      },
    });
  });
});
