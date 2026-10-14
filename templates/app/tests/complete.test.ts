import { createHmac, randomBytes } from 'node:crypto';
import { signSession, type KeteIdentity } from '@kete/auth';
import { assignBusinessRole, performGesture } from '@kete/capabilities';
import {
  connectChatSender,
  listChatMessages,
  memoryChatChannel,
  queueChatText,
  saveChatContact,
  setChatConsent,
} from '@kete/notify';
import { createTestSchema, type TestSchema } from '@kete/testing';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { migrations } from '../db/migrations';
import type { IntelligenceEvent } from '@kete/sdk';
import { askApp, askStream } from '../src/features/assistant';
import { useModel } from '../src/platform/ai';
import { deliverWaiting, receive, useChat } from '../src/platform/chat';
import { transaction, usePool } from '../src/platform/db';
import { manifest } from '../src/platform/events';
import { metrics } from '../src/platform/metrics';
import { registry } from '../src/platform/registry';
import { asPerson } from '../src/platform/rights';
import { personOf, screenActor } from '../src/platform/session';
import { announceDailyUsage, recordUse } from '../src/platform/usage';

// kete-core spec 093: a new app is born with what Nettio had to write — business roles, a gesture
// that returns a rule's code, « Demander », WhatsApp and Telegram, usage, and a session a browser
// test can write.

const ORG = 'org_full';
const SESSION_SECRET = 'a-session-secret-of-the-template-tests-0123';
process.env.SESSION_SECRET ??= SESSION_SECRET;
process.env.KETE_ACCOUNT_URL ??= 'https://compte.kete.test';
process.env.KETE_CLIENT_ID ??= 'client-of-the-tests';
process.env.KETE_CLIENT_SECRET ??= 'secret-of-the-tests';
process.env.PUBLIC_URL ??= 'https://app.test';

let db: TestSchema;
const person = (userId: string, role: KeteIdentity['role']): KeteIdentity => ({
  userId,
  email: `${userId}@example.test`,
  name: userId,
  organizationId: ORG,
  role,
  apps: {},
  twoFactor: false,
  expiresAt: new Date(Date.now() + 60_000),
});
const owner = person('usr_owner', 'owner');
const essi = person('usr_essi', 'member');
const newcomer = person('usr_newcomer', 'member');
const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (pool, context) => {
      for (const migration of migrations) await pool.query(migration.sql(context));
    },
  });
  usePool(db.app);
  await transaction(ORG, (client) => assignBusinessRole(client, ORG, essi.userId, 'staff'));
});

afterAll(async () => {
  useModel(undefined);
  await db.drop();
});

describe('business roles', () => {
  it('give a member what her role holds, and nothing without one', async () => {
    const listed = (who: KeteIdentity) =>
      asPerson(who, () =>
        registry.invoke({
          actor: screenActor(who),
          organizationId: ORG,
          name: 'task_list',
          input: {},
        }),
      );
    expect(await listed(essi)).toMatchObject({ status: 'done' });
    expect(await listed(newcomer)).toMatchObject({ status: 'refused', reason: 'not_allowed' });
  });
});

describe('a gesture on a screen', () => {
  it('returns the code of the rule it broke, never a crash', async () => {
    const caller = { actor: screenActor(owner), organizationId: ORG };
    const as = <T>(work: () => Promise<T>) => asPerson(owner, work);
    const created = await performGesture<{ taskId: string }>(
      registry,
      { ...caller, name: 'tasks_create', input: { title: 'Relancer le fournisseur' } },
      as,
    );
    expect(created.ok).toBe(true);
    const taskId = created.ok ? created.output.taskId : '';
    expect(
      await performGesture(registry, { ...caller, name: 'tasks_complete', input: { taskId } }, as),
    ).toMatchObject({ ok: true });
    expect(
      await performGesture(registry, { ...caller, name: 'tasks_complete', input: { taskId } }, as),
    ).toEqual({ ok: false, code: 'already_done', facts: {} });
  });
});

describe('« Demander »', () => {
  it('says it is not connected without a model', async () => {
    useModel(null);
    expect(
      await asPerson(essi, () => askApp({ userId: essi.userId, organizationId: ORG }, 'Hello')),
    ).toEqual({
      available: false,
      reason: 'not_connected',
    });
  });

  it('answers with the readings she may open, and is offered nothing that changes anything', async () => {
    const offered: string[][] = [];
    let step = 0;
    useModel(
      new MockLanguageModelV4({
        doGenerate: (options) => {
          offered.push((options.tools ?? []).map((tool) => tool.name));
          step += 1;
          return Promise.resolve(
            step === 1
              ? {
                  content: [
                    {
                      type: 'tool-call' as const,
                      toolCallId: 'c1',
                      toolName: 'task_list',
                      input: '{}',
                    },
                  ],
                  finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
                  usage,
                  warnings: [],
                }
              : {
                  content: [{ type: 'text' as const, text: 'Une tâche, faite.' }],
                  finishReason: { unified: 'stop' as const, raw: 'stop' },
                  usage,
                  warnings: [],
                },
          );
        },
      }),
    );
    const outcome = await asPerson(owner, () =>
      askApp({ userId: owner.userId, organizationId: ORG }, 'Où en sont les tâches ?'),
    );
    expect(outcome).toEqual({
      available: true,
      answer: 'Une tâche, faite.',
      sources: ['task_list'],
    });
    // Readings only: completing (acts at once) and creating (a draft) are never offered.
    expect(offered[0]).toEqual(['task_list', 'task_get']);
  });
});

describe('Kete Intelligence’s drawer (kete-core spec 101)', () => {
  type Streamed = Awaited<ReturnType<MockLanguageModelV4['doStream']>>['stream'];
  type Part = Streamed extends ReadableStream<infer P> ? P : never;
  const collect = async (events: AsyncIterable<IntelligenceEvent>) => {
    const all: IntelligenceEvent[] = [];
    for await (const event of events) all.push(event);
    return all;
  };

  it('says it is not connected without a model', async () => {
    useModel(null);
    const events = await asPerson(owner, () =>
      collect(askStream({ userId: owner.userId, organizationId: ORG }, 'Bonjour')),
    );
    expect(events).toEqual([{ type: 'failed', reason: 'not_connected' }]);
  });

  it('streams each reading as it starts and ends, with its level, the words, then the end', async () => {
    let step = 0;
    useModel(
      new MockLanguageModelV4({
        doStream: () => {
          step += 1;
          const chunks: Part[] =
            step === 1
              ? [
                  { type: 'tool-call', toolCallId: 'c1', toolName: 'task_list', input: '{}' },
                  {
                    type: 'finish',
                    finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
                    usage,
                  },
                ]
              : [
                  { type: 'text-start', id: 't' },
                  { type: 'text-delta', id: 't', delta: 'Une tâche, ' },
                  { type: 'text-delta', id: 't', delta: 'faite.' },
                  { type: 'text-end', id: 't' },
                  { type: 'finish', finishReason: { unified: 'stop', raw: 'stop' }, usage },
                ];
          return Promise.resolve({ stream: simulateReadableStream<Part>({ chunks }) });
        },
      }),
    );
    // The whole turn runs within her rights, as the drawer's address runs it.
    const events = await asPerson(owner, () =>
      collect(
        askStream(
          { userId: owner.userId, organizationId: ORG },
          'Où en sont les tâches ?',
          [],
          'Tâches',
        ),
      ),
    );
    expect(events.slice(0, 2)).toEqual([
      { type: 'tool', id: 't1', name: 'task_list', level: 1, state: 'running' },
      { type: 'tool', id: 't1', name: 'task_list', level: 1, state: 'done', summary: 'done' },
    ]);
    expect(
      events
        .filter((event) => event.type === 'text')
        .map((event) => event.delta)
        .join(''),
    ).toBe('Une tâche, faite.');
    expect(events.at(-1)).toMatchObject({ type: 'done', tools: 1 });
  });
});

describe('WhatsApp and Telegram', () => {
  it('hear a message for the organization of its number, and answer from that number', async () => {
    const secretsKey = randomBytes(32).toString('base64');
    const channel = memoryChatChannel('whatsapp');
    useChat({ secretsKey, connect: () => channel });
    await transaction(ORG, async (client) => {
      await connectChatSender(
        client,
        ORG,
        {
          channel: 'whatsapp',
          phoneNumberId: '5005',
          accessToken: 'jeton',
          appSecret: 'secret-wa',
        },
        { secretsKey },
      );
      await saveChatContact(client, ORG, { reference: 'cus_ama', phone: '22890112233' });
      await setChatConsent(client, 'cus_ama', true);
    });
    const raw = JSON.stringify({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: '5005' },
                contacts: [{ wa_id: '22890112233' }],
                messages: [
                  { from: '22890112233', id: 'wamid.T1', type: 'text', text: { body: 'Bonjour' } },
                ],
              },
            },
          ],
        },
      ],
    });
    const response = await receive(
      'whatsapp',
      new Request('https://app.test/api/chat/whatsapp', {
        method: 'POST',
        headers: {
          'x-hub-signature-256': `sha256=${createHmac('sha256', 'secret-wa').update(raw).digest('hex')}`,
        },
        body: raw,
      }),
    );
    expect(response.status).toBe(200);
    await transaction(ORG, (client) =>
      queueChatText(client, ORG, { reference: 'cus_ama', text: 'Bienvenue' }),
    );
    await deliverWaiting();
    expect(channel.sent).toEqual([
      { kind: 'text', to: '22890112233', text: 'Bienvenue', actions: [] },
    ]);
    const kept = await transaction(ORG, (client) => listChatMessages(client));
    expect(kept.map((message) => [message.direction, message.status])).toEqual([
      ['out', 'sent'],
      ['in', 'received'],
    ]);
  });
});

describe('its figures (kete-core spec 103)', () => {
  it('reads them under the reader’s rights: counted for her, refused to whoever may not read tasks', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const read = (who: KeteIdentity) => asPerson(who, () => metrics.read('all', { today }));
    const value = (readings: { name: string; value: number | null }[], name: string) =>
      readings.find((reading) => reading.name === name)?.value ?? null;
    const before = await read(owner);
    expect(before.map((reading) => reading.name)).toEqual(['tasks.open', 'tasks.overdue']);
    await performGesture(
      registry,
      {
        actor: screenActor(owner),
        organizationId: ORG,
        name: 'tasks_create',
        input: { title: 'Déposer le rapport', dueOn: '2026-01-05' },
      },
      (work) => asPerson(owner, work),
    );
    const after = await read(owner);
    expect(value(after, 'tasks.open')).toBe((value(before, 'tasks.open') ?? 0) + 1);
    expect(value(after, 'tasks.overdue')).toBe((value(before, 'tasks.overdue') ?? 0) + 1);
    // Without a business role, the newcomer reads no task: no figure of them either.
    expect(await read(newcomer)).toEqual([
      expect.objectContaining({ name: 'tasks.open', value: null, denied: true }),
      expect.objectContaining({ name: 'tasks.overdue', value: null, denied: true }),
    ]);
    expect(manifest().metrics?.map((metric) => metric.name)).toEqual([
      'tasks.open',
      'tasks.overdue',
    ]);
  });
});

describe('usage', () => {
  it('counts each gesture, and announces the day’s counts to Kete Cockpit', async () => {
    await recordUse(ORG, 'tasks_create', owner.userId);
    await announceDailyUsage(new Date());
    const { rows } = await db.owner.query<{
      envelope: { type: string; data: { counters: Record<string, number> } };
    }>(`select envelope from kete_outbox where organization_id = $1`, [ORG]);
    expect(rows.map((row) => row.envelope.type)).toEqual(['metrics.daily']);
    expect(rows[0]?.envelope.data.counters).toMatchObject({ usage_events: 1, use_tasks_create: 1 });
  });
});

describe('a browser test', () => {
  it('signs a person in with the session the app itself writes', async () => {
    const value = await signSession(process.env.SESSION_SECRET ?? '', essi);
    const read = await personOf(
      new Request('https://app.test/', { headers: { cookie: `kete_session=${value}` } }),
    );
    expect(read).toMatchObject({ userId: 'usr_essi', organizationId: ORG, role: 'member' });
  });
});
