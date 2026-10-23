import { useEffect, useRef, type ReactNode } from 'react';
import {
  bulletOf,
  ECHARTS,
  figureOption,
  type EchartsChart,
  type FigureInput,
  type FigureRow,
  type Palette,
} from '../figures.js';

// The React renderer of view.v1's figures (spec 145; ADR 0016), for Kete and the phone: ECharts
// for the charts it draws well, loaded only when one is shown; the bullet, the tile map and the
// number as components of their own; the same states everywhere. Every word comes from the place.

/** The design's colours, read where the figure is drawn: it follows the theme. */
export function paletteOf(element: Element = document.documentElement): Palette {
  const css = getComputedStyle(element);
  const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    series: [
      '--color-primary',
      '--color-accent',
      '--color-state-info',
      '--color-state-success',
      '--color-state-verify',
      '--color-state-error',
    ]
      .map((name) => css.getPropertyValue(name).trim())
      .filter(Boolean),
    text: token('--color-fg', 'currentColor'),
    line: token('--color-line', '#ccc'),
    muted: token('--color-fg-muted', '#999'),
    ok: token('--color-state-success', '#2e7d32'),
    verify: token('--color-state-verify', '#b26a00'),
    error: token('--color-state-error', '#c62828'),
  };
}

/** One of the charts ECharts draws, sized by its box, redrawn when it changes. */
export function EChart({
  chart,
  input,
  label,
  onSelect,
}: {
  chart: EchartsChart;
  input: FigureInput;
  /** What the chart shows, for who cannot see it. */
  label: string;
  onSelect?: (part: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let disposed = false;
    let drawn: { dispose(): void; resize(): void } | null = null;
    void import('echarts').then((echarts) => {
      if (disposed) return;
      const instance = echarts.init(element, null, { renderer: 'svg' });
      instance.setOption(figureOption(chart, input, paletteOf(element)));
      instance.on('click', (params: { name?: string }) => {
        if (params.name) select.current?.(params.name);
      });
      drawn = instance;
    });
    const observer = new ResizeObserver(() => drawn?.resize());
    observer.observe(element);
    return () => {
      disposed = true;
      observer.disconnect();
      drawn?.dispose();
    };
  }, [chart, input]);
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      className={`h-full min-h-40 w-full ${onSelect ? 'cursor-pointer' : ''}`}
    />
  );
}

/** A value on its scale: its bar, the target's tick, the zone that turns it red. */
export function Bullet({
  value,
  target,
  threshold,
  min,
  max,
  better,
  label,
}: {
  value: number | null;
  target?: number | null;
  threshold?: number | null;
  min?: number;
  max?: number;
  better?: 'up' | 'down' | null;
  label: string;
}) {
  const at = bulletOf({
    value,
    target: target ?? null,
    threshold: threshold ?? null,
    ...(min === undefined ? {} : { min }),
    ...(max === undefined ? {} : { max }),
    better: better ?? null,
  });
  return (
    <svg
      viewBox="0 0 100 16"
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className="h-4 w-full"
    >
      <rect x="0" y="4" width="100" height="8" className="fill-surface-hover" />
      {at.alert && (
        <rect
          x={at.alert.from}
          y="4"
          width={at.alert.to - at.alert.from}
          height="8"
          className="fill-state-error-surface"
        />
      )}
      {at.value !== null && <rect x="0" y="6" width={at.value} height="4" className="fill-fg" />}
      {at.target !== null && (
        <rect x={at.target - 0.5} y="2" width="1" height="12" className="fill-state-success-fg" />
      )}
    </svg>
  );
}

/** Regions as tiles, each coloured by its value; a click filters the board on it. */
export function TileMap({
  rows,
  label,
  value,
  selected,
  onSelect,
  name,
}: {
  rows: FigureRow[];
  label: string;
  value: string;
  selected?: string | null;
  onSelect?: (part: string) => void;
  name: string;
}) {
  const values = rows.map((r) => (typeof r[value] === 'number' ? (r[value] as number) : 0));
  const top = Math.max(1, ...values);
  return (
    <ul aria-label={name} className="grid grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] gap-1.5">
      {rows.map((r, i) => {
        const part = String(r[label] ?? '—');
        const share = (values[i] ?? 0) / top;
        return (
          <li key={part}>
            <button
              type="button"
              aria-pressed={selected === part}
              onClick={() => onSelect?.(part)}
              className="flex h-14 w-full flex-col justify-between rounded-control border border-line px-2 py-1 text-left text-caption aria-pressed:border-fg"
              style={{
                backgroundColor: `color-mix(in oklab, var(--color-primary) ${Math.round(share * 45)}%, transparent)`,
              }}
            >
              <span className="truncate">{part}</span>
              <span className="font-semibold tabular-nums">{values[i]}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** The states every component draws the same way (R17): never a zero for what is not known. */
export type FigureState = 'loading' | 'empty' | 'missing' | 'denied' | 'stale';

export function StateOf({
  state,
  words,
}: {
  state: FigureState;
  words: Record<FigureState, string>;
}) {
  const tone =
    state === 'missing'
      ? 'text-state-error-fg'
      : state === 'stale'
        ? 'text-state-verify-fg'
        : 'text-fg-muted';
  return (
    <p role={state === 'loading' ? 'status' : undefined} className={`text-body-sm ${tone}`}>
      {words[state]}
    </p>
  );
}

/** « D'où vient ce chiffre ? »: one disclosure, closed until asked. */
export function Provenance({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="text-caption text-fg-muted">
      <summary className="cursor-pointer select-none">{summary}</summary>
      <div className="mt-1 [overflow-wrap:anywhere]">{children}</div>
    </details>
  );
}

export const isEchart = (chart: string): chart is EchartsChart =>
  (ECHARTS as readonly string[]).includes(chart);
