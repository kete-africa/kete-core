import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  actorSchema,
  CommandError,
  commandsDelegationMigrationSql,
  commandsMigrationSql,
  MAX_DELEGATION_DEPTH,
  defineCommand,
  executeCommand,
  readJournal,
  type Actor,
} from '../src/index.js';

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(commandsMigrationSql({ schema, appRole }));
      await owner.query(commandsDelegationMigrationSql({ schema }));
      // Idempotent: an app may run it again.
      await owner.query(commandsDelegationMigrationSql({ schema }));
      await owner.query(`create table deposits (id text primary key, organization_id text not null,
          items integer not null, state text not null default 'open');
        alter table deposits enable row level security;
        create policy deposits_isolation on deposits to ${appRole}
          using (organization_id = current_setting('kete.organization_id', true))
          with check (organization_id = current_setting('kete.organization_id', true));`);
    },
  });
});

afterAll(async () => {
  await db.drop();
});

const person: Actor = { kind: 'person', id: 'usr_ama', channel: 'web' };
const agent: Actor = {
  kind: 'agent',
  id: 'agt_sales',
  channel: 'mcp',
  onBehalfOf: { kind: 'person', id: 'usr_ama' },
};
let calls = 0;

const createDeposit = defineCommand({
  name: 'create-deposit',
  input: z.object({ id: z.string(), items: z.number().int().positive() }),
  reversibility: { reversible: true, inverse: 'cancel-deposit' },
  async handler(input, { db: tx, organizationId }) {
    calls += 1;
    await tx.query(`insert into deposits (id, organization_id, items) values ($1, $2, $3)`, [
      input.id,
      organizationId,
      input.items,
    ]);
    return { id: input.id };
  },
  summarize: (input) => `Dépôt ${input.id} de ${input.items} articles`,
});

const failing = defineCommand({
  name: 'fail-after-write',
  input: z.object({ id: z.string() }),
  reversibility: { reversible: false },
  async handler(input, { db: tx, organizationId }) {
    await tx.query(`insert into deposits (id, organization_id, items) values ($1, $2, 1)`, [
      input.id,
      organizationId,
    ]);
    throw new Error('provider refused');
  },
});

describe('executeCommand', () => {
  it('runs the handler and journals who, on behalf of whom, through which channel', async () => {
    const result = await inOrganization(db.app, 'org_a', (tx) =>
      executeCommand(tx, createDeposit, {
        organizationId: 'org_a',
        actor: agent,
        idempotencyKey: 'key-deposit-1',
        input: { id: 'dep_1', items: 3 },
        reason: 'Ama dictated it',
      }),
    );
    expect(result.replayed).toBe(false);
    expect(result.output).toEqual({ id: 'dep_1' });
    const [entry] = await inOrganization(db.app, 'org_a', (tx) => readJournal(tx));
    expect(entry).toMatchObject({
      commandId: result.commandId,
      name: 'create-deposit',
      summary: 'Dépôt dep_1 de 3 articles',
      reason: 'Ama dictated it',
      actor: { kind: 'agent', id: 'agt_sales' },
      onBehalfOf: { kind: 'person', id: 'usr_ama' },
      channel: 'mcp',
      reversible: true,
      inverse: 'cancel-deposit',
    });
  });

  it('replays the same result for the same key, without running again', async () => {
    const before = calls;
    const again = await inOrganization(db.app, 'org_a', (tx) =>
      executeCommand(tx, createDeposit, {
        organizationId: 'org_a',
        actor: agent,
        idempotencyKey: 'key-deposit-1',
        input: { items: 3, id: 'dep_1' },
      }),
    );
    expect(again.replayed).toBe(true);
    expect(again.output).toEqual({ id: 'dep_1' });
    expect(calls).toBe(before);
  });

  it('refuses the same key for another input', async () => {
    await expect(
      inOrganization(db.app, 'org_a', (tx) =>
        executeCommand(tx, createDeposit, {
          organizationId: 'org_a',
          actor: person,
          idempotencyKey: 'key-deposit-1',
          input: { id: 'dep_2', items: 1 },
        }),
      ),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('leaves nothing behind when the handler fails, and the key stays free', async () => {
    await expect(
      inOrganization(db.app, 'org_a', (tx) =>
        executeCommand(tx, failing, {
          organizationId: 'org_a',
          actor: person,
          idempotencyKey: 'key-fail-1',
          input: { id: 'dep_lost' },
        }),
      ),
    ).rejects.toThrow('provider refused');
    const left = await inOrganization(db.app, 'org_a', async (tx) => {
      const { rows } = await tx.query(`select 1 from deposits where id = 'dep_lost'`);
      const journal = await readJournal(tx, { name: 'fail-after-write' });
      return rows.length + journal.length;
    });
    expect(left).toBe(0);
  });

  it('refuses an invalid input, actor or key, and a transaction of another organization', async () => {
    const run = (overrides: Record<string, unknown>) =>
      inOrganization(db.app, 'org_a', (tx) =>
        executeCommand(tx, createDeposit, {
          organizationId: 'org_a',
          actor: person,
          idempotencyKey: 'key-invalid-1',
          input: { id: 'dep_x', items: 1 },
          ...overrides,
        }),
      );
    await expect(run({ input: { id: 'dep_x', items: -1 } })).rejects.toMatchObject({
      code: 'invalid_input',
    });
    await expect(run({ actor: { kind: 'robot', id: 'x', channel: 'web' } })).rejects.toMatchObject({
      code: 'invalid_actor',
    });
    await expect(run({ idempotencyKey: 'short' })).rejects.toMatchObject({
      code: 'invalid_idempotency_key',
    });
    await expect(run({ organizationId: 'org_b' })).rejects.toBeInstanceOf(CommandError);
  });

  it('names commands in kebab case and requires a named inverse', () => {
    expect(() =>
      defineCommand({
        name: 'CreateDeposit',
        input: z.object({}),
        reversibility: { reversible: false },
        handler: async () => null,
      }),
    ).toThrow();
  });
});

describe('a chain of agents (doctrine D-039)', () => {
  const analyst: Actor = {
    kind: 'agent',
    id: 'agt_analyst',
    channel: 'mcp',
    onBehalfOf: { kind: 'person', id: 'usr_ama' },
    delegatedBy: [{ kind: 'agent', id: 'agt_ama' }],
    traceId: 'trc_pipeline-review',
  };

  it('journals the agents that asked and the trace of the task', async () => {
    await inOrganization(db.app, 'org_a', (tx) =>
      executeCommand(tx, createDeposit, {
        organizationId: 'org_a',
        actor: analyst,
        idempotencyKey: 'key-chain-1',
        input: { id: 'dep_chain', items: 2 },
      }),
    );
    const [entry] = await inOrganization(db.app, 'org_a', (tx) =>
      readJournal(tx, { traceId: 'trc_pipeline-review' }),
    );
    expect(entry).toMatchObject({
      actor: { kind: 'agent', id: 'agt_analyst' },
      onBehalfOf: { kind: 'person', id: 'usr_ama' },
      delegatedBy: [{ kind: 'agent', id: 'agt_ama' }],
      traceId: 'trc_pipeline-review',
    });
    // A gesture nobody delegated keeps an empty chain.
    const journal = await inOrganization(db.app, 'org_a', (tx) => readJournal(tx));
    const direct = journal.find((e) => e.actor.id === 'agt_sales');
    expect(direct).toMatchObject({ delegatedBy: [], traceId: null });
  });

  it('refuses a chain that does not go back to a person, repeats an agent or is too long', () => {
    const refused = (actor: Record<string, unknown>) =>
      expect(actorSchema.safeParse({ ...analyst, ...actor }).success).toBe(false);
    refused({ onBehalfOf: undefined });
    refused({ onBehalfOf: { kind: 'agent', id: 'agt_boss' } });
    refused({ kind: 'person', id: 'usr_kofi' });
    refused({ delegatedBy: [{ kind: 'person', id: 'usr_kofi' }] });
    refused({ delegatedBy: [{ kind: 'agent', id: 'agt_analyst' }] });
    refused({ delegatedBy: [] });
    refused({
      delegatedBy: Array.from({ length: MAX_DELEGATION_DEPTH + 1 }, (_, i) => ({
        kind: 'agent',
        id: `agt_${i}`,
      })),
    });
    refused({ traceId: 'short' });
    expect(actorSchema.safeParse(analyst).success).toBe(true);
    // An agent alone, or a person, is still an actor as before.
    expect(actorSchema.safeParse(agent).success).toBe(true);
    expect(actorSchema.safeParse(person).success).toBe(true);
  });
});

describe('the journal', () => {
  it('is append-only: the application role can neither change nor delete an entry', async () => {
    await expect(
      inOrganization(db.app, 'org_a', (tx) => tx.query(`update kete_commands set summary = 'x'`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      inOrganization(db.app, 'org_a', (tx) => tx.query(`delete from kete_commands`)),
    ).rejects.toThrow(/permission denied/);
  });

  it('is isolated per organization', async () => {
    let n = 0;
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_commands',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (client, organization) => {
        n += 1;
        await executeCommand(client, createDeposit, {
          organizationId: organization,
          actor: person,
          idempotencyKey: `key-isolation-${n}`,
          input: { id: `dep_iso_${n}`, items: 1 },
        });
      },
    });
  });
});
