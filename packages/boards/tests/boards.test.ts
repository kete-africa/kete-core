import type { Metric, MetricReading } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import {
  arrange,
  freeze,
  nextRun,
  placeNew,
  readingOrder,
  summaryDocument,
  whatChanged,
  type Board,
  type Found,
} from '../src/index.js';

// Spec 103: Afi's board « Direction » — money available, invoiced this quarter, absences — looked
// at, sent every working day at 7 h, frozen as a summary.

const available: Metric = {
  name: 'finance.available',
  label: { fr: 'Argent disponible', en: 'Money available' },
  unit: 'money',
  better: 'up',
};
const invoiced: Metric = {
  name: 'finance.invoiced',
  label: { fr: 'Facturé', en: 'Invoiced' },
  unit: 'money',
  better: 'up',
  axes: ['period'],
};
const absences: Metric = {
  name: 'team.absences',
  label: { fr: 'Absences', en: 'Absences' },
  unit: 'count',
  better: 'down',
  axes: ['period'],
};

const board: Board = {
  id: 'brd_direction',
  title: 'Direction',
  period: 'quarter',
  compare: true,
  routine: { every: 'workday', at: '07:00' },
  indexed: true,
  cards: [
    {
      id: 'c1',
      kind: 'figure',
      app: 'kete-finance',
      name: 'finance.available',
      view: 'figure',
      place: { x: 0, y: 0, w: 4, h: 2 },
      threshold: 5_000_000,
    },
    {
      id: 'c2',
      kind: 'figure',
      app: 'kete-finance',
      name: 'finance.invoiced',
      view: 'line',
      place: { x: 4, y: 0, w: 8, h: 4 },
      goal: 2_000_000,
    },
    {
      id: 'c3',
      kind: 'figure',
      app: 'kete-team',
      name: 'team.absences',
      view: 'figure',
      place: { x: 0, y: 2, w: 4, h: 2 },
      title: 'Absents',
    },
    {
      id: 'c4',
      kind: 'note',
      title: 'Pour le comité',
      text: 'La ligne Ecobank est signée jeudi.',
      place: { x: 0, y: 4, w: 12, h: 1 },
    },
    {
      id: 'c5',
      kind: 'figure',
      app: 'kete-commitments',
      name: 'commitments.due',
      view: 'figure',
      place: { x: 0, y: 5, w: 4, h: 2 },
    },
    {
      id: 'c6',
      kind: 'figure',
      app: 'kete-finance',
      name: 'finance.margin',
      view: 'figure',
      place: { x: 4, y: 5, w: 4, h: 2 },
      proposed: true,
    },
  ],
};

const read = (
  name: string,
  value: number | null,
  extra: Partial<MetricReading> = {},
): MetricReading => ({
  name,
  value,
  at: '2026-10-14T07:00:00.000Z',
  ...extra,
});
const monday: Found[] = [
  {
    app: 'kete-finance',
    metric: available,
    reading: read('finance.available', 6_480_000, { currency: 'XOF' }),
  },
  {
    app: 'kete-finance',
    metric: invoiced,
    reading: read('finance.invoiced', 1_404_000, { previous: 400_000, currency: 'XOF' }),
  },
  { app: 'kete-team', metric: absences, reading: read('team.absences', 2, { previous: 1 }) },
];

describe('a board', () => {
  it('keeps its cards in places that hold, and a phone reads them in the same order', () => {
    const messy = arrange([
      { id: 'a', place: { x: 10, y: 3, w: 6, h: 2 } },
      { id: 'b', place: { x: 0, y: 0, w: 4, h: 2 } },
      { id: 'c', place: { x: 2, y: 1, w: 4, h: 1 } },
    ]);
    expect(messy).toEqual([
      { id: 'b', place: { x: 0, y: 0, w: 4, h: 2 } },
      { id: 'c', place: { x: 2, y: 2, w: 4, h: 1 } },
      { id: 'a', place: { x: 6, y: 0, w: 6, h: 2 } },
    ]);
    expect(readingOrder(messy).map((c) => c.id)).toEqual(['b', 'a', 'c']);
    expect(placeNew(board.cards, { w: 4, h: 2 })).toEqual({ x: 0, y: 7, w: 4, h: 2 });
  });

  it('runs its routine on working days at 7 h, in the organization’s time', () => {
    const friday = Date.parse('2026-10-16T08:00:00Z');
    expect(new Date(nextRun({ every: 'workday', at: '07:00' }, friday)).toISOString()).toBe(
      '2026-10-19T07:00:00.000Z',
    );
    expect(
      new Date(
        nextRun({ every: 'day', at: '07:00' }, Date.parse('2026-10-16T06:59:00Z')),
      ).toISOString(),
    ).toBe('2026-10-16T07:00:00.000Z');
    expect(
      new Date(nextRun({ every: 'week', at: '17:00', weekday: 5 }, friday)).toISOString(),
    ).toBe('2026-10-16T17:00:00.000Z');
    expect(new Date(nextRun({ every: 'month', at: '08:00', date: 1 }, friday)).toISOString()).toBe(
      '2026-11-01T08:00:00.000Z',
    );
    // An organization one hour ahead: its 7 h is 6 h in UTC.
    expect(new Date(nextRun({ every: 'day', at: '07:00' }, friday, 60)).toISOString()).toBe(
      '2026-10-17T06:00:00.000Z',
    );
  });
});

describe('a summary', () => {
  it('freezes the board: each figure with its trend, its goal, its threshold; a missing app said; a proposal left out', () => {
    const summary = freeze(board, monday, {
      at: new Date('2026-10-14T07:00:00Z'),
      today: '2026-10-14',
      note: '  Kossi absent jeudi.  ',
    });
    expect(summary.range).toEqual({ from: '2026-10-01', to: '2026-10-14' });
    expect(summary.figures.map((f) => f.card)).toEqual(['c1', 'c2', 'c3', 'c5']);
    const [cash, sales, away, due] = summary.figures;
    expect(cash).toMatchObject({ value: 6_480_000, currency: 'XOF', trend: null });
    expect(cash).not.toHaveProperty('over');
    expect(sales).toMatchObject({
      trend: { tone: 'good', direction: 'up' },
      goal: { value: 2_000_000, reached: false },
    });
    expect(away).toMatchObject({
      title: { fr: 'Absents' },
      trend: { tone: 'bad', direction: 'up' },
    });
    expect(due).toMatchObject({ missing: true, value: null });
    expect(summary.notes).toEqual([
      { title: 'Pour le comité', text: 'La ligne Ecobank est signée jeudi.' },
    ]);
    expect(summary.note).toBe('Kossi absent jeudi.');
  });

  it('says what changed since the last one, the largest move first', () => {
    const before = freeze(board, monday, {
      at: new Date('2026-10-13T07:00:00Z'),
      today: '2026-10-13',
    });
    const tuesday = monday.map((f) =>
      f.metric.name === 'finance.available'
        ? { ...f, reading: { ...f.reading, value: 4_200_000 } }
        : f.metric.name === 'team.absences'
          ? { ...f, reading: { ...f.reading, value: 1 } }
          : f,
    );
    const after = freeze(board, tuesday, {
      at: new Date('2026-10-14T07:00:00Z'),
      today: '2026-10-14',
    });
    expect(whatChanged(before, after)).toEqual([
      {
        card: 'c3',
        title: { fr: 'Absents', en: 'Absents' },
        from: 2,
        to: 1,
        change: -0.5,
        tone: 'good',
      },
      {
        card: 'c1',
        title: available.label,
        from: 6_480_000,
        to: 4_200_000,
        change: expect.closeTo(-0.352, 3),
        tone: 'bad',
      },
    ]);
    // Under its threshold, the money available says so.
    expect(after.figures[0]).toMatchObject({ over: true });
  });

  it('becomes a document to index, worded by the app', () => {
    const summary = freeze(board, monday, {
      at: new Date('2026-10-14T07:00:00Z'),
      today: '2026-10-14',
    });
    const document = summaryDocument(summary, {
      lang: 'fr',
      title: 'Direction — 14 octobre 2026',
      value: (f) => (f.missing ? 'sans réponse' : `${f.value ?? '—'}`),
    });
    expect(document.title).toBe('Direction — 14 octobre 2026');
    expect(document.pages[0]).toContain('- Argent disponible : 6480000');
    expect(document.pages[0]).toContain('- commitments.due : sans réponse');
    expect(document.pages[0]).toContain('La ligne Ecobank est signée jeudi.');
  });
});
