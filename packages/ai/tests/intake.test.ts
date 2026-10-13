import { MockLanguageModelV4 } from 'ai/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { intake } from '../src/index.js';

// Spec 098 — intake: a receipt's photo becomes an expense note's values, each with where it comes
// from. The model is played; what is tested is what Kete does with its reading.

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/** A model that answers this reading, and remembers what it was shown. */
function reading(answer: Record<string, unknown>) {
  const shown: unknown[] = [];
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      shown.push(options.prompt);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(answer) }],
        finishReason: { unified: 'stop' as const, raw: 'stop' },
        usage,
        warnings: [],
      };
    },
  });
  return { model, shown };
}

const expense = z.object({
  title: z.string().trim().min(1).max(200),
  spentOn: z.iso.date(),
  amount: z.number().int().min(1),
  proof: z.string().max(200).optional(),
  post: z.string().max(80).optional(),
});
const agent = { kind: 'agent' as const, id: 'agt_intake' };
const photo = {
  kind: 'photo' as const,
  data: new Uint8Array([0xff, 0xd8, 0xff]),
  contentType: 'image/jpeg',
};

describe('a receipt’s photo becomes a draft with the provenance of each field', () => {
  it('gives each value found its source, its certainty and the passage it was read in', async () => {
    const { model, shown } = reading({
      title: { found: true, value: 'Carburant', quote: 'GASOIL 25,00 L', certainty: 'high' },
      spentOn: { found: true, value: '2026-10-11', quote: '11/10/2026 14:32', certainty: 'high' },
      amount: { found: true, value: 25000, quote: 'TOTAL 25 000 FCFA', certainty: 'medium' },
      proof: { found: true, value: 'Ticket 88213', quote: 'N° 88213', certainty: 'low' },
      post: { found: false, value: null, quote: null, certainty: 'low' },
    });
    const read = await intake({
      model,
      schema: expense,
      source: photo,
      by: agent,
      context: 'An expense note: what was paid, when, how much.',
      evidence: 'fil_receipt_1',
    });
    expect(read).toEqual({
      values: { title: 'Carburant', spentOn: '2026-10-11', amount: 25000, proof: 'Ticket 88213' },
      provenance: {
        title: {
          source: 'photo',
          by: agent,
          certainty: 'high',
          quote: 'GASOIL 25,00 L',
          evidence: 'fil_receipt_1',
        },
        spentOn: {
          source: 'photo',
          by: agent,
          certainty: 'high',
          quote: '11/10/2026 14:32',
          evidence: 'fil_receipt_1',
        },
        amount: {
          source: 'photo',
          by: agent,
          certainty: 'medium',
          quote: 'TOTAL 25 000 FCFA',
          evidence: 'fil_receipt_1',
        },
        proof: {
          source: 'photo',
          by: agent,
          certainty: 'low',
          quote: 'N° 88213',
          evidence: 'fil_receipt_1',
        },
      },
      // The post is optional and not on the receipt: not missing, not guessed.
      missing: [],
    });
    // The photo itself was shown to the model, with what the record is.
    expect(JSON.stringify(shown[0])).toContain('An expense note');
    expect(JSON.stringify(shown[0])).toContain('image/jpeg');
  });

  it('leaves out what the field refuses, and says what the person must type', async () => {
    const { model } = reading({
      title: { found: true, value: 'Repas', quote: 'REPAS', certainty: 'high' },
      spentOn: { found: true, value: 'hier', quote: 'hier', certainty: 'low' },
      amount: { found: false, value: null, quote: null, certainty: 'low' },
      proof: { found: false, value: null, quote: null, certainty: 'low' },
      post: { found: false, value: null, quote: null, certainty: 'low' },
    });
    const read = await intake({ model, schema: expense, source: photo, by: agent });
    expect(read.values).toEqual({ title: 'Repas' });
    // « hier » is not a day: the person gives it, with the amount the receipt does not show.
    expect(read.missing).toEqual(['spentOn', 'amount']);
    expect(Object.keys(read.provenance)).toEqual(['title']);
  });

  it('reads a message or a voice note the same way, saying so', async () => {
    const { model, shown } = reading({
      title: { found: true, value: 'Taxi', quote: 'taxi pour le chantier', certainty: 'high' },
      spentOn: { found: true, value: '2026-10-12', quote: 'lundi 12', certainty: 'medium' },
      amount: { found: true, value: 3500, quote: '3500 F', certainty: 'high' },
      proof: { found: false, value: null, quote: null, certainty: 'low' },
      post: { found: false, value: null, quote: null, certainty: 'low' },
    });
    const read = await intake({
      model,
      schema: expense,
      source: { kind: 'voice', transcript: 'J’ai pris un taxi pour le chantier lundi 12, 3500 F.' },
      by: agent,
    });
    expect(read.provenance['amount']).toMatchObject({ source: 'voice', quote: '3500 F' });
    expect(JSON.stringify(shown[0])).toContain('voice note');
  });
});
