import {
  commandsDelegationMigrationSql,
  commandsMigrationSql,
  defineCommand,
  type Actor,
} from '@kete/commands';
import { draftsMigrationSql } from '@kete/drafts';
import { validateDataset, validateDatasetAnswer, validateManifest } from '@kete/sdk';
import { inOrganization } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  createCapabilityRegistry,
  createDatasetRegistry,
  createHttpApi,
  defineCapability,
  defineDataset,
  type Caller,
} from '../src/index.js';

// Spec 045: a product's capabilities and data sets over HTTP, for other apps and dashboards, with
// the same rights and autonomy rules as its screens and MCP.

let db: TestSchema;
let api: (request: Request) => Promise<Response>;
const org = 'org_http';
const project = 'prj_0000aaaa';

const ama: Actor = { kind: 'person', id: 'usr_ama', channel: 'api' };
// Another app acting for Ama through the API: it prepares, it never decides.
const app: Actor = {
  kind: 'app',
  id: 'app_enterprise',
  channel: 'api',
  onBehalfOf: { kind: 'person', id: 'usr_ama' },
};
const visitor: Actor = { kind: 'person', id: 'usr_visitor', channel: 'api' };
const permissions: Record<string, string[]> = {
  usr_ama: ['tags:read', 'tags:write', 'quotes:read', 'quotes:issue'],
  app_enterprise: ['tags:read', 'tags:write', 'quotes:read', 'quotes:issue'],
  usr_visitor: ['tags:read'],
};

const addTag = defineCommand({
  name: 'add-tag',
  input: z.object({ label: z.string().min(1) }),
  reversibility: { reversible: true, inverse: 'remove-tag' },
  async handler(input, { db: tx, organizationId }) {
    await tx.query(`insert into tags (organization_id, label, day) values ($1, $2, $3)`, [
      organizationId,
      input.label,
      '2026-10-03',
    ]);
    return { label: input.label };
  },
});
const issueQuote = defineCommand({
  name: 'issue-quote',
  input: z.object({ client: z.string().min(1), amount: z.number().int().positive() }),
  reversibility: { reversible: false },
  handler: async () => ({ issued: true }),
});

const tagRow = z.object({ label: z.string(), day: z.string(), uses: z.number() });

const datasets = [
  defineDataset({
    name: 'tags_by_day',
    description: 'Each tag, the day it was added and how often it is used.',
    permission: 'tags:read',
    row: tagRow,
    time: 'day',
    measures: ['uses'],
    dimensions: ['label'],
    async rows(query, { db: tx }) {
      const { rows } = await tx.query<{ label: string; day: string; uses: number }>(
        `select label, to_char(day, 'YYYY-MM-DD') as day, uses from tags
          where ($1::date is null or day >= $1::date) and ($2::date is null or day <= $2::date)
          order by day, label limit $3`,
        [query.from ?? null, query.to ?? null, query.limit],
      );
      return rows;
    },
  }),
  // Its rows carry a project (spec 144): a question filtered on it is summed up here.
  defineDataset({
    name: 'tag_uses',
    description: 'How often each tag is used, by project.',
    permission: 'tags:read',
    row: tagRow.extend({ project_id: z.string().nullable() }),
    time: 'day',
    measures: ['uses'],
    dimensions: ['label'],
    axes: { project: 'project_id' },
    async rows(query, { db: tx }) {
      const { rows } = await tx.query<{
        label: string;
        day: string;
        uses: number;
        project_id: string | null;
      }>(
        `select label, to_char(day, 'YYYY-MM-DD') as day, uses, project_id from tags
          where ($1::date is null or day >= $1::date) and ($2::date is null or day <= $2::date)
          order by day, label limit $3`,
        [query.from ?? null, query.to ?? null, query.limit],
      );
      return rows;
    },
  }),
  defineDataset({
    name: 'quotes_issued',
    description: 'The quotes issued.',
    permission: 'quotes:read',
    row: z.object({ client: z.string() }),
    rows: async () => [],
  }),
];

const as = (actor: Actor): Caller => ({ actor, organizationId: org });

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(commandsMigrationSql({ schema, appRole }));
      await owner.query(commandsDelegationMigrationSql({ schema }));
      await owner.query(draftsMigrationSql({ schema, appRole }));
      await owner.query(`create table tags (organization_id text not null, label text not null,
          day date not null, uses integer not null default 1, project_id text);
        alter table tags enable row level security;
        create policy tags_isolation on tags to ${appRole}
          using (organization_id = current_setting('kete.organization_id', true))
          with check (organization_id = current_setting('kete.organization_id', true));`);
      await owner.query(`insert into tags (organization_id, label, day, uses, project_id) values
        ('${org}', 'a', '2026-09-01', 3, '${project}'), ('${org}', 'b', '2026-09-15', 1, '${project}'),
        ('${org}', 'a', '2026-09-20', 4, '${project}'), ('${org}', 'c', '2026-10-01', 2, null),
        ('org_other', 'z', '2026-09-10', 9, '${project}')`);
    },
  });
  const host = {
    async authorize({ actor }: Caller, permission: string) {
      const own = permissions[actor.id]?.includes(permission) ?? false;
      const principal = actor.onBehalfOf;
      return principal ? own && (permissions[principal.id]?.includes(permission) ?? false) : own;
    },
    transaction: <T>(organizationId: string, work: Parameters<typeof inOrganization<T>>[2]) =>
      inOrganization(db.app, organizationId, work),
  };
  const registry = createCapabilityRegistry(
    [
      defineCapability({
        name: 'tags_add',
        description: 'Adds a tag; it can be removed.',
        permission: 'tags:write',
        autonomy: 2,
        input: addTag.input,
        command: addTag,
      }),
      defineCapability({
        name: 'quotes_issue',
        description: 'Issues a quote.',
        permission: 'quotes:issue',
        autonomy: 3,
        input: issueQuote.input,
        command: issueQuote,
        draft: { recordType: 'quote' },
      }),
    ],
    host,
  );
  const callers: Record<string, Actor> = { ama, app, visitor };
  api = createHttpApi({
    registry,
    datasets: createDatasetRegistry(datasets, host),
    prefix: '/api/v1',
    resourceMetadataUrl: 'https://app.test/.well-known/oauth-protected-resource',
    caller: async (request) => {
      const who = /^Bearer (\w+)$/.exec(request.headers.get('authorization') ?? '')?.[1];
      const actor = who ? callers[who] : undefined;
      return actor ? as(actor) : null;
    },
  });
});

afterAll(async () => {
  await db.drop();
});

const call = async (who: string | null, method: string, path: string, body?: unknown) => {
  const response = await api(
    new Request(`https://app.test/api/v1${path}`, {
      method,
      headers: {
        ...(who ? { authorization: `Bearer ${who}` } : {}),
        'content-type': 'application/json',
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  );
  return {
    status: response.status,
    headers: response.headers,
    body: (await response.json()) as Record<string, unknown>,
  };
};

describe('the API of a product', () => {
  it('asks for a token, and says where to get one', async () => {
    const answer = await call(null, 'GET', '/capabilities');
    expect(answer.status).toBe(401);
    expect(answer.headers.get('www-authenticate')).toContain('resource_metadata=');
  });

  it('lists only what the caller may use', async () => {
    const forVisitor = (await call('visitor', 'GET', '/capabilities')).body
      .capabilities as unknown[];
    expect(forVisitor).toEqual([]);
    const forAma = (await call('ama', 'GET', '/capabilities')).body.capabilities as {
      name: string;
    }[];
    expect(forAma.map((c) => c.name)).toEqual(['tags_add', 'quotes_issue']);
  });

  it('runs a reversible gesture and says how to undo it; an app only prepares a decision', async () => {
    const added = await call('app', 'POST', '/capabilities/tags_add', { label: 'd' });
    expect(added).toMatchObject({ status: 200, body: { status: 'done', undo: 'remove-tag' } });
    const prepared = await call('app', 'POST', '/capabilities/quotes_issue', {
      client: 'Ama',
      amount: 12000,
    });
    expect(prepared).toMatchObject({ status: 202, body: { status: 'draft' } });
  });

  it('refuses with the right status', async () => {
    expect((await call('visitor', 'POST', '/capabilities/tags_add', { label: 'x' })).status).toBe(
      403,
    );
    expect((await call('ama', 'POST', '/capabilities/nothing', {})).status).toBe(404);
    expect((await call('ama', 'POST', '/capabilities/tags_add', { label: '' })).status).toBe(422);
  });
});

describe('the data sets of a product', () => {
  it('describes them by the dataset.v1 contract, and only those the caller may read', async () => {
    const forVisitor = (await call('visitor', 'GET', '/datasets')).body.datasets as {
      name: string;
    }[];
    expect(forVisitor.map((d) => d.name)).toEqual(['tags_by_day', 'tag_uses']);
    for (const d of forVisitor) expect(validateDataset(d).ok).toBe(true);
    expect(forVisitor[0]).toMatchObject({ time: 'day', measures: ['uses'], dimensions: ['label'] });
    expect(forVisitor[1]).toMatchObject({ axes: { project: 'project_id' } });
  });

  it('serves rows of the caller’s organization only, filtered by dates and limited', async () => {
    const all = await call('visitor', 'GET', '/datasets/tags_by_day');
    expect((all.body.rows as { label: string }[]).map((r) => r.label)).toEqual([
      'a',
      'b',
      'a',
      'c',
      'd',
    ]);
    const september = await call(
      'visitor',
      'GET',
      '/datasets/tags_by_day?from=2026-09-01&to=2026-09-30&limit=1',
    );
    expect(september.body).toMatchObject({ rows: [{ label: 'a', uses: 3 }], truncated: true });
  });

  it('refuses an unknown set, a set not allowed, and a bad query', async () => {
    expect((await call('visitor', 'GET', '/datasets/nothing')).status).toBe(404);
    expect((await call('visitor', 'GET', '/datasets/quotes_issued')).status).toBe(403);
    expect((await call('visitor', 'GET', '/datasets/tags_by_day?from=yesterday')).status).toBe(422);
    expect((await call('visitor', 'GET', '/datasets/tags_by_day?limit=0')).status).toBe(422);
  });

  it('sums its rows up at home for a question, on a project, and answers only the groups', async () => {
    const asked = await call('visitor', 'POST', '/datasets/tag_uses/query', {
      filter: { project_id: project, party_id: 'pty_0000bbbb' },
      group_by: ['label'],
      measures: [{ fn: 'sum', field: 'uses' }, { fn: 'count' }],
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(asked.status).toBe(200);
    expect(validateDatasetAnswer(asked.body).ok).toBe(true);
    // Its organization's rows only; the party, an axis it does not carry, is left out — and said.
    expect(asked.body).toMatchObject({
      dataset: 'tag_uses',
      rows: [
        { label: 'a', 'sum(uses)': 7, count: 2 },
        { label: 'b', 'sum(uses)': 1, count: 1 },
      ],
      counted: 3,
      truncated: false,
      filter: { project_id: project },
    });
    // Nothing to count is an answer: 0 rows, and a sum that is not zero but nothing.
    const none = await call('visitor', 'POST', '/datasets/tag_uses/query', {
      measures: [{ fn: 'count' }, { fn: 'sum', field: 'uses' }],
      from: '2030-01-01',
    });
    expect(none.body).toMatchObject({ rows: [{ count: 0, 'sum(uses)': null }], counted: 0 });
  });

  it('refuses a question on what it does not have, or a sum of words', async () => {
    const ask = (body: unknown, set = 'tag_uses') =>
      call('visitor', 'POST', `/datasets/${set}/query`, body);
    expect((await ask({ measures: [{ fn: 'count' }], group_by: ['price'] })).body.error).toBe(
      'unknown_field',
    );
    expect((await ask({ measures: [{ fn: 'sum', field: 'label' }] })).body.error).toBe(
      'not_a_number',
    );
    expect((await ask({ measures: [] })).status).toBe(422);
    expect((await ask({ measures: [{ fn: 'count' }] }, 'quotes_issued')).status).toBe(403);
    expect((await ask({ measures: [{ fn: 'count' }] }, 'nothing')).status).toBe(404);
    expect((await call('visitor', 'GET', '/datasets/tag_uses/query')).status).toBe(405);
  });

  it('refuses a declaration whose fields do not exist', () => {
    expect(() =>
      defineDataset({
        name: 'broken',
        description: 'x',
        permission: 'tags:read',
        row: tagRow,
        measures: ['price' as 'uses'],
        rows: async () => [],
      }),
    ).toThrow(/price/);
  });

  it('fits in a manifest with the app’s endpoints', () => {
    const manifest = {
      product: 'prd_tags',
      name: 'Tags',
      version: '1.0.0',
      environment: 'staging',
      events: [],
      datasets: [
        {
          name: 'tags_by_day',
          description: 'x',
          permission: 'tags:read',
          row: { type: 'object' },
        },
      ],
      endpoints: { mcp: 'https://app.test/mcp', api: 'https://app.test/api/v1' },
    };
    expect(validateManifest(manifest).ok).toBe(true);
  });
});
