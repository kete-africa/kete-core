import { freeze, whatChanged, type Board, type Found, type Summary } from '@kete/boards';
import {
  BoardGrid,
  Button,
  KpiTile,
  PageHeader,
  SummaryCard,
  type SummaryLine,
} from '@kete/design';
import { periodRange, trend, type Trend } from '@kete/metrics';
import type { Metric, MetricReading } from '@kete/sdk';
import { useState } from 'react';

// Mon tableau (kete-core spec 103; doctrine D-052), as the center shows it: Afi's board
// « Direction » read through @kete/metrics, drawn by BoardGrid, frozen by @kete/boards as this
// morning's summary — what changed since yesterday first.

const label = (fr: string) => ({ fr, en: fr });
const catalog: Record<
  string,
  {
    app: string;
    metric: Metric;
    currency?: string;
    today: number;
    yesterday: number;
    before: number;
  }
> = {
  'finance.available': {
    app: 'kete-finance',
    metric: {
      name: 'finance.available',
      label: label('Argent disponible'),
      unit: 'money',
      better: 'up',
    },
    currency: 'XOF',
    today: 4_200_000,
    yesterday: 6_480_000,
    before: 0,
  },
  'finance.invoiced': {
    app: 'kete-finance',
    metric: {
      name: 'finance.invoiced',
      label: label('Facturé ce trimestre'),
      unit: 'money',
      better: 'up',
      axes: ['period'],
    },
    currency: 'XOF',
    today: 1_404_000,
    yesterday: 1_404_000,
    before: 400_000,
  },
  'team.absences': {
    app: 'kete-team',
    metric: {
      name: 'team.absences',
      label: label('Absences'),
      unit: 'count',
      better: 'down',
      axes: ['period'],
    },
    today: 1,
    yesterday: 2,
    before: 1,
  },
  'commitments.due': {
    app: 'kete-commitments',
    metric: {
      name: 'commitments.due',
      label: label('Échéances à 30 jours'),
      unit: 'count',
      better: 'none',
    },
    today: 3,
    yesterday: 3,
    before: 0,
  },
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
      id: 'cash',
      kind: 'figure',
      app: 'kete-finance',
      name: 'finance.available',
      view: 'figure',
      place: { x: 0, y: 0, w: 4, h: 2 },
      threshold: 5_000_000,
    },
    {
      id: 'sales',
      kind: 'figure',
      app: 'kete-finance',
      name: 'finance.invoiced',
      view: 'figure',
      place: { x: 4, y: 0, w: 4, h: 2 },
      goal: 2_000_000,
    },
    {
      id: 'away',
      kind: 'figure',
      app: 'kete-team',
      name: 'team.absences',
      view: 'figure',
      place: { x: 8, y: 0, w: 4, h: 2 },
    },
    {
      id: 'due',
      kind: 'figure',
      app: 'kete-commitments',
      name: 'commitments.due',
      view: 'figure',
      place: { x: 0, y: 2, w: 4, h: 2 },
      proposed: true,
    },
    {
      id: 'note',
      kind: 'note',
      title: 'Pour le comité',
      text: 'La ligne Ecobank est signée jeudi ; la pose de La Colombe commence lundi.',
      place: { x: 4, y: 2, w: 8, h: 2 },
    },
  ],
};

const money = (value: number) => `${new Intl.NumberFormat('fr-FR').format(value)} F`;
const shown = (reading: MetricReading | undefined) =>
  !reading || reading.value === null
    ? '—'
    : reading.currency
      ? money(reading.value)
      : String(reading.value);
const trendLabel = (t: Trend | null) =>
  t?.change == null ? '' : `${Math.round(Math.abs(t.change) * 100)} %`;

// What the apps' /api/metrics would answer (metric-reading.v1): the quarter so far, compared with
// the same number of days before; a state — the money available — is never dated.
function readAll(day: 'today' | 'yesterday'): Found[] {
  const today = day === 'today' ? '2026-10-14' : '2026-10-13';
  return Object.values(catalog).map((entry) => {
    const dated = entry.metric.axes?.includes('period');
    const period = dated ? periodRange('quarter', today) : null;
    const reading: MetricReading = {
      name: entry.metric.name,
      value: day === 'today' ? entry.today : entry.yesterday,
      at: `${today}T07:00:00.000Z`,
      ...(entry.currency ? { currency: entry.currency } : {}),
      ...(period ? { period, previous: entry.before } : {}),
    };
    return { app: entry.app, metric: entry.metric, reading };
  });
}

export function BoardPage() {
  const [kept, setKept] = useState<'shown' | 'kept' | 'dropped'>('shown');
  const found = readAll('today');
  const summaries: [Summary, Summary] = [
    freeze(board, readAll('yesterday'), {
      at: new Date('2026-10-13T07:00:00Z'),
      today: '2026-10-13',
    }),
    freeze(board, found, {
      at: new Date('2026-10-14T07:00:00Z'),
      today: '2026-10-14',
      note: 'Kossi absent jeudi et vendredi.',
    }),
  ];

  const cards = board.cards
    .filter((card) => !(card.proposed && kept === 'dropped'))
    .map((card) => {
      if (card.kind === 'note') {
        return {
          id: card.id,
          place: card.place,
          children: (
            <div className="rounded-box border border-line bg-surface-control px-4 py-3 text-body-sm">
              <b className="block text-fg">{card.title}</b>
              <span className="text-fg-soft">{card.text}</span>
            </div>
          ),
        };
      }
      const entry = found.find((f) => f.metric.name === card.name);
      const t = entry ? trend(entry.reading, entry.metric.better) : null;
      return {
        id: card.id,
        place: card.place,
        children: (
          <KpiTile
            label={entry?.metric.label.fr ?? card.name}
            value={shown(entry?.reading)}
            {...(t && t.change !== null && t.direction !== 'flat'
              ? {
                  trend: {
                    direction: t.direction,
                    tone: t.tone,
                    label: `${trendLabel(t)} sur le trimestre`,
                  },
                }
              : {})}
            {...(card.goal ? { hint: `Objectif ${money(card.goal)}` } : {})}
          />
        ),
        ...(card.proposed && kept === 'shown'
          ? {
              proposed: (
                <>
                  <Button onClick={() => setKept('kept')}>Garder</Button>
                  <Button variant="secondary" onClick={() => setKept('dropped')}>
                    Retirer
                  </Button>
                </>
              ),
            }
          : {}),
      };
    });

  const latest = summaries[1];
  const changes = whatChanged(summaries[0], summaries[1]);
  const lines: SummaryLine[] =
    latest.figures.map((figure) => ({
      key: figure.card,
      label: figure.title.fr,
      value:
        figure.value === null ? '—' : figure.currency ? money(figure.value) : String(figure.value),
      ...(figure.trend && figure.trend.change !== null && figure.trend.direction !== 'flat'
        ? {
            trend: {
              direction: figure.trend.direction,
              tone: figure.trend.tone,
              label: trendLabel(figure.trend),
            },
          }
        : {}),
      ...(figure.over
        ? { flag: 'sous le seuil' }
        : figure.goal
          ? {
              flag: figure.goal.reached
                ? 'objectif atteint'
                : `objectif ${money(figure.goal.value)}`,
            }
          : {}),
    })) ?? [];

  return (
    <main className="mx-auto flex max-w-[1180px] flex-col gap-6 px-4 py-6">
      <PageHeader
        title="Mon tableau"
        description="Direction · le trimestre, comparé au précédent · envoyé chaque jour ouvré à 7 h"
      />
      <BoardGrid label="Direction" cards={cards} />
      {latest && (
        <section className="max-w-[560px]">
          <SummaryCard
            title="Direction"
            at="mardi 14 octobre, 7 h"
            changed={
              changes.length
                ? changes
                    .map(
                      (c) =>
                        `${c.title.fr} : ${c.to < c.from ? 'baisse' : 'hausse'}${c.change === null ? '' : ` de ${Math.round(Math.abs(c.change) * 100)} %`}`,
                    )
                    .join(' · ')
                : 'Rien n’a bougé depuis hier.'
            }
            lines={lines}
            {...(latest.note ? { note: latest.note } : {})}
            actions={
              <>
                <Button>Ouvrir le tableau</Button>
                <Button variant="secondary">Indexé</Button>
              </>
            }
          />
        </section>
      )}
    </main>
  );
}
