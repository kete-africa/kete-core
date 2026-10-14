import type { Actor } from '@kete/commands';
import { validateResource } from '@kete/sdk';
import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  autonomyProof,
  budgetOf,
  nextState,
  nextWake,
  reviewerFor,
  wokenBy,
  type Decision,
  type Trigger,
} from '../src/index.js';
import {
  askPromotion,
  decideLesson,
  decidePromotion,
  gatherLesson,
  lessonsOf,
  lifecycleMigrationSql,
  readinessOf,
  recordCases,
  registerResource,
} from '../src/server.js';

// Spec 105 (doctrine D-053): Afi's skill « Relance polie » learns from Essi's correction, passes
// its cases, and climbs to her team once Kossi, the team's lead, approves. Its agent sleeps,
// works, waits for her, and earns its next level by proofs.

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(lifecycleMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db.drop();
});

const person = (id: string): Actor => ({ kind: 'person', id, channel: 'web' });
const afi = person('usr_afi');
const kossi = person('usr_kossi');
const agent: Actor = {
  kind: 'agent',
  id: 'agt_relances',
  channel: 'web',
  onBehalfOf: { kind: 'person', id: 'usr_afi' },
};
const skill = { kind: 'skill' as const, id: 'relance-polie' };
const inA = <T>(work: Parameters<typeof inOrganization<T>>[2]) =>
  inOrganization(db.app, 'org_a', work);

describe('a skill’s lifecycle', () => {
  it('learns from a lesson gathered with consent, decided by its owner only', async () => {
    const created = await inA((tx) =>
      registerResource(tx, 'org_a', {
        ...skill,
        name: 'Relance polie',
        owner: 'usr_afi',
        version: '1.0',
      }),
    );
    expect(created).toMatchObject({ tier: 'me', cases: { total: 0, passed: 0 } });
    expect(validateResource(created).ok).toBe(true);
    await expect(
      inA((tx) =>
        gatherLesson(tx, 'org_a', {
          resource: skill,
          source: 'correction',
          observed: 'x',
          consent: false,
        }),
      ),
    ).rejects.toMatchObject({ code: 'consent_required' });
    const lesson = await inA((tx) =>
      gatherLesson(tx, 'org_a', {
        resource: skill,
        source: 'correction',
        observed: 'Essi a retiré « dernier rappel » d’une première relance.',
        proposal: 'Ne jamais écrire « dernier rappel » avant la troisième relance.',
        case: 'Première relance, facture de 412 000 F en retard de 9 jours.',
        consent: true,
      }),
    );
    expect(lesson).toMatchObject({ state: 'waiting', consent: true });
    expect(lesson.id).toMatch(/^lsn_/);
    await expect(
      inA((tx) => decideLesson(tx, lesson.id, { by: kossi, keep: true })),
    ).rejects.toMatchObject({ code: 'not_owner' });
    await expect(
      inA((tx) => decideLesson(tx, lesson.id, { by: agent, keep: true })),
    ).rejects.toMatchObject({ code: 'human_required' });
    expect(await inA((tx) => decideLesson(tx, lesson.id, { by: afi, keep: true }))).toMatchObject({
      state: 'kept',
      case: 'Première relance, facture de 412 000 F en retard de 9 jours.',
    });
    expect(await inA((tx) => lessonsOf(tx, skill, 'kept'))).toHaveLength(1);
    await expect(
      inA((tx) => decideLesson(tx, lesson.id, { by: afi, keep: false })),
    ).rejects.toMatchObject({ code: 'already_decided' });
  });

  it('climbs one tier, with its cases passing, its lessons decided, reviewed by the role its risk names', async () => {
    const before = await inA((tx) => readinessOf(tx, skill));
    expect(before.readiness).toEqual({ ready: false, missing: ['cases'] });
    await inA((tx) => recordCases(tx, skill, '1.0', { total: 4, passed: 3 }));
    await inA((tx) =>
      gatherLesson(tx, 'org_a', {
        resource: skill,
        source: 'note',
        observed: 'Trop long sur WhatsApp.',
        consent: true,
      }),
    );
    expect((await inA((tx) => readinessOf(tx, skill))).readiness).toEqual({
      ready: false,
      missing: ['cases_failing', 'lessons_waiting'],
    });
    const [waiting] = await inA((tx) => lessonsOf(tx, skill));
    await inA((tx) => decideLesson(tx, waiting?.id ?? '', { by: afi, keep: false }));
    // A result for another version than the current one is ignored.
    expect(await inA((tx) => recordCases(tx, skill, '0.9', { total: 4, passed: 4 }))).toBeNull();
    await inA((tx) => recordCases(tx, skill, '1.0', { total: 4, passed: 4 }));
    await expect(
      inA((tx) => askPromotion(tx, skill, { by: kossi, risk: 'low' })),
    ).rejects.toMatchObject({ code: 'not_owner' });
    const asked = await inA((tx) => askPromotion(tx, skill, { by: afi, risk: 'low' }));
    expect(asked.review).toEqual({ state: 'asked', risk: 'low', by: 'team_lead' });
    await expect(
      inA((tx) => decidePromotion(tx, skill, { by: afi, roles: ['team_lead'], approve: true })),
    ).rejects.toMatchObject({ code: 'own_promotion' });
    await expect(
      inA((tx) => decidePromotion(tx, skill, { by: kossi, roles: ['member'], approve: true })),
    ).rejects.toMatchObject({ code: 'not_reviewer' });
    const promoted = await inA((tx) =>
      decidePromotion(tx, skill, { by: kossi, roles: ['team_lead'], approve: true }),
    );
    expect(promoted).toMatchObject({ tier: 'team', review: { state: 'approved' } });
    // The next tier asks more cases; a new version must pass them again.
    expect((await inA((tx) => readinessOf(tx, skill))).readiness).toEqual({
      ready: false,
      missing: ['cases'],
    });
    const next = await inA((tx) =>
      registerResource(tx, 'org_a', {
        ...skill,
        name: 'Relance polie',
        owner: 'usr_afi',
        version: '1.1',
      }),
    );
    expect(next).toMatchObject({ tier: 'team', version: '1.1', cases: { total: 0, passed: 0 } });
    expect(reviewerFor('low', 'organization')).toBe('unit_head');
    expect(reviewerFor('high', 'team')).toBe('admin');
  });

  it('stays in its organization', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_resources',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (client, organization) => {
        await registerResource(client, organization, {
          kind: 'agent',
          id: 'agt_x',
          name: 'X',
          owner: 'usr_x',
          version: '1.0',
        });
      },
    });
  });
});

describe('an agent at work', () => {
  it('moves through its six states; stopped is final', () => {
    let state = nextState('asleep', 'trigger');
    expect(state).toBe('working');
    state = nextState(state, 'needs_person');
    expect(state).toBe('waiting');
    expect(nextState(state, 'done')).toBe('waiting');
    state = nextState(nextState(state, 'answered'), 'blocked');
    expect(state).toBe('blocked');
    expect(nextState(nextState(state, 'unblocked'), 'budget_exhausted')).toBe('paused');
    expect(nextState('paused', 'resume')).toBe('asleep');
    expect(nextState('working', 'stop')).toBe('stopped');
    expect(nextState('stopped', 'resume')).toBe('stopped');
  });

  it('spends within its budget, and wakes on its routine or an app’s event', () => {
    expect(budgetOf(1840, 5000)).toEqual({ left: 3160, ratio: 0.368, state: 'ok' });
    expect(budgetOf(4100, 5000).state).toBe('low');
    expect(budgetOf(5200, 5000)).toMatchObject({ left: 0, state: 'exhausted' });
    const triggers: Trigger[] = [
      { kind: 'routine', routine: { every: 'week', at: '08:00', weekday: 1 } },
      { kind: 'event', type: 'finance.invoice_overdue', when: { days: 7 } },
    ];
    expect(wokenBy(triggers, { type: 'finance.invoice_overdue', data: { days: 7 } })).toBe(true);
    expect(wokenBy(triggers, { type: 'finance.invoice_overdue', data: { days: 3 } })).toBe(false);
    expect(
      new Date(nextWake(triggers, Date.parse('2026-10-14T09:00:00Z')) ?? 0).toISOString(),
    ).toBe('2026-10-19T08:00:00.000Z');
    expect(nextWake([triggers[1] as Trigger], Date.now())).toBeNull();
  });

  it('earns the level above on a gesture by proofs — never by itself', () => {
    const decisions: Decision[] = [
      { gesture: 'write_reminder', outcome: 'refused' },
      ...Array.from({ length: 19 }, (): Decision => ({
        gesture: 'write_reminder',
        outcome: 'accepted',
      })),
      { gesture: 'write_reminder', outcome: 'corrected' },
      { gesture: 'send_reminder', outcome: 'accepted' },
    ];
    expect(autonomyProof(decisions, 'write_reminder')).toEqual({
      gesture: 'write_reminder',
      weighed: 20,
      accepted: 19,
      corrected: 1,
      refused: 0,
      eligible: true,
    });
    expect(autonomyProof(decisions, 'send_reminder').eligible).toBe(false);
    expect(autonomyProof(decisions, 'write_reminder', { needed: 21 }).eligible).toBe(false);
  });
});
