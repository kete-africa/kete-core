import { BudgetExceededError, type BudgetStore, type Usage, type UsageContext } from '@kete/ai';
import type { CapabilityTool, InvocationResult } from '@kete/capabilities';
import { MockLanguageModelV4, simulateReadableStream } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runAgent, streamAgent, type AgentEvent, type AgentTurn } from '../src/index.js';

// Spec 089: a turn of an agent on the runtime. A scripted model proves the wiring — the tools are
// the caller's capabilities and nothing else, what they return becomes what a page shows, usage
// is recorded and a spent budget calls no model. It proves nothing of an answer's quality.

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
const stop = { unified: 'stop' as const, raw: 'stop' };
type Streamed = Awaited<ReturnType<MockLanguageModelV4['doStream']>>['stream'];
/** A part of a model's stream, as the mock takes it. */
type Part = Streamed extends ReadableStream<infer P> ? P : never;
const calls = { unified: 'tool-calls' as const, raw: 'tool_calls' };

/** A model that calls one tool, then answers. */
function scripted(toolName: string, input: object, answer: string) {
  let step = 0;
  const asked: string[][] = [];
  const model = new MockLanguageModelV4({
    doGenerate: (options) => {
      asked.push((options.tools ?? []).map((tool) => tool.name));
      step += 1;
      return Promise.resolve(
        step === 1
          ? {
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: 'call_1',
                  toolName,
                  input: JSON.stringify(input),
                },
              ],
              finishReason: calls,
              usage,
              warnings: [],
            }
          : {
              content: [{ type: 'text' as const, text: answer }],
              finishReason: stop,
              usage,
              warnings: [],
            },
      );
    },
  });
  return { model, asked };
}

/** What the capability registry gives a caller: here, a reading and a gesture that prepares. */
function capabilities(log: unknown[]): CapabilityTool[] {
  const tool = (
    name: string,
    autonomy: CapabilityTool['autonomy'],
    result: (input: unknown) => InvocationResult,
    view?: string,
  ): CapabilityTool => ({
    name,
    description: name,
    input: z.object({ month: z.string().optional(), amount: z.number().optional() }),
    jsonSchema: {},
    autonomy,
    ...(view ? { view } : {}),
    execute: (input) => {
      log.push({ name, input });
      return Promise.resolve(result(input));
    },
  });
  return [
    tool('money_month', 1, () => ({ status: 'done', output: { cashed: 1_103_000 } })),
    tool(
      'money_record_expense',
      3,
      () =>
        ({
          status: 'draft',
          draftId: 'drf_1',
          message: 'A draft waits for her.',
          review: {},
        }) as unknown as InvocationResult,
      'ui://kete/review',
    ),
  ];
}

function budgets(spent = false) {
  const recorded: { context: UsageContext; usage: Usage }[] = [];
  const store: BudgetStore = {
    check: () =>
      spent
        ? Promise.reject(new BudgetExceededError({ kind: 'organization', id: 'org_kya' }, 100, 120))
        : Promise.resolve(),
    record: (context, used) => {
      recorded.push({ context, usage: used });
      return Promise.resolve();
    },
  };
  return { store, recorded };
}

const actor = {
  kind: 'agent' as const,
  id: 'agt_trial',
  channel: 'chat' as const,
  onBehalfOf: { kind: 'person' as const, id: 'usr_ama' },
};
const turnOf = (over: Partial<AgentTurn> & Pick<AgentTurn, 'model'>): AgentTurn => ({
  agent: 'agt_trial',
  instructions: 'You answer with the figures of your tools.',
  messages: [{ role: 'user', content: 'Combien ce mois-ci ?' }],
  ...over,
});

describe('a turn of an agent', () => {
  it('is offered the caller’s capabilities and nothing else, and says what it read', async () => {
    const log: unknown[] = [];
    const { model, asked } = scripted('money_month', { month: '2026-10' }, '1 103 000 F CFA.');
    const meter = budgets();
    const answer = await runAgent(
      turnOf({
        model,
        tools: capabilities(log),
        metering: {
          store: meter.store,
          context: { organizationId: 'org_kya', actor, purpose: 'ask', model: '' },
        },
      }),
    );
    expect(answer.text).toBe('1 103 000 F CFA.');
    expect(asked[0]).toEqual(['money_month', 'money_record_expense']);
    expect(log).toEqual([{ name: 'money_month', input: { month: '2026-10' } }]);
    expect(answer.calls).toEqual([
      {
        name: 'money_month',
        status: 'done',
        output: { status: 'done', output: { cashed: 1_103_000 } },
      },
    ]);
    // Two model calls, recorded once, for the organization, as the agent acting for her.
    expect(answer.usage).toEqual({ inputTokens: 20, outputTokens: 10, modelCalls: 2 });
    expect(meter.recorded).toHaveLength(1);
    expect(meter.recorded[0]?.context).toMatchObject({
      organizationId: 'org_kya',
      actor: { kind: 'agent', id: 'agt_trial', onBehalfOf: { kind: 'person', id: 'usr_ama' } },
      purpose: 'ask',
    });
    expect(meter.recorded[0]?.usage).toEqual(answer.usage);
  });

  it('prepares a gesture, never does it: the draft that waits is named, with its view', async () => {
    const { model } = scripted('money_record_expense', { amount: 5000 }, 'Préparé : à confirmer.');
    const answer = await runAgent(turnOf({ model, tools: capabilities([]) }));
    expect(answer.calls).toMatchObject([
      { name: 'money_record_expense', status: 'draft', draftId: 'drf_1', view: 'ui://kete/review' },
    ]);
  });

  it('calls no model when a budget is spent', async () => {
    const { model, asked } = scripted('money_month', {}, 'never');
    const meter = budgets(true);
    const turn = turnOf({
      model,
      tools: capabilities([]),
      metering: {
        store: meter.store,
        context: { organizationId: 'org_kya', actor, purpose: 'ask', model: '' },
      },
    });
    await expect(runAgent(turn)).rejects.toBeInstanceOf(BudgetExceededError);
    const events: AgentEvent[] = [];
    for await (const event of streamAgent(turn)) events.push(event);
    expect(events).toEqual([{ type: 'stopped', reason: 'budget_spent' }]);
    expect(asked).toEqual([]);
    expect(meter.recorded).toEqual([]);
  });

  it('stops at the steps it was given', async () => {
    const log: unknown[] = [];
    const model = new MockLanguageModelV4({
      doGenerate: {
        content: [
          { type: 'tool-call', toolCallId: 'call_1', toolName: 'money_month', input: '{}' },
        ],
        finishReason: calls,
        usage,
        warnings: [],
      },
    });
    const answer = await runAgent(turnOf({ model, tools: capabilities(log), maxSteps: 3 }));
    expect(log).toHaveLength(3);
    expect(answer.usage.modelCalls).toBe(3);
  });
});

describe('the same turn as it happens', () => {
  it('gives the words as they come, each call as it starts and what became of it, then the usage', async () => {
    let step = 0;
    const model = new MockLanguageModelV4({
      doStream: () => {
        step += 1;
        return Promise.resolve({
          stream: simulateReadableStream<Part>({
            chunks:
              step === 1
                ? [
                    {
                      type: 'tool-call' as const,
                      toolCallId: 'call_1',
                      toolName: 'money_month',
                      input: '{}',
                    },
                    { type: 'finish' as const, finishReason: calls, usage },
                  ]
                : [
                    { type: 'text-start' as const, id: 't1' },
                    { type: 'text-delta' as const, id: 't1', delta: '1 103 000 ' },
                    { type: 'text-delta' as const, id: 't1', delta: 'F CFA.' },
                    { type: 'text-end' as const, id: 't1' },
                    { type: 'finish' as const, finishReason: stop, usage },
                  ],
          }),
        });
      },
    });
    const meter = budgets();
    const events: AgentEvent[] = [];
    for await (const event of streamAgent(
      turnOf({
        model,
        tools: capabilities([]),
        metering: {
          store: meter.store,
          context: { organizationId: 'org_kya', actor, purpose: 'ask', model: '' },
        },
      }),
    )) {
      events.push(event);
    }
    expect(events).toEqual([
      { type: 'calling', name: 'money_month' },
      {
        type: 'call',
        name: 'money_month',
        status: 'done',
        output: { status: 'done', output: { cashed: 1_103_000 } },
      },
      { type: 'text', delta: '1 103 000 ' },
      { type: 'text', delta: 'F CFA.' },
      { type: 'done', usage: { inputTokens: 20, outputTokens: 10, modelCalls: 2 } },
    ]);
    expect(meter.recorded).toHaveLength(1);
  });

  it('ends with « stopped » when the model fails, and never throws', async () => {
    const model = new MockLanguageModelV4({
      doStream: () => Promise.reject(new Error('the provider is down')),
    });
    const events: AgentEvent[] = [];
    for await (const event of streamAgent(turnOf({ model }))) events.push(event);
    expect(events.at(-1)).toEqual({ type: 'stopped', reason: 'failed' });
  });
});
