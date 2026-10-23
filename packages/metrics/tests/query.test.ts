import type { Dataset } from '@kete/sdk';
import { validateDatasetAnswer } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import { answerQuery, type QueryRefused } from '../src/index.js';
import { queryDataset, readMetrics } from '../src/server.js';

// Spec 144 (ADR 0015): a data set's rows summed up where they live — on the center's axes, its own
// fields, its period — and only the answer travels. A source that does not answer is missing,
// never zero (D-062, R17).

const invoices: Dataset = {
  name: 'invoices',
  description: 'Invoices issued.',
  permission: 'finance:read',
  row: {
    type: 'object',
    properties: {
      issued_on: { type: 'string' },
      client: { type: 'string' },
      amount: { type: 'number' },
      project: { type: ['string', 'null'] },
      unit: { type: 'string' },
    },
  },
  time: 'issued_on',
  axes: { project: 'project', unit: 'unit' },
};
const rows = [
  { issued_on: '2026-09-02', client: 'Mairie', amount: 400, project: 'prj_0000aaaa', unit: 'u1' },
  { issued_on: '2026-09-18', client: 'Mairie', amount: 100, project: 'prj_0000aaaa', unit: 'u1' },
  { issued_on: '2026-09-20', client: 'Clinique', amount: 900, project: 'prj_0000bbbb', unit: 'u2' },
  { issued_on: '2026-10-01', client: 'Mairie', amount: 50, project: null, unit: 'u1' },
];
const at = () => new Date('2026-10-23T08:00:00Z');

describe('a question summed up at the source', () => {
  it('filters on the axes the data set carries, its own fields and its period', () => {
    const answer = answerQuery(
      invoices,
      rows,
      {
        filter: { project_id: 'prj_0000aaaa', party_id: 'pty_0000cccc' },
        where: [{ field: 'client', op: 'eq', value: 'mairie' }],
        group_by: ['client'],
        measures: [{ fn: 'sum', field: 'amount' }, { fn: 'count' }],
        from: '2026-09-01',
        to: '2026-09-30',
      },
      { now: at },
    );
    expect(validateDatasetAnswer(answer).ok).toBe(true);
    expect(answer).toEqual({
      dataset: 'invoices',
      rows: [{ client: 'Mairie', 'sum(amount)': 500, count: 2 }],
      counted: 2,
      truncated: false,
      // The party is no axis of it: left out, and the answer says what it applied.
      filter: { project_id: 'prj_0000aaaa' },
      at: '2026-10-23T08:00:00.000Z',
    });
  });

  it('gives the largest group first, cut at the limit, and says it was cut', () => {
    const answer = answerQuery(invoices, rows, {
      group_by: ['unit'],
      measures: [{ fn: 'sum', field: 'amount' }],
      limit: 1,
    });
    expect(answer.rows).toEqual([{ unit: 'u2', 'sum(amount)': 900 }]);
    expect(answer.truncated).toBe(true);
    expect(
      answerQuery(invoices, rows, { measures: [{ fn: 'count' }] }, { cut: true }).truncated,
    ).toBe(true);
  });

  it('answers nothing to count with a count of 0 and no sum', () => {
    expect(
      answerQuery(invoices, [], { measures: [{ fn: 'count' }, { fn: 'avg', field: 'amount' }] })
        .rows,
    ).toEqual([{ count: 0, 'avg(amount)': null }]);
  });

  it('refuses a field it does not have, and a sum of words', () => {
    const refused = (question: unknown) => {
      try {
        answerQuery(invoices, rows, question);
        return null;
      } catch (error) {
        return (error as QueryRefused).code;
      }
    };
    expect(refused({ measures: [{ fn: 'count' }], group_by: ['price'] })).toBe('unknown_field');
    expect(refused({ measures: [{ fn: 'sum', field: 'client' }] })).toBe('not_a_number');
    expect(refused({ measures: [{ fn: 'count' }], limit: 0 })).toBe('invalid_query');
  });
});

describe('read from another app with her token', () => {
  it('puts the question and keeps an answer that holds to the contract', async () => {
    const seen: { url: string; auth: string | null; body: unknown }[] = [];
    const app = (async (url: string, init: RequestInit) => {
      seen.push({
        url,
        auth: new Headers(init.headers).get('authorization'),
        body: JSON.parse(String(init.body)),
      });
      return Response.json(answerQuery(invoices, rows, JSON.parse(String(init.body))));
    }) as unknown as typeof fetch;
    const asked = await queryDataset({
      api: 'https://finance.test/api/v1/',
      token: 'her-token',
      dataset: 'invoices',
      query: { measures: [{ fn: 'count' }] },
      fetch: app,
    });
    expect(seen[0]).toMatchObject({
      url: 'https://finance.test/api/v1/datasets/invoices/query',
      auth: 'Bearer her-token',
    });
    expect(asked).toMatchObject({ status: 'done', answer: { rows: [{ count: 4 }], counted: 4 } });
  });

  it('says missing when the app does not answer or breaks the contract; a refusal is a refusal', async () => {
    const down = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    const odd = (async () => Response.json({ rows: 'many' })) as unknown as typeof fetch;
    const no = (async () =>
      Response.json({ error: 'not_allowed' }, { status: 403 })) as unknown as typeof fetch;
    const ask = (answering: typeof fetch) =>
      queryDataset({
        api: 'https://x.test',
        token: 't',
        dataset: 'invoices',
        query: { measures: [{ fn: 'count' }] },
        fetch: answering,
      });
    expect(await ask(down)).toEqual({ status: 'missing' });
    expect(await ask(odd)).toEqual({ status: 'missing' });
    expect(await ask(no)).toEqual({ status: 'refused', reason: 'not_allowed' });
  });

  it('gives each figure asked by name as missing when its app does not answer', async () => {
    const down = (async () => {
      throw new Error('unreachable');
    }) as unknown as typeof fetch;
    const readings = await readMetrics({
      url: 'https://x.test',
      token: 't',
      names: ['finance.available'],
      fetch: down,
    });
    expect(readings).toEqual([
      expect.objectContaining({ name: 'finance.available', value: null, missing: true }),
    ]);
  });
});
