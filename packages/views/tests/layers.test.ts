import type { View } from '@kete/sdk';
import { describe, expect, it } from 'vitest';
import { boundFilter, checkView, resolveView, type ViewLayer } from '../src/layers.js';

// Spec 145 (ADR 0016; D-062, R22): one contract for every component, configured where it is used,
// in layers — the app's default, the organization's, a position's, the person's own — the most
// precise winning whole.

const words = (fr: string, en = fr) => ({ fr, en });
const scorecard: View = {
  kind: 'figure',
  title: words('Le trimestre en un coup d’œil', 'The quarter at a glance'),
  source: { indicators: ['ind_1', 'ind_2'] },
  context: ['unit', 'period'],
  figure: { chart: 'scorecard', period: 'quarter' },
};
const board: View = {
  kind: 'board',
  title: words('Pilotage · Direction', 'Steering'),
  board: {
    cards: [
      { view: scorecard, place: { x: 0, y: 0, w: 7, h: 4 }, phone: 0 },
      {
        view: {
          kind: 'figure',
          title: words('Causes des pannes'),
          source: {
            dataset: 'tickets',
            product: 'prd_support',
            group_by: ['cause'],
            measures: [{ fn: 'count' }],
          },
          figure: { chart: 'pareto', drill: true },
        },
        place: { x: 7, y: 0, w: 5, h: 4 },
      },
    ],
    modes: ['grid', 'meeting', 'story', 'phone'],
    cross_filter: true,
  },
};

describe('view.v1', () => {
  it('holds a board of figures — a scorecard of indicators, a Pareto of an app’s data set', () => {
    expect(checkView(board)).toEqual({ ok: true, view: board });
  });

  it('refuses a chart it does not know, a source that is two at once, a word without its English', () => {
    expect(checkView({ ...scorecard, figure: { chart: 'pie3d' } }).ok).toBe(false);
    expect(checkView({ ...scorecard, source: { indicators: ['a'], metric: 'a.b' } }).ok).toBe(
      false,
    );
    expect(checkView({ ...scorecard, title: { fr: 'Seul' } }).ok).toBe(false);
    expect(checkView({ kind: 'figure', title: words('x'), query: 'select *' }).ok).toBe(false);
  });
});

describe('the layers of a configuration', () => {
  const layer = (level: ViewLayer['level'], title: string): ViewLayer => ({
    level,
    view: { ...scorecard, title: words(title) },
    version: 1,
  });

  it('shows the most precise: her version, else her position’s, the organization’s, the app’s', () => {
    const app = layer('app', 'App');
    const org = layer('organization', 'Org');
    const position = layer('position', 'Poste');
    const mine = layer('person', 'Moi');
    expect(resolveView([app, org, position, mine])?.view.title.fr).toBe('Moi');
    expect(resolveView([app, org, position])?.view.title.fr).toBe('Poste');
    expect(resolveView([org, app])?.view.title.fr).toBe('Org');
    expect(resolveView([])).toBeNull();
  });

  it('binds what the place gives on the axes the view takes, and nothing else', () => {
    expect(
      boundFilter(scorecard, { unit_id: 'unt_1', project_id: 'prj_1', person_id: 'usr_1' }),
    ).toEqual({ unit_id: 'unt_1' });
    expect(
      boundFilter({ context: ['me', 'object'] }, { person_id: 'usr_1', object_id: 'ast_1' }),
    ).toEqual({
      person_id: 'usr_1',
      object_id: 'ast_1',
    });
  });
});
