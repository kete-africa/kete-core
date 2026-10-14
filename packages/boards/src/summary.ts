import { periodRange, trend, type Period, type Range, type Trend } from '@kete/metrics';
import type { Metric, MetricReading } from '@kete/sdk';
import type { Board, FigureCard } from './board.js';

// A summary (spec 103; doctrine D-052): a board frozen at a moment — what each figure said, where
// it went, whether it reached its goal or passed its threshold, and her words of the day. Kept as
// it was: a summary is never read again. What changed since the last one is what a routine tells
// first; indexed only when she chose so.

/** What an app said of one of its figures, for one reader. */
export interface Found {
  app: string;
  metric: Metric;
  reading: MetricReading;
}

export interface SummaryFigure {
  card: string;
  app: string;
  name: string;
  /** Her title, or the figure's label. */
  title: { fr: string; en: string };
  unit: Metric['unit'];
  better: Metric['better'];
  value: number | null;
  previous?: number | null;
  currency?: string;
  trend: Trend | null;
  /** Her goal, and whether the figure reached it. */
  goal?: { value: number; reached: boolean };
  /** Past her threshold. */
  over?: boolean;
  /** She may not read it: no value. */
  denied?: boolean;
  /** Its app did not answer, or no longer has it. */
  missing?: boolean;
}

export interface Summary {
  board: string;
  title: string;
  /** When it was frozen, ISO 8601. */
  at: string;
  period: Period;
  range: Range | null;
  figures: SummaryFigure[];
  notes: { title: string; text: string }[];
  /** Her words when it was frozen — the evening's « noter ». */
  note?: string;
}

function figureOf(card: FigureCard, found: Found | undefined): SummaryFigure {
  const base = { card: card.id, app: card.app, name: card.name };
  if (!found) {
    const name = { fr: card.title ?? card.name, en: card.title ?? card.name };
    return {
      ...base,
      title: name,
      unit: 'count',
      better: 'none',
      value: null,
      trend: null,
      missing: true,
    };
  }
  const { metric, reading } = found;
  const value = reading.value;
  const better = metric.better;
  const reached =
    card.goal === undefined || value === null
      ? undefined
      : better === 'down'
        ? value <= card.goal
        : value >= card.goal;
  const over =
    card.threshold === undefined || value === null
      ? undefined
      : better === 'down'
        ? value > card.threshold
        : value < card.threshold;
  return {
    ...base,
    title: card.title ? { fr: card.title, en: card.title } : metric.label,
    unit: metric.unit,
    better,
    value,
    ...(reading.previous !== undefined ? { previous: reading.previous } : {}),
    ...(reading.currency ? { currency: reading.currency } : {}),
    trend: trend(reading, better),
    ...(reached !== undefined && card.goal !== undefined
      ? { goal: { value: card.goal, reached } }
      : {}),
    ...(over ? { over } : {}),
    ...(reading.denied ? { denied: true } : {}),
  };
}

/**
 * The board frozen now: each figure card with what its app said — a card whose app did not answer
 * says so — her notes, her words. A proposed card is not hers yet: it is left out.
 */
export function freeze(
  board: Board,
  found: readonly Found[],
  options: { at: Date; today: string; period?: Period; note?: string },
): Summary {
  const period = options.period ?? board.period;
  const cards = board.cards.filter((card) => !card.proposed);
  const note = options.note?.trim();
  return {
    board: board.id,
    title: board.title,
    at: options.at.toISOString(),
    period,
    range: periodRange(period, options.today),
    figures: cards.flatMap((card) =>
      card.kind === 'figure'
        ? [
            figureOf(
              card,
              found.find((f) => f.app === card.app && f.metric.name === card.name),
            ),
          ]
        : [],
    ),
    notes: cards.flatMap((card) =>
      card.kind === 'note' ? [{ title: card.title, text: card.text }] : [],
    ),
    ...(note ? { note } : {}),
  };
}

export interface Change {
  card: string;
  title: { fr: string; en: string };
  from: number;
  to: number;
  /** As a ratio of where it was; null from zero. */
  change: number | null;
  tone: Trend['tone'];
}

/** What moved between two summaries of a board, the largest move first; what stayed is left out. */
export function whatChanged(before: Summary, after: Summary): Change[] {
  const changes: Change[] = [];
  for (const figure of after.figures) {
    const earlier = before.figures.find((f) => f.card === figure.card);
    if (!earlier || earlier.value === null || figure.value === null) continue;
    if (earlier.value === figure.value) continue;
    const up = figure.value > earlier.value;
    changes.push({
      card: figure.card,
      title: figure.title,
      from: earlier.value,
      to: figure.value,
      change: earlier.value === 0 ? null : (figure.value - earlier.value) / Math.abs(earlier.value),
      tone:
        figure.better === 'none'
          ? 'neutral'
          : (up ? 'up' : 'down') === figure.better
            ? 'good'
            : 'bad',
    });
  }
  const size = (c: Change) => (c.change === null ? Infinity : Math.abs(c.change));
  return changes.sort((a, b) => size(b) - size(a));
}

/**
 * A summary as a document to index — only when she chose to index the board's summaries: its title
 * and one page of text, for `indexDocument` of @kete/knowledge. The figures are worded by the app.
 */
export function summaryDocument(
  summary: Summary,
  options: {
    lang: 'fr' | 'en';
    /** A figure in words: « 6 480 000 F », « non lisible ». */
    value: (figure: SummaryFigure) => string;
    /** The title of the document: « Tableau Direction — 14 octobre 2026 ». */
    title: string;
  },
): { title: string; pages: string[] } {
  const lines = [
    options.title,
    '',
    ...summary.figures.map(
      (figure) => `- ${figure.title[options.lang]} : ${options.value(figure)}`,
    ),
    ...summary.notes.flatMap((note) => ['', note.title, note.text]),
    ...(summary.note ? ['', summary.note] : []),
  ];
  return { title: options.title, pages: [lines.join('\n')] };
}
