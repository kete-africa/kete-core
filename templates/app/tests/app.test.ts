import { readFileSync } from 'node:fs';
import type { KeteIdentity } from '@kete/auth';
import { createMcpHandler, type Caller } from '@kete/capabilities';
import { readJournal } from '@kete/commands';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrations } from '../db/migrations';
import { completed, reopened, TaskRuleError } from '../src/features/tasks/domain/task';
import { listTasks } from '../src/features/tasks/infrastructure/task.table';
import { transaction, usePool } from '../src/platform/db';
import { manifest } from '../src/platform/events';
import { registry } from '../src/platform/registry';
import { asPerson } from '../src/platform/rights';
import { screenActor } from '../src/platform/session';

// The template's proof (spec 029): every building block wired, and the example feature works on
// every surface under the same rules.

let db: TestSchema;

const person = (userId: string, role: KeteIdentity['role'], organizationId = 'org_a') =>
  ({
    userId,
    email: `${userId}@example.test`,
    name: userId,
    organizationId,
    role,
    apps: {},
    twoFactor: false,
    expiresAt: new Date(Date.now() + 60_000),
  }) satisfies KeteIdentity;

const ama = person('usr_ama', 'owner');
const kofi = person('usr_kofi', 'member');

const onScreen = (identity: KeteIdentity): Caller => ({
  actor: screenActor(identity),
  organizationId: identity.organizationId ?? '',
});
const agentFor = (identity: KeteIdentity): Caller => ({
  actor: {
    kind: 'agent',
    id: 'agt_mcp',
    channel: 'mcp',
    onBehalfOf: { kind: 'person', id: identity.userId },
  },
  organizationId: identity.organizationId ?? '',
});

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, context) => {
      for (const migration of migrations) await owner.query(migration.sql(context));
    },
  });
  usePool(db.app);
});

afterAll(async () => {
  await db.drop();
});

async function connect(identity: KeteIdentity): Promise<Client> {
  const handler = createMcpHandler({
    registry,
    server: { name: 'app-template', version: '0.0.0' },
    caller: async () => agentFor(identity),
    views: [{ uri: 'ui://kete/review', name: 'review', html: async () => '<!doctype html>' }],
    draftUrl: (id) => `https://app.test/verification/${id}`,
  });
  const client = new Client({ name: 'copilot', version: '0.0.0' });
  const transport = new StreamableHTTPClientTransport(new URL('https://app.test/mcp'), {
    fetch: (url, init) => asPerson(identity, () => handler(new Request(url, init))),
  });
  await client.connect(transport as unknown as Parameters<Client['connect']>[0]);
  return client;
}

describe('the rules of a task', () => {
  it('completes an open task and reopens a done one, never twice', () => {
    expect(completed('open')).toBe('done');
    expect(reopened('done')).toBe('open');
    expect(() => completed('done')).toThrow(TaskRuleError);
    expect(() => reopened('open')).toThrow(TaskRuleError);
  });
});

describe('an agent and a person, through MCP', () => {
  it('the agent prepares a task; the person validates it in her copilot’s view', async () => {
    const client = await connect(ama);
    const prepared = await client.callTool({
      name: 'tasks_create',
      arguments: { title: 'Relancer Efua', dueOn: '2026-10-15' },
    });
    const { draftId, openUrl } = prepared.structuredContent as { draftId: string; openUrl: string };
    expect(prepared.structuredContent).toMatchObject({ status: 'draft' });
    expect(openUrl).toBe(`https://app.test/verification/${draftId}`);
    expect(await transaction('org_a', (tx) => listTasks(tx))).toHaveLength(0);

    const validated = await client.callTool({
      name: 'kete_draft_validate',
      arguments: { draftId },
    });
    expect(validated.structuredContent).toMatchObject({ status: 'validated' });
    const [task] = await transaction('org_a', (tx) => listTasks(tx));
    expect(task).toMatchObject({ title: 'Relancer Efua', dueOn: '2026-10-15', status: 'open' });
    await client.close();
  });

  it('the agent completes a task alone, and the journal says how to undo it', async () => {
    const [task] = await transaction('org_a', (tx) => listTasks(tx, 'open'));
    const done = await asPerson(ama, () =>
      registry.invoke({
        ...agentFor(ama),
        name: 'tasks_complete',
        input: { taskId: task?.taskId },
      }),
    );
    expect(done).toMatchObject({ status: 'done', undo: 'reopen-task' });
    const [entry] = await transaction('org_a', (tx) => readJournal(tx));
    expect(entry).toMatchObject({
      name: 'complete-task',
      actor: { kind: 'agent' },
      channel: 'mcp',
    });
  });

  it('the agent lists the tasks as a table its copilot shows', async () => {
    const listed = await asPerson(kofi, () =>
      registry.invoke({ ...agentFor(kofi), name: 'tasks_list', input: {} }),
    );
    expect(listed).toMatchObject({ status: 'done', output: { view: 'table' } });
  });
});

describe('rights', () => {
  it('a member may not add a task, nor an agent acting for her', async () => {
    const input = { title: 'Rien' };
    for (const caller of [onScreen(kofi), agentFor(kofi)]) {
      expect(
        await asPerson(kofi, () => registry.invoke({ ...caller, name: 'tasks_create', input })),
      ).toEqual({ status: 'refused', reason: 'not_allowed' });
    }
  });

  it('an owner adds one from her screen at once', async () => {
    const added = await asPerson(ama, () =>
      registry.invoke({ ...onScreen(ama), name: 'tasks_create', input: { title: 'Inventaire' } }),
    );
    expect(added).toMatchObject({ status: 'done' });
  });

  it('nobody signed in may do anything', async () => {
    expect(
      await asPerson(null, () =>
        registry.invoke({ ...onScreen(ama), name: 'tasks_list', input: {} }),
      ),
    ).toEqual({ status: 'refused', reason: 'not_allowed' });
  });
});

describe('the organization is the boundary', () => {
  it('keeps each organization’s tasks to itself (RLS)', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'tasks',
      organizations: ['org_x', 'org_y'],
      insert: async (client, organizationId) => {
        await client.query(
          `insert into tasks (task_id, organization_id, title, created_by) values ($1, $2, 'x', 'usr_x')`,
          [`tsk_${organizationId}`, organizationId],
        );
      },
    });
  });
});

describe('what the app says about itself', () => {
  it('serves a valid manifest, and the same words in every language', () => {
    expect(manifest()).toMatchObject({ product: 'prd_app_template', events: [] });
    const fr = JSON.parse(readFileSync(new URL('../messages/fr.json', import.meta.url), 'utf8'));
    const en = JSON.parse(readFileSync(new URL('../messages/en.json', import.meta.url), 'utf8'));
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
});
