import type { Metric, MetricReading } from '@kete/sdk';
import { validateMetricReading } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import { periodRange, previousRange, trend, type MetricQuery } from '../src/index.js';
import {
  defineMetrics,
  MetricDenied,
  metricsAsked,
  metricsResponse,
  readMetrics,
} from '../src/server.js';

// Spec 103: the figures of an app like Kete Finance, read for a reader under her rights.

const label = (fr: string, en: string) => ({ fr, en });
const available: Metric = {
  name: 'finance.available',
  label: label('Argent disponible', 'Money available'),
  unit: 'money',
  better: 'up',
  axes: ['project'],
};
const invoiced: Metric = {
  name: 'finance.invoiced',
  label: label('Facturé', 'Invoiced'),
  unit: 'money',
  better: 'up',
  axes: ['project', 'party', 'period'],
};
const margin: Metric = {
  name: 'finance.margin',
  label: label('Marge', 'Margin'),
  unit: 'percent',
  better: 'up',
  axes: ['period'],
};

// What the app's own code computes: invoices by day, by project.
const invoices = [
  { on: '2026-09-20', amount: 400_000, project: 'prj_0000-51fe' },
  { on: '2026-10-02', amount: 992_000, project: 'prj_0000-51fe' },
  { on: '2026-10-10', amount: 412_000, project: 'prj_0000-77aa' },
];
const asked: MetricQuery[] = [];
const registry = defineMetrics([
  { metric: available, currency: 'XOF', compute: async () => 6_480_000 },
  {
    metric: invoiced,
    currency: 'XOF',
    compute: async (query) => {
      asked.push(query);
      return invoices
        .filter((i) => !query.period || (i.on >= query.period.from && i.on <= query.period.to))
        .filter((i) => !query.filter.project_id || i.project === query.filter.project_id)
        .reduce((sum, i) => sum + i.amount, 0);
    },
  },
  {
    metric: margin,
    compute: async () => {
      throw new MetricDenied();
    },
  },
]);
const at = () => new Date('2026-10-14T07:00:00Z');

describe('the figures of an app', () => {
  it('says the days of a period, and the same number of days before', () => {
    expect(periodRange('7d', '2026-10-14')).toEqual({ from: '2026-10-08', to: '2026-10-14' });
    expect(periodRange('quarter', '2026-10-14')).toEqual({ from: '2026-10-01', to: '2026-10-14' });
    expect(periodRange('year', '2026-10-14')).toEqual({ from: '2026-01-01', to: '2026-10-14' });
    expect(periodRange('all', '2026-10-14')).toBeNull();
    expect(previousRange({ from: '2026-10-01', to: '2026-10-14' })).toEqual({
      from: '2026-09-17',
      to: '2026-09-30',
    });
  });

  it('reads them for a reader: a period compared, a state never dated, a figure she may not see', async () => {
    const readings = await registry.read('all', {
      today: '2026-10-14',
      period: 'quarter',
      compare: true,
      now: at,
    });
    expect(readings).toEqual([
      {
        name: 'finance.available',
        value: 6_480_000,
        currency: 'XOF',
        at: '2026-10-14T07:00:00.000Z',
      },
      {
        name: 'finance.invoiced',
        value: 1_404_000,
        previous: 400_000,
        currency: 'XOF',
        period: { from: '2026-10-01', to: '2026-10-14' },
        at: '2026-10-14T07:00:00.000Z',
      },
      {
        name: 'finance.margin',
        value: null,
        denied: true,
        period: { from: '2026-10-01', to: '2026-10-14' },
        at: '2026-10-14T07:00:00.000Z',
      },
    ]);
    for (const reading of readings) expect(validateMetricReading(reading).ok).toBe(true);
    const [state, flow] = readings as [MetricReading, MetricReading];
    expect(trend(flow, 'up')).toEqual({ direction: 'up', tone: 'good', change: 2.51 });
    expect(trend({ ...flow, value: 300_000 }, 'up')).toMatchObject({ tone: 'bad' });
    expect(trend(state, 'up')).toBeNull();
  });

  it('applies a filter only on its axes, and says which it applied', async () => {
    const [state, flow] = await registry.read(
      ['finance.available', 'finance.invoiced', 'finance.unknown'],
      {
        today: '2026-10-14',
        filter: { project_id: 'prj_0000-51fe', person_id: 'usr_afi' },
        now: at,
      },
    );
    expect(state?.filter).toEqual({ project_id: 'prj_0000-51fe' });
    expect(flow).toMatchObject({ value: 1_392_000, filter: { project_id: 'prj_0000-51fe' } });
    expect(asked.at(-1)?.filter).toEqual({ project_id: 'prj_0000-51fe' });
  });

  it('refuses at start a figure that breaks its contract', () => {
    expect(() =>
      defineMetrics([{ metric: { ...margin, name: 'Marge' }, compute: async () => 1 }]),
    ).toThrow(/metric\.v1/);
    expect(() => defineMetrics([{ metric: available, compute: async () => 1 }])).toThrow(
      /currency/,
    );
    expect(() =>
      defineMetrics([
        { metric: margin, compute: async () => 1 },
        { metric: margin, compute: async () => 2 },
      ]),
    ).toThrow(/twice/);
  });
});

describe('the figures over HTTP', () => {
  it('answers /api/metrics within the reader’s context, and is read back by another app', async () => {
    expect(
      metricsAsked(
        new URL(
          'https://finance.test/api/metrics?names=finance.invoiced&period=7d&compare=1&project=prj_0000-51fe&color=red',
        ),
      ),
    ).toEqual({
      names: ['finance.invoiced'],
      period: '7d',
      compare: true,
      filter: { project_id: 'prj_0000-51fe' },
    });
    const contexts: string[] = [];
    const fetcher = (async (url: URL, init?: RequestInit) => {
      const token = new Headers(init?.headers).get('authorization');
      return metricsResponse(registry, new Request(url), {
        today: '2026-10-14',
        now: at,
        within: async (work) => {
          contexts.push(token ?? '');
          return work();
        },
      });
    }) as unknown as typeof fetch;
    const readings = await readMetrics({
      url: 'https://finance.test',
      token: 'her-token',
      names: ['finance.invoiced'],
      period: '7d',
      compare: true,
      fetch: fetcher,
    });
    expect(contexts).toEqual(['Bearer her-token']);
    expect(readings).toEqual([
      expect.objectContaining({ name: 'finance.invoiced', value: 412_000, previous: 992_000 }),
    ]);
  });

  it('gives no figure when the app does not answer, and drops what breaks the contract', async () => {
    const down = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch;
    expect(await readMetrics({ url: 'https://x.test', token: 't', fetch: down })).toEqual([]);
    const odd = (async () =>
      Response.json({
        readings: [
          { name: 'Bad', value: 1, at: 'now' },
          { name: 'a.b', value: 2, at: '2026-10-14T07:00:00Z' },
        ],
      })) as unknown as typeof fetch;
    expect(await readMetrics({ url: 'https://x.test', token: 't', fetch: odd })).toEqual([
      { name: 'a.b', value: 2, at: '2026-10-14T07:00:00Z' },
    ]);
  });
});
