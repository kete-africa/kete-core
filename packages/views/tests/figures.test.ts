import { describe, expect, it } from 'vitest';
import { bulletOf, figureOption, type FigureInput, type Palette } from '../src/figures.js';

// Spec 145 (ADR 0016): the figures of view.v1, built by pure functions — the same rows give the
// same drawing, read here without a browser.

const palette: Palette = {
  series: ['#1', '#2'],
  text: '#t',
  line: '#l',
  muted: '#m',
  ok: '#ok',
  verify: '#v',
  error: '#err',
};
const words = {
  now: 'Maintenant',
  before: 'Avant',
  cumulative: 'Cumul',
  trajectory: 'Trajectoire',
  share: 'Part cumulée',
};
const input = (rows: FigureInput['rows'], more: Partial<FigureInput> = {}): FigureInput => ({
  rows,
  words,
  ...more,
});
type Series = { type: string; data: unknown[]; name?: string; markLine?: { data: unknown[] } };
const seriesOf = (option: Record<string, unknown>) => option['series'] as Series[];

describe('the figures', () => {
  it('draws bars with the period before dashed, and the target and threshold lines', () => {
    const option = figureOption(
      'bar',
      input(
        [
          { agence: 'Lomé', 'sum(ca)': 40 },
          { agence: 'Kara', 'sum(ca)': 25 },
        ],
        {
          previous: [{ agence: 'Lomé', 'sum(ca)': 35 }],
          target: 50,
          threshold: 20,
        },
      ),
      palette,
    );
    const [now, before] = seriesOf(option);
    expect((option['xAxis'] as { data: string[] }).data).toEqual(['Lomé', 'Kara']);
    expect(now?.data).toEqual([
      { value: 40, itemStyle: { opacity: 1 } },
      { value: 25, itemStyle: { opacity: 1 } },
    ]);
    expect(now?.markLine?.data).toHaveLength(2);
    expect(before).toMatchObject({ type: 'line', data: [35, null] });
  });

  it('adds up a running total against a straight trajectory to the target', () => {
    const [actual, trajectory] = seriesOf(
      figureOption(
        'cumulative',
        input(
          [
            { mois: 'jan', 'sum(ca)': 10 },
            { mois: 'fév', 'sum(ca)': 20 },
            { mois: 'mar', 'sum(ca)': 30 },
          ],
          {
            target: 90,
          },
        ),
        palette,
      ),
    );
    expect(actual?.data).toEqual([10, 30, 60]);
    expect(trajectory?.data).toEqual([30, 60, 90]);
  });

  it('floats a waterfall from total to total', () => {
    const [ground, bars] = seriesOf(
      figureOption(
        'waterfall',
        input([
          { poste: 'CA', montant: 168, total: true },
          { poste: 'Achats', montant: -92 },
          { poste: 'Main-d’œuvre', montant: -35 },
          { poste: 'Marge', montant: 41, total: true },
        ]),
        palette,
      ),
    );
    expect(ground?.data).toEqual([0, 76, 41, 0]);
    expect((bars?.data as { value: number }[]).map((b) => b.value)).toEqual([168, 92, 35, 41]);
  });

  it('orders the causes and adds up their share, with the 80 % line', () => {
    const option = figureOption(
      'pareto',
      input([
        { cause: 'Batteries', count: 9 },
        { cause: 'Onduleur', count: 14 },
        { cause: 'Câblage', count: 2 },
      ]),
      palette,
    );
    expect((option['xAxis'] as { data: string[] }).data).toEqual([
      'Onduleur',
      'Batteries',
      'Câblage',
    ]);
    expect(seriesOf(option)[1]?.data).toEqual([56, 92, 100]);
  });

  it('draws a box per part, and what lies far out', () => {
    const [boxes, out] = seriesOf(
      figureOption(
        'boxplot',
        input([{ agence: 'Plateaux', min: 3, q1: 9, med: 16, q3: 26, max: 52, out: '70' }]),
        palette,
      ),
    );
    expect(boxes?.data).toEqual([[3, 9, 16, 26, 52]]);
    expect(out?.data).toEqual([[0, 70]]);
  });

  it('places a bullet’s value, target and alert zone on its scale', () => {
    expect(bulletOf({ value: 92, target: 95, threshold: 90, min: 80, max: 100 })).toEqual({
      value: 60,
      target: 75,
      alert: { from: 0, to: 50 },
    });
    expect(bulletOf({ value: null, threshold: 48, better: 'down', max: 96 }).alert).toEqual({
      from: 50,
      to: 100,
    });
  });
});
