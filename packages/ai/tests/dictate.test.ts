import type { Actor } from '@kete/commands';
import { MockTranscriptionModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import type { TranscriptionModel } from 'ai';
import {
  BudgetExceededError,
  dictation,
  transcriptionModel,
  type BudgetStore,
  type Usage,
  type UsageContext,
} from '../src/index.js';

// Spec 090: the dictation port. A scripted transcription model proves the port, the budget and the
// count — not what a real model hears.

const actor: Actor = { kind: 'person', id: 'usr_ama', channel: 'web' } as Actor;
const context: UsageContext = {
  organizationId: 'org_bleu',
  actor,
  purpose: 'dictation',
  model: '',
};

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

const hearing = (text: string) => {
  let calls = 0;
  const model = new MockTranscriptionModelV4({
    provider: 'mistral.transcription',
    modelId: 'voxtral-mini-latest',
    doGenerate: () => {
      calls += 1;
      return Promise.resolve({
        text,
        segments: [],
        language: 'fr',
        durationInSeconds: 4.2,
        warnings: [],
        response: { timestamp: new Date(), modelId: 'voxtral-mini-latest' },
      });
    },
  });
  // The mock leaves streaming out, which the port never uses.
  return { model: model as unknown as TranscriptionModel, calls: () => calls };
};

describe('dictation', () => {
  it('writes down what she said, and counts the call for her organization', async () => {
    const meter = budgets();
    const { model } = hearing(' Trois chemises pour Ama, express. ');
    const said = await dictation(model, { store: meter.store, context }).dictate(
      new Uint8Array([1, 2]),
    );
    expect(said).toEqual({
      text: 'Trois chemises pour Ama, express.',
      language: 'fr',
      seconds: 4.2,
    });
    expect(meter.recorded).toEqual([
      {
        context: { ...context, model: 'mistral.transcription:voxtral-mini-latest' },
        usage: { inputTokens: 0, outputTokens: 0, modelCalls: 1 },
      },
    ]);
  });

  it('calls no model when the budget is spent', async () => {
    const { model, calls } = hearing('jamais');
    await expect(
      dictation(model, { store: budgets(true).store, context }).dictate(new Uint8Array([1])),
    ).rejects.toBeInstanceOf(BudgetExceededError);
    expect(calls()).toBe(0);
  });

  it('hears nothing in a silent recording, and still counts the call', async () => {
    const meter = budgets();
    const { model } = hearing('');
    const said = await dictation(model, { store: meter.store, context }).dictate(
      new Uint8Array([0]),
    );
    expect(said.text).toBe('');
    expect(meter.recorded).toHaveLength(1);
  });

  it('takes Mistral’s Voxtral as well as OpenAI’s models', () => {
    const voxtral = transcriptionModel({
      provider: 'mistral',
      model: 'voxtral-mini-latest',
      apiKey: 'key-of-the-test',
    });
    expect(typeof voxtral === 'string' ? voxtral : voxtral.modelId).toBe('voxtral-mini-latest');
    expect(() =>
      transcriptionModel({ provider: 'deepseek', model: 'x', apiKey: 'key-of-the-test' }),
    ).toThrow(/no transcription model/);
  });
});
