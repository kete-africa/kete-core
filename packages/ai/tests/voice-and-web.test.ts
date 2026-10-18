import type { Actor } from '@kete/commands';
import { MockLanguageModelV4, MockSpeechModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import {
  BudgetExceededError,
  sayable,
  searchingModel,
  speech,
  speechModel,
  webSearch,
  type BudgetStore,
  type Usage,
  type UsageContext,
} from '../src/index.js';

// Spec 129: an answer said aloud, and the web searched — each by the model provider's own service,
// metered. Scripted models prove the ports, the budget and the count — not what a real model says
// or finds.

const actor = { kind: 'person', id: 'usr_ama', channel: 'web' } as Actor;
const context: UsageContext = { organizationId: 'org_bleu', actor, purpose: 'voice', model: '' };

function budgets(spent = false) {
  const recorded: { context: UsageContext; usage: Usage }[] = [];
  const store: BudgetStore = {
    check: () =>
      spent
        ? Promise.reject(new BudgetExceededError({ kind: 'organization', id: 'org_bleu' }, 1, 2))
        : Promise.resolve(),
    record: (used, usage) => {
      recorded.push({ context: used, usage });
      return Promise.resolve();
    },
  };
  return { store, recorded };
}

describe('an answer said aloud', () => {
  const said: string[] = [];
  const voice = new MockSpeechModelV4({
    provider: 'mistral.speech',
    modelId: 'voxtral-mini-tts-latest',
    doGenerate: (options) => {
      said.push(options.text);
      return Promise.resolve({
        audio: new Uint8Array([73, 68, 51]),
        warnings: [],
        response: { timestamp: new Date(), modelId: 'voxtral-mini-tts-latest' },
      });
    },
  });

  it('says the words a page shows, not its links or code, and counts the call', async () => {
    const meter = budgets();
    const spoken = await speech(voice, { store: meter.store, context }).speak(
      'Le devis **D-12** est prêt : [ouvrir](https://kete.test/d/12). ```json\n{}\n```',
    );
    expect(spoken.audio).toEqual(new Uint8Array([73, 68, 51]));
    expect(spoken.mediaType).toMatch(/^audio\//);
    expect(said).toEqual(['Le devis D-12 est prêt : ouvrir.']);
    expect(meter.recorded).toEqual([
      {
        context: { ...context, model: 'mistral.speech:voxtral-mini-tts-latest' },
        usage: { inputTokens: 0, outputTokens: 0, modelCalls: 1 },
      },
    ]);
  });

  it('cuts a long answer at a sentence, and says nothing when the budget is spent', async () => {
    const long = `${'Une phrase assez longue pour remplir. '.repeat(200)}Fin.`;
    const kept = sayable(long, 400);
    expect(kept.length).toBeLessThanOrEqual(400);
    expect(kept.endsWith('remplir.')).toBe(true);
    const before = said.length;
    await expect(
      speech(voice, { store: budgets(true).store, context }).speak('jamais'),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(said).toHaveLength(before);
  });

  it('is OpenAI’s or Mistral’s, by configuration', () => {
    const voxtral = speechModel({
      provider: 'mistral',
      model: 'voxtral-mini-tts-latest',
      apiKey: 'key-of-the-test',
    });
    expect(typeof voxtral === 'string' ? voxtral : voxtral.modelId).toBe('voxtral-mini-tts-latest');
    expect(() =>
      speechModel({ provider: 'deepseek', model: 'x', apiKey: 'key-of-the-test' }),
    ).toThrow(/no speech model/);
  });
});

describe('the web searched', () => {
  const usage = {
    inputTokens: { total: 20, noCache: 20, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 8, text: 8, reasoning: undefined },
  };
  const asked: string[] = [];
  const searcher = new MockLanguageModelV4({
    provider: 'openai.responses',
    modelId: 'gpt-6.1-sol',
    doGenerate: (options) => {
      asked.push(JSON.stringify(options.prompt));
      return Promise.resolve({
        content: [
          { type: 'text', text: ' Le tarif du kWh au Togo est fixé par l’ARSE. ' },
          {
            type: 'source',
            sourceType: 'url',
            id: 's1',
            url: 'https://arse.tg/tarifs',
            title: 'Tarifs',
          },
          { type: 'source', sourceType: 'url', id: 's2', url: 'https://arse.tg/tarifs' },
          { type: 'source', sourceType: 'url', id: 's3', url: 'https://ceet.tg' },
        ],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage,
        warnings: [],
      });
    },
  });

  it('answers with what the pages say and each page once, and counts the call', async () => {
    const meter = budgets();
    const found = await webSearch(
      { model: searcher, tools: {} },
      { store: meter.store, context },
    ).search('tarif du kWh au Togo');
    expect(found).toEqual({
      summary: 'Le tarif du kWh au Togo est fixé par l’ARSE.',
      sources: [
        { title: 'Tarifs', url: 'https://arse.tg/tarifs' },
        { title: 'https://ceet.tg', url: 'https://ceet.tg' },
      ],
    });
    expect(asked[0]).toContain('tarif du kWh au Togo');
    expect(meter.recorded[0]?.usage).toEqual({ inputTokens: 20, outputTokens: 8, modelCalls: 1 });
  });

  it('is the provider’s own search: OpenAI’s or Anthropic’s, none elsewhere', () => {
    const openai = searchingModel({
      provider: 'openai',
      model: 'gpt-6.1-sol',
      apiKey: 'key-of-the-test',
    });
    expect(Object.keys(openai?.tools ?? {})).toEqual(['web_search']);
    expect(
      searchingModel({ provider: 'anthropic', model: 'claude-x', apiKey: 'key-of-the-test' }),
    ).not.toBeNull();
    expect(
      searchingModel({ provider: 'mistral', model: 'mistral-large', apiKey: 'key-of-the-test' }),
    ).toBeNull();
  });
});
