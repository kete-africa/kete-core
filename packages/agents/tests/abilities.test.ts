import type { WebSearchPort } from '@kete/ai';
import type { CapabilityTool, InvocationResult } from '@kete/capabilities';
import { memoryProvider } from '@kete/sandbox';
import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  computerTools,
  OUTSIDE_ABILITIES,
  runAgent,
  textOf,
  WAITS_FOR_A_PERSON,
  webReadTool,
  webSearchTool,
} from '../src/index.js';

// Spec 129: an agent's abilities beyond the product — the web searched and read, a computer of its
// own, sub-agents — each under the same rules as its capabilities: a sub-agent never holds a right
// more than the agent that delegates to it, and outside content read anywhere in the turn stops
// what would act at once. Scripted models prove the wiring, not what a model would choose.

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};
type Step = { tool: string; input: object } | { text: string };

/** A model that plays its steps in order, and notes the tools it was offered each time. */
function playing(...steps: Step[]) {
  let at = 0;
  const offered: string[][] = [];
  const model = new MockLanguageModelV4({
    doGenerate: (options) => {
      offered.push((options.tools ?? []).map((tool) => tool.name));
      const step = steps[Math.min(at, steps.length - 1)] as Step;
      at += 1;
      return Promise.resolve(
        'tool' in step
          ? {
              content: [
                {
                  type: 'tool-call' as const,
                  toolCallId: `call_${at}`,
                  toolName: step.tool,
                  input: JSON.stringify(step.input),
                },
              ],
              finishReason: { unified: 'tool-calls' as const, raw: 'tool_calls' },
              usage,
              warnings: [],
            }
          : {
              content: [{ type: 'text' as const, text: step.text }],
              finishReason: { unified: 'stop' as const, raw: 'stop' },
              usage,
              warnings: [],
            },
      );
    },
  });
  return { model, offered };
}

const log: string[] = [];
const capability = (
  name: string,
  autonomy: CapabilityTool['autonomy'],
  result: InvocationResult = { status: 'done', output: { ok: true } },
): CapabilityTool => ({
  name,
  description: name,
  input: z.object({}).loose(),
  jsonSchema: {},
  autonomy,
  execute: () => {
    log.push(name);
    return Promise.resolve(result);
  },
});

const page = `<html><head><title>Tarifs 2026</title><style>p{}</style></head>
<body><script>steal()</script><h1>Tarifs</h1><p>Le kWh coûte 98&nbsp;F&nbsp;CFA.</p></body></html>`;
const fetched: string[] = [];
const fakeFetch = (async (url: string | URL | Request) => {
  fetched.push(String(url));
  return new Response(page, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}) as typeof fetch;

describe('the web', () => {
  it('is searched with the provider’s search, its question checked', async () => {
    const asked: string[] = [];
    const port: WebSearchPort = {
      search: (query) => {
        asked.push(query);
        return Promise.resolve({ summary: 'Fixé par l’ARSE.', sources: [] });
      },
    };
    const search = webSearchTool(port);
    expect(search.autonomy).toBe(1);
    expect(await search.execute({ query: 'tarif kWh Togo' })).toEqual({
      status: 'done',
      output: { summary: 'Fixé par l’ARSE.', sources: [] },
    });
    expect((await search.execute({ query: '' })).status).toBe('refused');
    expect(asked).toEqual(['tarif kWh Togo']);
  });

  it('is read as text, without scripts nor styles, https only', async () => {
    const read = webReadTool({ fetch: fakeFetch });
    expect(await read.execute({ url: 'https://arse.tg/tarifs' })).toEqual({
      status: 'done',
      output: {
        url: 'https://arse.tg/tarifs',
        title: 'Tarifs 2026',
        text: 'Tarifs\nLe kWh coûte 98 F CFA.',
        cut: false,
      },
    });
    expect((await read.execute({ url: 'http://arse.tg' })).status).toBe('refused');
    expect(textOf('<p>a &amp; b</p>').text).toBe('a & b');
  });

  it('is never read on a private network by default', async () => {
    const read = webReadTool();
    expect(await read.execute({ url: 'https://127.0.0.1/admin' })).toMatchObject({
      status: 'done',
      output: { unreadable: 'The page could not be read.' },
    });
  });
});

describe('a computer of its own', () => {
  it('is created once for the conversation, kept, and runs commands there', async () => {
    const provider = memoryProvider((command) =>
      command === 'python3 --version' ? { stdout: 'Python 3.12.3\n' } : undefined,
    );
    let kept: string | null = null;
    const tools = computerTools(provider, {
      get: () => Promise.resolve(kept),
      keep: (id) => {
        kept = id;
        return Promise.resolve();
      },
    });
    const byName = (name: string) => tools.find((tool) => tool.name === name) as CapabilityTool;
    expect(await byName('computer_run').execute({ command: 'python3 --version' })).toMatchObject({
      status: 'done',
      output: { exitCode: 0, stdout: 'Python 3.12.3\n' },
    });
    await byName('computer_write').execute({ path: 'note.txt', content: 'bonjour' });
    expect(await byName('computer_read').execute({ path: 'note.txt' })).toMatchObject({
      output: { text: 'bonjour' },
    });
    expect((await byName('computer_read').execute({ path: '../etc/passwd' })).status).toBe(
      'refused',
    );
    // One sandbox for the whole conversation.
    expect(provider.sandboxes).toHaveLength(1);
    expect(kept).toBe(provider.sandboxes[0]?.id);
  });
});

describe('sub-agents', () => {
  it('have only the tools given to them, among the agent’s own', async () => {
    log.length = 0;
    const sub = playing({ tool: 'money_month', input: {} }, { text: 'Encaissé : 1 103 000 F.' });
    const parent = playing(
      { tool: 'delegate_analyst', input: { task: 'Combien a été encaissé ce mois ?' } },
      { text: 'Le mois a encaissé 1 103 000 F.' },
    );
    const answer = await runAgent({
      agent: 'agt_assistant',
      model: parent.model,
      instructions: 'Tu réponds.',
      messages: [{ role: 'user', content: 'Et ce mois ?' }],
      tools: [capability('money_month', 1), capability('money_record_expense', 3)],
      subAgents: [
        {
          name: 'analyst',
          description: 'Lit les chiffres.',
          instructions: 'Tu lis les chiffres.',
          tools: ['money_month', 'payroll_pay'],
          model: sub.model,
        },
      ],
    });
    expect(parent.offered[0]).toEqual(['money_month', 'money_record_expense', 'delegate_analyst']);
    // A tool the agent does not hold is never given to its sub-agent; it has no sub-agent itself.
    expect(sub.offered[0]).toEqual(['money_month']);
    expect(log).toEqual(['money_month']);
    expect(answer.calls).toEqual([
      {
        name: 'delegate_analyst',
        status: 'done',
        output: {
          status: 'done',
          output: {
            text: 'Encaissé : 1 103 000 F.',
            calls: [{ name: 'money_month', status: 'done' }],
          },
        },
      },
    ]);
  });

  it('bring back the outside content they read: nothing acts at once after it', async () => {
    log.length = 0;
    const sub = playing(
      { tool: 'web_read', input: { url: 'https://arse.tg/tarifs' } },
      { text: 'Le kWh coûte 98 F CFA.' },
    );
    const parent = playing(
      { tool: 'delegate_researcher', input: { task: 'Le prix du kWh ?' } },
      { tool: 'prices_update', input: {} },
      { text: 'Fait.' },
    );
    const answer = await runAgent({
      agent: 'agt_assistant',
      model: parent.model,
      instructions: 'Tu réponds.',
      messages: [{ role: 'user', content: 'Mets à jour le prix du kWh.' }],
      tools: [webReadTool({ fetch: fakeFetch }), capability('prices_update', 2)],
      outside: { tools: OUTSIDE_ABILITIES },
      subAgents: [
        {
          name: 'researcher',
          description: 'Cherche sur le web.',
          instructions: 'Tu lis le web.',
          tools: ['web_read'],
          model: sub.model,
        },
      ],
    });
    expect(fetched).toContain('https://arse.tg/tarifs');
    expect(log).not.toContain('prices_update');
    expect(answer.calls[1]).toMatchObject({
      name: 'prices_update',
      status: 'confirmation_required',
      output: { message: WAITS_FOR_A_PERSON },
    });
  });
});
