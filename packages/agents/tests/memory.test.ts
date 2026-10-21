import { inOrganization, type SqlExecutor } from '@kete/tenancy';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  agentConversations,
  agentConversationsMigrationSql,
  agentMemoryMigrationSql,
  eraseMemories,
  expireMemories,
  forget,
  memoriesFor,
  memoriesOf,
  memoryConsentOf,
  memoryJournalOf,
  remember,
  rememberTool,
  runAgent,
  setMemoryConsent,
} from '../src/index.js';

// Spec 090: what an agent remembers of a person, under her consent, for as long as she said, hers
// to read and to erase — and erased for good. Played as the application role, under the
// organizations' row-level security.

let db: TestSchema;
const as = <T>(organizationId: string, work: (client: SqlExecutor) => Promise<T>) =>
  inOrganization(db.app, organizationId, work);
const ama = { kind: 'person' as const, id: 'usr_ama' };

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
/** A model that keeps the instructions it was given, and answers « OK ». */
function listening() {
  const heard: string[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: (options) => {
      heard.push(
        options.prompt
          .filter((message) => message.role === 'system')
          .map((message) => message.content)
          .join('\n'),
      );
      return Promise.resolve({
        content: [{ type: 'text' as const, text: 'OK' }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage,
        warnings: [],
      });
    },
  });
  return { model, heard };
}

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(agentMemoryMigrationSql({ schema, appRole }));
      await owner.query(agentConversationsMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

describe('her consent first', () => {
  it('remembers nothing before she decides', async () => {
    await as('org_bleu', async (client) => {
      expect(await memoryConsentOf(client, 'usr_ama')).toEqual({
        enabled: false,
        retentionDays: null,
        decidedAt: null,
      });
      expect(
        await remember(
          client,
          'org_bleu',
          { personId: 'usr_ama', text: 'Je signe les achats.', origin: 'person' },
          ama,
        ),
      ).toEqual({ status: 'refused', reason: 'no_consent' });
      expect(await memoriesOf(client, 'usr_ama')).toEqual([]);
    });
  });

  it('remembers once she agreed, and gives it to her agents as context', async () => {
    await as('org_bleu', async (client) => {
      await setMemoryConsent(client, 'org_bleu', 'usr_ama', { enabled: true }, ama);
      await remember(
        client,
        'org_bleu',
        {
          personId: 'usr_ama',
          text: 'Je signe les achats de plus de 1 000 000 F CFA.',
          origin: 'person',
        },
        ama,
      );
    });
    // An agent notes one more thing through its capability.
    const tool = rememberTool({
      organizationId: 'org_bleu',
      personId: 'usr_ama',
      agent: 'agt_assistant',
      inOrganization: (work) => as('org_bleu', work),
    });
    expect(await tool.execute({ text: 'Mes rapports en français.' })).toEqual({
      status: 'done',
      output: { remembered: true },
    });
    const remembered = await as('org_bleu', (client) => memoriesFor(client, 'usr_ama'));
    expect(remembered.map((memory) => [memory.text, memory.origin, memory.agent])).toEqual([
      ['Je signe les achats de plus de 1 000 000 F CFA.', 'person', null],
      ['Mes rapports en français.', 'agent', 'agt_assistant'],
    ]);
    const { model, heard } = listening();
    await runAgent({
      agent: 'agt_assistant',
      instructions: 'Rules.',
      model,
      messages: [{ role: 'user', content: 'Bonjour' }],
      remembered,
    });
    expect(heard[0]).toMatch(/^Rules\.\n/);
    expect(heard[0]).toContain('- Mes rapports en français.');
  });

  it('closes at once when she withdraws: nothing read, nothing more kept', async () => {
    await as('org_bleu', async (client) => {
      await setMemoryConsent(client, 'org_bleu', 'usr_ama', { enabled: false }, ama);
      expect(await memoriesFor(client, 'usr_ama')).toEqual([]);
      // What was kept stays hers to read and to erase.
      expect(await memoriesOf(client, 'usr_ama')).toHaveLength(2);
      await setMemoryConsent(client, 'org_bleu', 'usr_ama', { enabled: true }, ama);
    });
  });

  it('is nobody else’s: another organization reads nothing of her', async () => {
    await as('org_vert', async (client) => {
      expect(await memoriesOf(client, 'usr_ama')).toEqual([]);
      expect(await memoryJournalOf(client, 'usr_ama')).toEqual([]);
    });
    const { rows } = await db.app.query(`select memory_id from kete_agent_memories`);
    expect(rows).toEqual([]);
  });
});

describe('for as long as she said', () => {
  it('stops reading what expired at once, and deletes it on the worker’s round', async () => {
    await as('org_bleu', async (client) => {
      await setMemoryConsent(
        client,
        'org_bleu',
        'usr_kofi',
        { enabled: true, retentionDays: 30 },
        {
          kind: 'person',
          id: 'usr_kofi',
        },
      );
      const kept = await remember(
        client,
        'org_bleu',
        { personId: 'usr_kofi', text: 'Je suis en congé jusqu’au 20.', origin: 'person' },
        { kind: 'person', id: 'usr_kofi' },
      );
      expect(kept.status).toBe('remembered');
      expect((await memoriesOf(client, 'usr_kofi'))[0]?.expiresAt).not.toBeNull();
    });
    await db.owner.query(
      `update kete_agent_memories set expires_at = now() - interval '1 minute'
        where person_id = 'usr_kofi'`,
    );
    await as('org_bleu', async (client) => {
      expect(await memoriesFor(client, 'usr_kofi')).toEqual([]);
      expect(await expireMemories(client, 'org_bleu')).toBe(1);
      expect((await memoryJournalOf(client, 'usr_kofi'))[0]).toMatchObject({
        action: 'expired',
        touched: 1,
        actor: { kind: 'worker', id: 'memory' },
      });
    });
  });
});

describe('erased for good', () => {
  it('forgets one thing, and never gives it back', async () => {
    await as('org_bleu', async (client) => {
      const [first] = await memoriesOf(client, 'usr_ama');
      expect(await forget(client, 'org_bleu', 'usr_ama', first?.memoryId ?? '', ama)).toBe(true);
      expect(await forget(client, 'org_bleu', 'usr_kofi', first?.memoryId ?? '', ama)).toBe(false);
      expect((await memoriesFor(client, 'usr_ama')).map((memory) => memory.text)).toEqual([
        'Mes rapports en français.',
      ]);
    });
  });

  it('erases her memory and her conversations whole, and nothing comes back', async () => {
    const conversations = agentConversations({
      pool: db.app,
      organizationId: 'org_bleu',
      schema: db.schema,
    });
    const { model } = listening();
    for (const threadId of ['thr_ama_a', 'thr_ama_b']) {
      await runAgent({
        agent: 'agt_assistant',
        instructions: 'Rules.',
        model,
        messages: [{ role: 'user', content: 'Note : le code du portail est 4521.' }],
        conversation: { store: conversations, threadId, personId: 'usr_ama' },
      });
    }
    expect(await conversations.list('usr_ama')).toHaveLength(2);

    expect(
      await as('org_bleu', (client) => eraseMemories(client, 'org_bleu', 'usr_ama', ama)),
    ).toBe(1);
    expect(await conversations.eraseAll('usr_ama')).toBe(2);

    // Nothing comes back: not to her, not to her agents, not in any table, not in the journal.
    await as('org_bleu', async (client) => {
      expect(await memoriesFor(client, 'usr_ama')).toEqual([]);
      expect(await memoriesOf(client, 'usr_ama')).toEqual([]);
    });
    expect(await conversations.list('usr_ama')).toEqual([]);
    for (const table of ['kete_agent_memories', 'mastra_threads', 'mastra_messages']) {
      const { rows } = await db.owner.query(
        `select 1 from ${table} where ${table === 'kete_agent_memories' ? 'person_id' : '"resourceId"'} like '%usr_ama'`,
      );
      expect(rows, table).toEqual([]);
    }
    const everything = await db.owner.query(`select * from kete_agent_memory_journal`);
    expect(JSON.stringify(everything.rows)).not.toMatch(/achats|français|b4521b/);
    const journal = await as('org_bleu', (client) => memoryJournalOf(client, 'usr_ama'));
    expect(journal.map((entry) => entry.action)).toEqual([
      'erased',
      'forgot',
      'consented',
      'withdrew',
      'remembered',
      'remembered',
      'consented',
    ]);
    expect(journal[0]).toMatchObject({ touched: 1, actor: ama });
  });

  it('cannot be rewritten by the application: the journal takes lines, never changes them', async () => {
    await expect(
      as('org_bleu', (client) =>
        client.query(`update kete_agent_memory_journal set action = 'remembered'`),
      ),
    ).rejects.toThrow();
    await expect(
      as('org_bleu', (client) => client.query(`delete from kete_agent_memory_journal`)),
    ).rejects.toThrow();
  });
});
