import { useId, type CSSProperties, type ReactNode } from 'react';
import { cx } from './components.js';

// The board's parts (kete-core spec 103; doctrine D-052): its cards on twelve columns — one under
// the other on a phone, in the same order — and a summary, the board frozen at a moment. What a
// card shows is the app's (a KpiTile, a chart, a note); every word comes through props.

/** A card in its place on twelve columns, rows of `rowHeight`. */
export interface BoardCardSlot {
  id: string;
  place: { x: number; y: number; w: number; h: number };
  children: ReactNode;
  /** Put there by the assistant: dashed, with her gestures — Keep, Remove. */
  proposed?: ReactNode;
}

/** A board's grid: twelve columns on a screen, a single column on a phone, in reading order. */
export function BoardGrid({
  label,
  cards,
  rowHeight = 72,
}: {
  /** The board's name, for assistive technologies. */
  label: string;
  cards: BoardCardSlot[];
  rowHeight?: number;
}) {
  const ordered = [...cards].sort((a, b) => a.place.y - b.place.y || a.place.x - b.place.x);
  return (
    <section
      aria-label={label}
      data-board="grid"
      className="grid grid-cols-1 gap-3 min-[761px]:auto-rows-[var(--board-row)] min-[761px]:grid-cols-12"
      style={{ '--board-row': `${rowHeight}px` } as CSSProperties}
    >
      {ordered.map((card) => (
        <div
          key={card.id}
          data-proposed={card.proposed !== undefined ? 'true' : undefined}
          className={cx(
            'flex min-w-0 flex-col gap-2 min-[761px]:[grid-column:var(--board-col)] min-[761px]:[grid-row:var(--board-rows)]',
            card.proposed !== undefined &&
              'rounded-box border border-dashed border-line-selected p-2',
          )}
          style={
            {
              '--board-col': `${card.place.x + 1} / span ${card.place.w}`,
              '--board-rows': `${card.place.y + 1} / span ${card.place.h}`,
            } as CSSProperties
          }
        >
          <div className="min-h-0 flex-1 [&>*]:h-full">{card.children}</div>
          {card.proposed !== undefined && (
            <div className="flex flex-wrap gap-2">{card.proposed}</div>
          )}
        </div>
      ))}
    </section>
  );
}

/** A figure as a summary kept it. */
export interface SummaryLine {
  key: string;
  label: ReactNode;
  value: ReactNode;
  /** Where it went: « ▲ 12 % », worded and toned like KpiTile's. */
  trend?: { direction: 'up' | 'down' | 'flat'; tone: 'good' | 'bad' | 'neutral'; label: ReactNode };
  /** What it says beyond its value: « sous le seuil », « objectif atteint », « sans réponse ». */
  flag?: ReactNode;
}

/**
 * A summary — the board frozen at a moment (doctrine D-052): what changed first, then each figure
 * as it was, her words of the day, and its gestures (open the board, index it, send it).
 */
export function SummaryCard({
  title,
  at,
  changed,
  lines,
  note,
  actions,
}: {
  title: ReactNode;
  /** When it was frozen: « lundi 14 octobre, 7 h ». */
  at: ReactNode;
  /** What moved since the last one, in a sentence. */
  changed?: ReactNode;
  lines: SummaryLine[];
  /** Her words when it was frozen. */
  note?: ReactNode;
  actions?: ReactNode;
}) {
  const titleId = useId();
  return (
    <article
      aria-labelledby={titleId}
      className="overflow-hidden rounded-box border border-line bg-surface text-fg"
      data-summary
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 pt-3.5 pb-2">
        <h3 id={titleId} className="m-0 text-body font-semibold">
          {title}
        </h3>
        <span className="text-body-sm text-fg-muted">{at}</span>
      </header>
      {changed && <p className="m-0 px-4 pb-2 text-body-sm text-fg-soft">{changed}</p>}
      <dl className="m-0 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 border-t border-line px-4 py-2">
        {lines.map((line) => (
          <div key={line.key} className="contents">
            <dt className="min-w-0 border-b border-line py-2 text-body-sm text-fg-muted last-of-type:border-0">
              {line.label}
              {line.flag && <span className="block text-fg">{line.flag}</span>}
            </dt>
            <dd className="m-0 flex flex-col items-end border-b border-line py-2 text-right">
              <span className="font-number tabular-nums">{line.value}</span>
              {line.trend && (
                <span
                  data-tone={line.trend.tone}
                  className={cx(
                    'font-number text-body-sm',
                    line.trend.tone === 'good' && 'text-state-success-fg',
                    line.trend.tone === 'bad' && 'text-state-error-fg',
                    line.trend.tone === 'neutral' && 'text-fg-muted',
                  )}
                >
                  <span aria-hidden="true">
                    {line.trend.direction === 'up'
                      ? '▲ '
                      : line.trend.direction === 'down'
                        ? '▼ '
                        : '= '}
                  </span>
                  {line.trend.label}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {note && (
        <blockquote className="m-0 border-t border-line bg-surface-control px-4 py-2.5 text-body-sm text-fg-soft">
          {note}
        </blockquote>
      )}
      {actions && (
        <footer className="flex flex-wrap gap-2 border-t border-line px-4 py-3">{actions}</footer>
      )}
    </article>
  );
}
