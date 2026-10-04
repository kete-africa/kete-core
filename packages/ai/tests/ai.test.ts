import type { CapabilityTool } from '@kete/capabilities';
import type { Actor } from '@kete/commands';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { MockLanguageModelV4 } from 'ai/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  aiCostMigrationSql,
  aiMigrationSql,
  ask,
  BudgetExceededError,
  costOf,
  extract,
  languageModel,
  ModelConfigError,
  modelConfigFromEnv,
  modelPricesFromEnv,
  observeModels,
  postgresBudgetStore,
  scanReader,
  type Metering,
} from '../src/index.js';

let db: TestSchema;
let store: ReturnType<typeof postgresBudgetStore>;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(aiMigrationSql({ schema, appRole }));
      await owner.query(aiCostMigrationSql({ schema, appRole }));
    },
  });
  store = postgresBudgetStore(db.app);
});

afterAll(async () => {
  await db.drop();
});

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const stop = { unified: 'stop' as const, raw: 'stop' };

function toolThenAnswer(answer: string) {
  return new MockLanguageModelV4({
    doGenerate: [
      {
        content: [{ type: 'tool-call', toolCallId: 'call_1', toolName: 'tags_list', input: '{}' }],
        finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
        usage,
        warnings: [],
      },
      { content: [{ type: 'text', text: answer }], finishReason: stop, usage, warnings: [] },
    ],
  });
}

let listed = 0;
const tagsList: CapabilityTool = {
  name: 'tags_list',
  description: 'Lists the tags of the organization.',
  input: z.object({}),
  jsonSchema: {},
  autonomy: 1,
  async execute() {
    listed += 1;
    return { status: 'done', output: ['vip', 'retard'] };
  },
};

const person: Actor = { kind: 'person', id: 'usr_ama', channel: 'chat' };
const agent: Actor = {
  kind: 'agent',
  id: 'agt_sales',
  channel: 'chat',
  onBehalfOf: { kind: 'person', id: 'usr_ama' },
};
const metering = (organizationId: string, actor: Actor): Metering => ({
  store,
  context: { organizationId, actor, purpose: 'chat', model: 'mock' },
});

describe('ask', () => {
  it('lets the model call capabilities as tools, then answers', async () => {
    const before = listed;
    const answer = await ask({
      model: toolThenAnswer('Vous avez 2 étiquettes : vip et retard.'),
      system: 'You are the assistant of the organization.',
      prompt: 'Quelles étiquettes avons-nous ?',
      tools: [tagsList],
    });
    expect(listed).toBe(before + 1);
    expect(answer.text).toBe('Vous avez 2 étiquettes : vip et retard.');
    expect(answer.toolResults).toEqual([
      { name: 'tags_list', output: { status: 'done', output: ['vip', 'retard'] } },
    ]);
    expect(answer.usage).toEqual({ inputTokens: 20, outputTokens: 10, modelCalls: 2 });
  });

  it('records the usage of each call, for the organization and the actor', async () => {
    await ask({
      model: toolThenAnswer('ok'),
      prompt: 'x',
      tools: [tagsList],
      metering: metering('org_usage', agent),
    });
    expect(await store.spent('org_usage', { kind: 'organization', id: 'org_usage' })).toBe(30);
    expect(await store.spent('org_usage', { kind: 'agent', id: 'agt_sales' })).toBe(30);
  });
});

describe('budgets', () => {
  it('refuses a call once the organization has spent its monthly budget, before calling the model', async () => {
    await store.setBudget('org_budget', { kind: 'organization', id: 'org_budget' }, 25);
    await ask({
      model: toolThenAnswer('ok'),
      prompt: 'x',
      tools: [tagsList],
      metering: metering('org_budget', person),
    });
    const model = toolThenAnswer('never');
    await expect(
      ask({ model, prompt: 'x', tools: [tagsList], metering: metering('org_budget', person) }),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(model.doGenerateCalls).toHaveLength(0);
  });

  it('limits an agent on its own budget, without limiting the people', async () => {
    await store.setBudget('org_agents', { kind: 'agent', id: 'agt_sales' }, 10);
    await ask({
      model: toolThenAnswer('ok'),
      prompt: 'x',
      tools: [tagsList],
      metering: metering('org_agents', agent),
    });
    await expect(
      ask({ model: toolThenAnswer('no'), prompt: 'x', metering: metering('org_agents', agent) }),
    ).rejects.toMatchObject({ scope: { kind: 'agent', id: 'agt_sales' } });
    await expect(
      ask({
        model: toolThenAnswer('yes'),
        prompt: 'x',
        tools: [tagsList],
        metering: metering('org_agents', person),
      }),
    ).resolves.toMatchObject({ text: 'yes' });
  });

  it('keeps each organization to its own usage', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_ai_usage',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (client, organization) => {
        await client.query(
          `insert into kete_ai_usage (organization_id, actor_kind, actor_id, purpose, model,
             input_tokens, output_tokens, model_calls) values ($1, 'person', 'usr_x', 'chat', 'm', 1, 1, 1)`,
          [organization],
        );
      },
    });
  });
});

describe('extract', () => {
  it('reads a structured value, typically a record for a draft', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [{ type: 'text', text: '{"client":"Ama","amount":50000}' }],
        finishReason: stop,
        usage,
        warnings: [],
      },
    });
    const { value, usage: used } = await extract({
      model,
      schema: z.object({ client: z.string(), amount: z.number().int() }),
      prompt: 'Devis pour Ama, cinquante mille francs.',
    });
    expect(value).toEqual({ client: 'Ama', amount: 50000 });
    expect(used).toEqual({ inputTokens: 10, outputTokens: 5, modelCalls: 1 });
  });
});

describe('scans', () => {
  it('reads a scan page by page, the file given to the model as it is', async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [
          { type: 'text', text: '{"pages":["Bon de livraison n° 42","Signature : A. Mensah"]}' },
        ],
        finishReason: stop,
        usage,
        warnings: [],
      },
    });
    const read = scanReader({ model });
    const pdf = new TextEncoder().encode('%PDF-1.4');
    expect(await read({ data: pdf, contentType: 'application/pdf' })).toEqual([
      'Bon de livraison n° 42',
      'Signature : A. Mensah',
    ]);
    const sent = JSON.stringify(model.doGenerateCalls[0]?.prompt);
    expect(sent).toContain('application/pdf');
    expect(sent).toContain('Transcribe this document exactly');
  });
});

describe('observability', () => {
  it('traces each call, its tokens and purpose, never what people wrote unless allowed', async () => {
    expect(observeModels({ env: {} }).enabled).toBe(false);
    const exporter = new InMemorySpanExporter();
    const observed = observeModels({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
      env: {},
    });
    expect(observed.enabled).toBe(true);
    await ask({
      model: new MockLanguageModelV4({
        doGenerate: {
          content: [{ type: 'text', text: 'Réponse privée' }],
          finishReason: stop,
          usage,
          warnings: [],
        },
      }),
      prompt: 'Question confidentielle',
      metering: {
        store: postgresBudgetStore(db.app),
        context: { organizationId: 'org_traces', actor: person, purpose: 'chat', model: '' },
      },
    });
    const spans = exporter.getFinishedSpans();
    expect(spans.length).toBeGreaterThan(0);
    const attributes = spans.map((span) => span.attributes);
    const all = JSON.stringify(attributes);
    expect(all).toContain('chat');
    expect(all).toMatch(/input_tokens|inputTokens/);
    expect(all).not.toContain('Question confidentielle');
    expect(all).not.toContain('Réponse privée');
    await observed.shutdown();
  });

  it('prices calls from the configuration, by full model name or by its id', () => {
    const prices = modelPricesFromEnv({
      KETE_AI_PRICES: '{"gpt-6.1-sol":{"input":1.25,"output":10}}',
    });
    const used = { inputTokens: 1_000_000, outputTokens: 100_000, modelCalls: 1 };
    expect(costOf('openai.responses:gpt-6.1-sol', used, prices)).toBe(2_250_000);
    expect(costOf('deepseek:deepseek-chat', used, prices)).toBeNull();
    expect(modelPricesFromEnv({})).toEqual({});
    expect(() => modelPricesFromEnv({ KETE_AI_PRICES: '{"x":{"input":-1,"output":1}}' })).toThrow();
  });

  it('records what each call cost, and reports usage by purpose, model and actor', async () => {
    const priced = postgresBudgetStore(db.app, {
      prices: { 'gpt-6.1-sol': { input: 1.25, output: 10 } },
    });
    const context = { organizationId: 'org_costs', purpose: 'chat' };
    await priced.record(
      { ...context, actor: person, model: 'openai.responses:gpt-6.1-sol' },
      { inputTokens: 2000, outputTokens: 500, modelCalls: 1 },
    );
    await priced.record(
      { ...context, actor: person, model: 'openai.responses:gpt-6.1-sol' },
      { inputTokens: 1000, outputTokens: 100, modelCalls: 2 },
    );
    await priced.record(
      { ...context, actor: agent, model: 'deepseek:deepseek-chat' },
      { inputTokens: 10, outputTokens: 10, modelCalls: 1 },
    );
    const report = await priced.report('org_costs');
    expect(report).toEqual([
      {
        purpose: 'chat',
        model: 'openai.responses:gpt-6.1-sol',
        actorKind: 'person',
        actorId: 'usr_ama',
        onBehalfOfId: null,
        calls: 3,
        inputTokens: 3000,
        outputTokens: 600,
        costMicroUsd: 9750,
      },
      {
        purpose: 'chat',
        model: 'deepseek:deepseek-chat',
        actorKind: 'agent',
        actorId: 'agt_sales',
        onBehalfOfId: 'usr_ama',
        calls: 1,
        inputTokens: 10,
        outputTokens: 10,
        costMicroUsd: null,
      },
    ]);
    expect(await priced.report('org_costs', { from: new Date(Date.now() + 60_000) })).toEqual([]);
  });
});

describe('providers', () => {
  it('builds each provider from configuration, never from code', () => {
    const deepseek = languageModel({
      provider: 'deepseek',
      model: 'deepseek-chat',
      apiKey: 'test',
    });
    expect(typeof deepseek === 'object' && deepseek.provider).toMatch(/deepseek/);
    const hosted = languageModel({
      provider: 'openai-compatible',
      model: 'deepseek-v3',
      baseURL: 'https://models.example.test/v1',
      apiKey: 'test',
    });
    expect(typeof hosted === 'object' && hosted.modelId).toBe('deepseek-v3');
    expect(() => languageModel({ provider: 'openai-compatible', model: 'x' })).toThrow(
      ModelConfigError,
    );
  });

  it('reads its configuration from the environment', () => {
    process.env['TEST_AI_PROVIDER'] = 'mistral';
    process.env['TEST_AI_MODEL'] = 'mistral-small-latest';
    expect(modelConfigFromEnv('TEST_AI')).toEqual({
      provider: 'mistral',
      model: 'mistral-small-latest',
    });
    delete process.env['TEST_AI_MODEL'];
    expect(() => modelConfigFromEnv('TEST_AI')).toThrow(ModelConfigError);
  });
});

// A real model, only when one is configured (KETE_AI_TEST_PROVIDER, KETE_AI_TEST_MODEL and
// KETE_AI_TEST_API_KEY in the environment); otherwise skipped. It proves the port end to end.
const live = Boolean(process.env['KETE_AI_TEST_PROVIDER'] && process.env['KETE_AI_TEST_MODEL']);

describe.skipIf(!live)('a real model through the port', () => {
  it('answers and calls a capability as a tool, with its usage measured', async () => {
    const answer = await ask({
      model: languageModel(modelConfigFromEnv('KETE_AI_TEST')),
      system: 'Answer in French, in one sentence. Use the tools to know the facts.',
      prompt: 'Quelles sont nos étiquettes ?',
      tools: [tagsList],
    });
    expect(answer.toolResults.map((r) => r.name)).toContain('tags_list');
    expect(answer.text.length).toBeGreaterThan(0);
    expect(answer.usage.inputTokens).toBeGreaterThan(0);
  }, 60_000);
});
