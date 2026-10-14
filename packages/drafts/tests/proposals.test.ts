import type { Actor } from '@kete/commands';
import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applySet,
  dismissSet,
  getProposalSet,
  proposalSetsFor,
  ProposalSetError,
  proposalSetsMigrationSql,
  proposeSet,
  undoSet,
  type ProposalItem,
} from '../src/index.js';

// Spec 104 (doctrine D-051): Afi's evening — she said what her day was, the assistant proposes four
// gestures; she ticks three, applies them together, and undoes them together.

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(proposalSetsMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db.drop();
});

const afi: Actor = { kind: 'person', id: 'usr_afi', channel: 'web' };
const assistant: Actor = {
  kind: 'agent',
  id: 'agt_assistant',
  channel: 'web',
  onBehalfOf: { kind: 'person', id: 'usr_afi' },
};
const evening: [ProposalItem, ProposalItem, ...ProposalItem[]] = [
  {
    key: 'close-quote',
    gesture: 'close',
    label: 'Clore « Devis Pharmacie du Port »',
    level: 2,
    capability: 'tasks_complete',
    input: { taskId: 'tsk_1' },
    ticked: true,
  },
  {
    key: 'remind-bank',
    gesture: 'remind',
    label: 'Me rappeler Ecobank jeudi 9 h',
    level: 1,
    ticked: true,
  },
  {
    key: 'move-report',
    gesture: 'postpone',
    label: 'Reporter le rapport au Fonds à lundi',
    reason: 'Vous avez dit manquer de temps.',
    level: 2,
    ticked: true,
  },
  { key: 'cancel-order', gesture: 'correct', label: 'Annuler la commande BC-0031', level: 4 },
];
const inA = <T>(work: Parameters<typeof inOrganization<T>>[2]) =>
  inOrganization(db.app, 'org_a', work);

describe('a proposal set', () => {
  it('is kept for her, in the contract, and refused when it breaks it', async () => {
    const kept = await inA((tx) =>
      proposeSet(tx, 'org_a', { origin: 'closure', for: 'usr_afi', items: evening }),
    );
    expect(kept.set.id).toMatch(/^pps_/);
    expect(kept.status).toBe('proposed');
    expect(await inA((tx) => proposalSetsFor(tx, 'usr_afi'))).toHaveLength(1);
    await expect(
      inA((tx) =>
        proposeSet(tx, 'org_a', {
          origin: 'closure',
          for: 'usr_afi',
          items: [{ ...evening[0], level: 7 }],
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid' });
    await expect(
      inA((tx) =>
        proposeSet(tx, 'org_a', {
          origin: 'closure',
          for: 'usr_afi',
          items: [evening[0], evening[0]],
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid' });
  });

  it('applies what she ticked together; an irreversible gesture waits for its own confirmation', async () => {
    const { set } = await inA((tx) =>
      proposeSet(tx, 'org_a', { origin: 'closure', for: 'usr_afi', items: evening }),
    );
    const applied: string[] = [];
    // An agent never decides for her.
    await expect(
      inA((tx) =>
        applySet(tx, set.id, {
          by: assistant,
          ticked: ['close-quote'],
          apply: async () => ({ ok: true }),
        }),
      ),
    ).rejects.toBeInstanceOf(ProposalSetError);
    const decided = await inA((tx) =>
      applySet(tx, set.id, {
        by: afi,
        ticked: ['close-quote', 'move-report', 'cancel-order'],
        apply: async (item) => {
          applied.push(item.key);
          return item.key === 'move-report'
            ? { ok: false, reason: 'not_found' }
            : { ok: true, result: { commandId: `cmd_${item.key}` } };
        },
      }),
    );
    expect(applied).toEqual(['close-quote', 'move-report']);
    expect(decided.status).toBe('applied');
    expect(decided.outcomes).toEqual([
      { key: 'close-quote', state: 'applied', result: { commandId: 'cmd_close-quote' } },
      { key: 'remind-bank', state: 'not_ticked' },
      { key: 'move-report', state: 'failed', reason: 'not_found' },
      { key: 'cancel-order', state: 'needs_confirmation' },
    ]);
    await expect(
      inA((tx) => applySet(tx, set.id, { by: afi, ticked: [], apply: async () => ({ ok: true }) })),
    ).rejects.toMatchObject({ code: 'already_decided' });

    // Undone together: what was applied, with what applying it returned.
    const undone: unknown[] = [];
    const back = await inA((tx) =>
      undoSet(tx, set.id, { by: afi, undo: async (_item, result) => (undone.push(result), true) }),
    );
    expect(undone).toEqual([{ commandId: 'cmd_close-quote' }]);
    expect(back.status).toBe('undone');
    expect(back.outcomes[0]).toEqual({ key: 'close-quote', state: 'undone' });
    expect((await inA((tx) => getProposalSet(tx, set.id)))?.status).toBe('undone');
  });

  it('is dismissed whole, and frozen once dismissed', async () => {
    const { set } = await inA((tx) =>
      proposeSet(tx, 'org_a', { origin: 'plan', for: 'usr_afi', items: evening }),
    );
    const dismissed = await inA((tx) => dismissSet(tx, set.id, afi));
    expect(dismissed.outcomes.every((o) => o.state === 'not_ticked')).toBe(true);
    await expect(
      inA((tx) => undoSet(tx, set.id, { by: afi, undo: async () => true })),
    ).rejects.toMatchObject({ code: 'not_applied' });
    // The database itself refuses to change it.
    await expect(
      inA((tx) =>
        tx.query(
          `update kete_proposal_sets set status = 'proposed', decided_at = null where proposal_set_id = $1`,
          [set.id],
        ),
      ),
    ).resolves.toMatchObject({ rowCount: 0 });
  });

  it('stays in its organization', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_proposal_sets',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (client, organization) => {
        await proposeSet(client, organization, {
          origin: 'agent',
          for: 'usr_x',
          items: [evening[1]],
        });
      },
    });
  });
});
