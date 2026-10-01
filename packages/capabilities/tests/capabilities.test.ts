import { commandsMigrationSql, defineCommand, readJournal, type Actor } from '@kete/commands';
import { draftsMigrationSql, getDraft } from '@kete/drafts';
import { validateCapability } from '@kete/sdk';
import { inOrganization } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createCapabilityRegistry,
  createMcpHandler,
  defineCapability,
  type Caller,
  type CapabilityRegistry,
} from '../src/index.js';

let db: TestSchema;
let registry: CapabilityRegistry;

const person: Actor = { kind: 'person', id: 'usr_ama', channel: 'web' };
const agent: Actor = {
  kind: 'agent',
  id: 'agt_sales',
  channel: 'mcp',
  onBehalfOf: { kind: 'person', id: 'usr_ama' },
};
const visitor: Actor = { kind: 'person', id: 'usr_visitor', channel: 'web' };
const org = 'org_caps';

const tagInput = z.object({ label: z.string().min(1) });
const addTag = defineCommand({
  name: 'add-tag',
  input: tagInput,
  reversibility: { reversible: true, inverse: 'remove-tag' },
  async handler(input, { db: tx, organizationId }) {
    await tx.query(`insert into tags (organization_id, label) values ($1, $2)`, [
      organizationId,
      input.label,
    ]);
    return { label: input.label };
  },
});

const quoteInput = z.object({ client: z.string().min(1), amount: z.number().int().positive() });
const issueQuote = defineCommand({
  name: 'issue-quote',
  input: quoteInput,
  reversibility: { reversible: false },
  async handler(input, { db: tx, organizationId }) {
    await tx.query(`insert into quotes (organization_id, client, amount) values ($1, $2, $3)`, [
      organizationId,
      input.client,
      input.amount,
    ]);
    return { issued: true };
  },
});

const capabilities = [
  defineCapability({
    name: 'tags_list',
    description: 'Lists the tags of the organization.',
    permission: 'tags:read',
    autonomy: 1,
    input: z.object({}),
    async run(_input, { db: tx }) {
      const { rows } = await tx.query<{ label: string }>(`select label from tags order by label`);
      return rows.map((row) => row.label);
    },
  }),
  defineCapability({
    name: 'tags_add',
    description: 'Adds a tag; it can be removed.',
    permission: 'tags:write',
    autonomy: 2,
    input: tagInput,
    command: addTag,
  }),
  defineCapability({
    name: 'quotes_issue',
    description: 'Issues a quote to a client.',
    permission: 'quotes:issue',
    autonomy: 3,
    input: quoteInput,
    command: issueQuote,
    draft: { recordType: 'quote' },
  }),
  defineCapability({
    name: 'payments_send',
    description: 'Sends money: irreversible.',
    permission: 'quotes:issue',
    autonomy: 4,
    input: quoteInput,
    command: issueQuote,
    draft: { recordType: 'payment' },
  }),
];

const permissions: Record<string, string[]> = {
  usr_ama: ['tags:read', 'tags:write', 'quotes:issue'],
  // The agent may only what it is allowed AND what the person it acts for is allowed.
  agt_sales: ['tags:read', 'tags:write', 'quotes:issue'],
  usr_visitor: ['tags:read'],
};

async function count(table: string): Promise<number> {
  return inOrganization(db.app, org, async (tx) => {
    const { rows } = await tx.query(`select 1 from ${table}`);
    return rows.length;
  });
}

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(commandsMigrationSql({ schema, appRole }));
      await owner.query(draftsMigrationSql({ schema, appRole }));
      for (const table of [
        'tags (label text not null',
        'quotes (client text not null, amount integer not null',
      ]) {
        const name = table.split(' ')[0];
        await owner.query(`create table ${table}, organization_id text not null);
          alter table ${name} enable row level security;
          create policy ${name}_isolation on ${name} to ${appRole}
            using (organization_id = current_setting('kete.organization_id', true))
            with check (organization_id = current_setting('kete.organization_id', true));`);
      }
    },
  });
  registry = createCapabilityRegistry(capabilities, {
    async authorize({ actor }, permission) {
      const own = permissions[actor.id]?.includes(permission) ?? false;
      const principal = actor.onBehalfOf;
      return principal ? own && (permissions[principal.id]?.includes(permission) ?? false) : own;
    },
    transaction: (organizationId, work) => inOrganization(db.app, organizationId, work),
  });
});

afterAll(async () => {
  await db.drop();
});

const as = (actor: Actor): Caller => ({ actor, organizationId: org });

describe('what a caller sees', () => {
  it('lists only the capabilities the caller holds, as the capability.v1 contract', async () => {
    const forVisitor = await registry.list(as(visitor));
    expect(forVisitor.map((c) => c.name)).toEqual(['tags_list']);
    const forAma = await registry.list(as(person));
    expect(forAma.map((c) => c.name)).toEqual([
      'tags_list',
      'tags_add',
      'quotes_issue',
      'payments_send',
    ]);
    for (const capability of forAma) expect(validateCapability(capability).ok).toBe(true);
    expect(forAma[1]).toMatchObject({ autonomy: 2, reversible: true, inverse: 'remove-tag' });
  });

  it('refuses a level 2 capability over an irreversible command', () => {
    expect(() =>
      defineCapability({
        name: 'quotes_fast',
        description: 'x',
        permission: 'quotes:issue',
        autonomy: 2,
        input: quoteInput,
        command: issueQuote,
      }),
    ).toThrow(/level 2/);
  });
});

describe('the autonomy scale', () => {
  it('level 1: reads for anyone allowed', async () => {
    expect(await registry.invoke({ ...as(visitor), name: 'tags_list', input: {} })).toEqual({
      status: 'done',
      output: [],
    });
  });

  it('level 2: an agent acts, the command is journaled, and the result says how to undo it', async () => {
    const result = await registry.invoke({
      ...as(agent),
      name: 'tags_add',
      input: { label: 'vip' },
    });
    expect(result).toMatchObject({ status: 'done', output: { label: 'vip' }, undo: 'remove-tag' });
    const journal = await inOrganization(db.app, org, (tx) => readJournal(tx));
    expect(journal[0]).toMatchObject({ name: 'add-tag', actor: { kind: 'agent' }, channel: 'mcp' });
  });

  it('level 3: an agent only prepares a draft; nothing is issued', async () => {
    const before = await count('quotes');
    const result = await registry.invoke({
      ...as(agent),
      name: 'quotes_issue',
      input: { client: 'Kofi', amount: 50000 },
    });
    expect(result.status).toBe('draft');
    expect(await count('quotes')).toBe(before);
    const draft = await inOrganization(db.app, org, (tx) =>
      getDraft(tx, (result as { draftId: string }).draftId),
    );
    expect(draft).toMatchObject({
      status: 'prepared',
      recordType: 'quote',
      preparedBy: { kind: 'agent', id: 'agt_sales' },
      provenance: { client: { source: 'inferred' } },
    });
  });

  it('level 3: a person decides and it runs', async () => {
    const before = await count('quotes');
    const result = await registry.invoke({
      ...as(person),
      name: 'quotes_issue',
      input: { client: 'Kofi', amount: 50000 },
    });
    expect(result).toMatchObject({ status: 'done', output: { issued: true } });
    expect(await count('quotes')).toBe(before + 1);
  });

  it('level 4: even a person must confirm explicitly', async () => {
    const input = { client: 'Kofi', amount: 1000 };
    expect(await registry.invoke({ ...as(person), name: 'payments_send', input })).toMatchObject({
      status: 'confirmation_required',
    });
    expect(
      await registry.invoke({ ...as(person), name: 'payments_send', input, confirmed: true }),
    ).toMatchObject({ status: 'done' });
  });

  it('refuses an unknown capability, a missing right and an invalid input', async () => {
    expect(await registry.invoke({ ...as(person), name: 'nope', input: {} })).toEqual({
      status: 'refused',
      reason: 'unknown_capability',
    });
    expect(
      await registry.invoke({ ...as(visitor), name: 'tags_add', input: { label: 'x' } }),
    ).toEqual({ status: 'refused', reason: 'not_allowed' });
    expect(
      await registry.invoke({ ...as(person), name: 'tags_add', input: { label: '' } }),
    ).toMatchObject({ status: 'refused', reason: 'invalid_input' });
  });

  it('never gives an agent more than the person it acts for', async () => {
    const forVisitor: Actor = { ...agent, onBehalfOf: { kind: 'person', id: 'usr_visitor' } };
    expect(
      await registry.invoke({ ...as(forVisitor), name: 'tags_add', input: { label: 'x' } }),
    ).toEqual({ status: 'refused', reason: 'not_allowed' });
  });
});

describe('through MCP', () => {
  async function connect(caller: Caller | null): Promise<Client> {
    const handler = createMcpHandler({
      registry,
      server: { name: 'kete-test', version: '0.0.0' },
      caller: async () => caller,
    });
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL('http://kete.test/mcp'), {
      fetch: (url, init) => handler(new Request(url, init)),
    });
    // The SDK's types predate exactOptionalPropertyTypes (its sessionId may be undefined).
    await client.connect(transport as unknown as Parameters<Client['connect']>[0]);
    return client;
  }

  it('lists the caller’s tools and invokes them under the same rules', async () => {
    const client = await connect(as(agent));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(
      ['payments_send', 'quotes_issue', 'tags_add', 'tags_list'].sort(),
    );
    const called = await client.callTool({
      name: 'quotes_issue',
      arguments: { client: 'Ama', amount: 1200 },
    });
    expect(called.structuredContent).toMatchObject({ status: 'draft' });
    await client.close();
  });

  it('shows a visitor only what she may use', async () => {
    const client = await connect(as(visitor));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['tags_list']);
    await client.close();
  });

  it('refuses a caller the host does not recognize', async () => {
    await expect(connect(null)).rejects.toThrow();
  });
});
