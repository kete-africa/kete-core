import { type Actor } from '@kete/commands';
import { defineRecord, field, moneySchema } from '@kete/records';
import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  correctDraft,
  DraftError,
  draftsMigrationSql,
  getDraft,
  listDrafts,
  prepareDraft,
  refuseDraft,
  validateDraft,
} from '../src/index.js';

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(draftsMigrationSql({ schema, appRole }));
      await owner.query(`create table quotes (id text primary key, organization_id text not null,
          client text not null, amount integer not null);
        alter table quotes enable row level security;
        create policy quotes_isolation on quotes to ${appRole}
          using (organization_id = current_setting('kete.organization_id', true))
          with check (organization_id = current_setting('kete.organization_id', true));`);
    },
  });
});

afterAll(async () => {
  await db.drop();
});

const quote = defineRecord({
  type: 'quote',
  prefix: 'quo',
  schema: z.object({
    client: field(z.string().min(1), { label: 'quote.client', personal: true, verify: true }),
    total: field(moneySchema, { label: 'quote.total', verify: true }),
  }),
  summarize: (q) => `Devis pour ${q.client}`,
});

const agent: Actor = {
  kind: 'agent',
  id: 'agt_firmo',
  channel: 'whatsapp',
  onBehalfOf: { kind: 'person', id: 'usr_kofi' },
};
const kofi: Actor = { kind: 'person', id: 'usr_kofi', channel: 'web' };

function prepare(organizationId = 'org_a') {
  return inOrganization(db.app, organizationId, (tx) =>
    prepareDraft(tx, {
      organizationId,
      actor: agent,
      recordType: 'quote',
      definition: quote,
      values: { client: 'Ama', total: { amount: 50000, currency: 'XOF' } },
      provenance: {
        client: { source: 'voice', by: agent, certainty: 'medium', evidence: 'fil_voice_1' },
        total: { source: 'inferred', by: agent, certainty: 'low' },
      },
    }),
  );
}

async function quotesCount(organizationId = 'org_a'): Promise<number> {
  return inOrganization(db.app, organizationId, async (tx) => {
    const { rows } = await tx.query(`select 1 from quotes`);
    return rows.length;
  });
}

const applyQuote =
  (organizationId = 'org_a') =>
  async (
    values: Record<string, unknown>,
    tx: Parameters<Parameters<typeof inOrganization>[2]>[0],
  ) => {
    const total = values['total'] as { amount: number };
    const id = `quo_${Math.random().toString(16).slice(2)}`;
    await tx.query(
      `insert into quotes (id, organization_id, client, amount) values ($1, $2, $3, $4)`,
      [id, organizationId, values['client'], total.amount],
    );
    return { quoteId: id };
  };

describe('a record draft', () => {
  it('has no effect until a person validates it', async () => {
    const before = await quotesCount();
    const draft = await prepare();
    expect(draft).toMatchObject({
      kind: 'record',
      status: 'prepared',
      preparedBy: { kind: 'agent', id: 'agt_firmo' },
      onBehalfOf: { kind: 'person', id: 'usr_kofi' },
    });
    expect(draft.provenance['client']).toMatchObject({ source: 'voice', evidence: 'fil_voice_1' });
    expect(await quotesCount()).toBe(before);
    const waiting = await inOrganization(db.app, 'org_a', (tx) => listDrafts(tx));
    expect(waiting.map((d) => d.draftId)).toContain(draft.draftId);
  });

  it('is corrected by a person, field by field, and validated through the same use case', async () => {
    const draft = await prepare();
    const corrected = await inOrganization(db.app, 'org_a', (tx) =>
      correctDraft(tx, {
        draftId: draft.draftId,
        actor: kofi,
        changes: { total: { amount: 45000, currency: 'XOF' } },
        definition: quote,
      }),
    );
    expect(corrected.provenance['total']).toEqual({
      source: 'typed',
      by: { kind: 'person', id: 'usr_kofi' },
    });
    expect(corrected.prepared['total']).toEqual({ amount: 50000, currency: 'XOF' });

    const before = await quotesCount();
    const { draft: validated, result } = await inOrganization(db.app, 'org_a', (tx) =>
      validateDraft(tx, {
        draftId: draft.draftId,
        actor: kofi,
        definition: quote,
        apply: (values) => applyQuote()(values, tx),
      }),
    );
    expect(await quotesCount()).toBe(before + 1);
    expect(validated).toMatchObject({
      status: 'validated',
      decidedBy: { kind: 'person', id: 'usr_kofi' },
      corrections: {
        total: {
          prepared: { amount: 50000, currency: 'XOF' },
          validated: { amount: 45000, currency: 'XOF' },
        },
      },
      result,
    });
  });

  it('is decided by a person only', async () => {
    const draft = await prepare();
    await expect(
      inOrganization(db.app, 'org_a', (tx) =>
        validateDraft(tx, { draftId: draft.draftId, actor: agent, apply: async () => null }),
      ),
    ).rejects.toMatchObject({ code: 'human_required' });
    await expect(
      inOrganization(db.app, 'org_a', (tx) =>
        refuseDraft(tx, { draftId: draft.draftId, actor: agent, reason: 'no' }),
      ),
    ).rejects.toBeInstanceOf(DraftError);
  });

  it('stays waiting when applying it fails', async () => {
    const draft = await prepare();
    await expect(
      inOrganization(db.app, 'org_a', (tx) =>
        validateDraft(tx, {
          draftId: draft.draftId,
          actor: kofi,
          apply: async (values) => {
            await applyQuote()(values, tx);
            throw new Error('numbering unavailable');
          },
        }),
      ),
    ).rejects.toThrow('numbering unavailable');
    const after = await inOrganization(db.app, 'org_a', (tx) => getDraft(tx, draft.draftId));
    expect(after?.status).toBe('prepared');
  });

  it('is frozen by the database once decided', async () => {
    const draft = await prepare();
    const refused = await inOrganization(db.app, 'org_a', (tx) =>
      refuseDraft(tx, { draftId: draft.draftId, actor: kofi, reason: 'Wrong client' }),
    );
    expect(refused).toMatchObject({ status: 'refused', refusalReason: 'Wrong client' });
    await expect(
      inOrganization(db.app, 'org_a', (tx) =>
        validateDraft(tx, { draftId: draft.draftId, actor: kofi, apply: async () => null }),
      ),
    ).rejects.toMatchObject({ code: 'already_decided' });
    const changed = await inOrganization(db.app, 'org_a', async (tx) => {
      const { rows } = await tx.query(
        `update kete_drafts set status = 'prepared', decided_at = null where draft_id = $1 returning 1`,
        [draft.draftId],
      );
      return rows.length;
    });
    expect(changed).toBe(0);
  });

  it('refuses values that do not fit the record, and an unknown provenance', async () => {
    await expect(
      inOrganization(db.app, 'org_a', (tx) =>
        prepareDraft(tx, {
          organizationId: 'org_a',
          actor: agent,
          recordType: 'quote',
          definition: quote,
          values: { total: { amount: 1.5, currency: 'XOF' } },
          provenance: {},
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid_values' });
    await expect(
      inOrganization(db.app, 'org_a', (tx) =>
        prepareDraft(tx, {
          organizationId: 'org_a',
          actor: agent,
          recordType: 'quote',
          values: { client: 'Ama' },
          provenance: { amount: { source: 'voice', by: agent } },
        }),
      ),
    ).rejects.toMatchObject({ code: 'invalid_provenance' });
  });
});

describe('a change proposal', () => {
  it('targets an existing record and its version', async () => {
    const draft = await inOrganization(db.app, 'org_a', (tx) =>
      prepareDraft(tx, {
        organizationId: 'org_a',
        actor: agent,
        recordType: 'quote',
        recordId: 'quo_existing',
        baseVersion: '3',
        values: { total: { amount: 60000, currency: 'XOF' } },
        provenance: { total: { source: 'message', by: agent } },
      }),
    );
    expect(draft).toMatchObject({ kind: 'change', recordId: 'quo_existing', baseVersion: '3' });
  });
});

describe('isolation', () => {
  it('keeps each organization to its own drafts', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_drafts',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (client, organization) => {
        await prepareDraft(client, {
          organizationId: organization,
          actor: agent,
          recordType: 'quote',
          values: { client: 'X' },
          provenance: {},
        });
      },
    });
  });
});
