import { createTestSchema, type TestSchema } from '@kete/testing';
import { MemoryPG } from '@mastra/pg';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  agentConversations,
  agentConversationsMigrationSql,
  organizationPool,
  runAgent,
} from '../src/index.js';
import { RUNTIME_DDL, RUNTIME_TABLES } from '../src/runtime-tables.js';

// Spec 089: the runtime's own tables live under the organizations' row-level security. The
// runtime knows nothing of organizations; every statement it sends runs inside one.

let db: TestSchema;

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
/** A model that answers with how many messages it was given: what it remembers is counted. */
const counting = () =>
  new MockLanguageModelV4({
    doGenerate: (options) =>
      Promise.resolve({
        content: [
          {
            type: 'text' as const,
            text: `Reçu ${options.prompt.filter((message) => message.role !== 'system').length} message(s).`,
          },
        ],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage,
        warnings: [],
      }),
  });

const of = (organizationId: string) =>
  agentConversations({ pool: db.app, organizationId, schema: db.schema });
const say = (organizationId: string, threadId: string, personId: string, text: string) =>
  runAgent({
    agent: 'agt_trial',
    instructions: 'You answer briefly.',
    model: counting(),
    messages: [{ role: 'user', content: text }],
    conversation: { store: of(organizationId), threadId, personId },
  });

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(agentConversationsMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

describe('the runtime’s tables', () => {
  it('are the ones the installed runtime would create: a difference is a new migration', () => {
    const tidy = (statement: string) =>
      statement
        .replace(/\s+/g, ' ')
        .replace(/ ,/g, ',')
        .replace(/\( /g, '(')
        .replace(/ \)/g, ')')
        .trim();
    expect(MemoryPG.getExportDDL('SCHEMA').map(tidy)).toEqual(RUNTIME_DDL);
  });

  it('each have row-level security, and a policy for the application role', async () => {
    const { rows } = await db.owner.query<{ table: string; secured: boolean; policies: number }>(
      `select c.relname as table, c.relrowsecurity as secured,
              (select count(*)::int from pg_policies p
                where p.schemaname = $1 and p.tablename = c.relname) as policies
         from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = $1 and c.relkind = 'r' order by c.relname`,
      [db.schema],
    );
    expect(rows.map((row) => row.table)).toEqual([...RUNTIME_TABLES].sort());
    for (const row of rows) expect(row).toMatchObject({ secured: true, policies: 1 });
  });
});

describe('a conversation kept by the runtime', () => {
  it('is remembered from one turn to the next', async () => {
    expect((await say('org_bleu', 'thr_ama_1', 'usr_ama', 'Bonjour, je suis Ama.')).text).toBe(
      'Reçu 1 message(s).',
    );
    // Her first message, the first answer, and what she says now.
    expect((await say('org_bleu', 'thr_ama_1', 'usr_ama', 'Et hier ?')).text).toBe(
      'Reçu 3 message(s).',
    );
    const bleu = of('org_bleu');
    expect(await bleu.list('usr_ama')).toMatchObject([{ threadId: 'thr_ama_1' }]);
    expect(await bleu.read('thr_ama_1', 'usr_ama')).toMatchObject([
      { role: 'user', text: 'Bonjour, je suis Ama.' },
      { role: 'assistant', text: 'Reçu 1 message(s).' },
      { role: 'user', text: 'Et hier ?' },
      { role: 'assistant', text: 'Reçu 3 message(s).' },
    ]);
  });

  it('is nobody else’s: not a colleague’s, not another organization’s', async () => {
    const bleu = of('org_bleu');
    expect(await bleu.read('thr_ama_1', 'usr_kofi')).toEqual([]);
    expect(await bleu.list('usr_kofi')).toEqual([]);
    expect(await bleu.erase('thr_ama_1', 'usr_kofi')).toBe(false);

    // The same person's identifier, the same thread's identifier, another organization.
    const vert = of('org_vert');
    expect(await vert.read('thr_ama_1', 'usr_ama')).toEqual([]);
    expect(await vert.list('usr_ama')).toEqual([]);
    expect(await vert.erase('thr_ama_1', 'usr_ama')).toBe(false);
  });

  it('keeps the same person apart in two organizations', async () => {
    expect((await say('org_vert', 'thr_ama_vert', 'usr_ama', 'Bonjour.')).text).toBe(
      'Reçu 1 message(s).',
    );
    const { rows } = await db.owner.query<{ organization_id: string; n: number }>(
      `select organization_id, count(*)::int as n from mastra_messages
        group by organization_id order by organization_id`,
    );
    expect(rows).toEqual([
      { organization_id: 'org_bleu', n: 4 },
      { organization_id: 'org_vert', n: 2 },
    ]);
  });

  it('is read by nobody outside an organization, and cannot be written there', async () => {
    const { rows } = await db.app.query(`select id from mastra_messages`);
    expect(rows).toEqual([]);
    await expect(
      db.app.query(
        `insert into mastra_threads (id, "resourceId", title, "createdAt", "updatedAt")
         values ('thr_stray', 'nobody', 'x', now(), now())`,
      ),
    ).rejects.toThrow();
  });

  it('leaves no organization on a connection it gave back', async () => {
    const pool = organizationPool(db.app, 'org_bleu');
    const inside = await pool.query<{ organization: string }>(
      `select current_setting('kete.organization_id', true) as organization`,
    );
    expect(inside.rows[0]?.organization).toBe('org_bleu');
    const client = await pool.connect();
    await client.query('BEGIN');
    const held = await client.query<{ n: number }>(`select count(*)::int as n from mastra_threads`);
    await client.query('COMMIT');
    client.release();
    expect(held.rows[0]?.n).toBe(1);
    for (let i = 0; i < 12; i += 1) {
      const outside = await db.app.query<{ organization: string | null }>(
        `select current_setting('kete.organization_id', true) as organization`,
      );
      expect(outside.rows[0]?.organization ?? '').toBe('');
    }
  });

  it('is erased for good by the person it belongs to', async () => {
    expect(await of('org_bleu').erase('thr_ama_1', 'usr_ama')).toBe(true);
    expect(await of('org_bleu').read('thr_ama_1', 'usr_ama')).toEqual([]);
    const { rows } = await db.owner.query<{ organization_id: string }>(
      `select distinct organization_id from mastra_messages`,
    );
    expect(rows).toEqual([{ organization_id: 'org_vert' }]);
  });
});
