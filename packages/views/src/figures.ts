// The figures of `view.v1` (spec 145; ADR 0016), as Apache ECharts options built by pure functions:
// the same rows always give the same drawing, a test can read it without a browser, and both
// renderers — React for Kete and the phone, the self-contained page for the copilots — share it.
// What ECharts does not draw well stays a component of its own: the bullet, the scorecard, the tile
// map, the number.

export type Cell = number | string | boolean | null;
export type FigureRow = Record<string, Cell>;

/** The design's colours, read where the figure is drawn: the charts follow the theme. */
export interface Palette {
  series: string[];
  text: string;
  line: string;
  muted: string;
  ok: string;
  verify: string;
  error: string;
}

export interface FigureInput {
  rows: FigureRow[];
  /** The period before, of the same length, when the reader compares. */
  previous?: FigureRow[] | null;
  target?: number | null;
  threshold?: number | null;
  better?: 'up' | 'down' | null;
  /** The words of the series, said by the place. */
  words: { now: string; before: string; cumulative: string; trajectory: string; share: string };
  /** A part already chosen on the board: the others fade. */
  selected?: string | null;
}

type Option = Record<string, unknown>;

/** The first field that is not a number names the parts; the numbers follow, in order. */
export function fieldsOf(rows: FigureRow[]): { label: string | null; values: string[] } {
  const first = rows[0] ?? {};
  const values = Object.keys(first).filter(
    (k) => typeof first[k] === 'number' || /\(|^count$/.test(k),
  );
  const label = Object.keys(first).find((k) => !values.includes(k)) ?? null;
  return { label, values };
}

const num = (v: Cell | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function base(palette: Palette): Option {
  return { color: palette.series, textStyle: { color: palette.text }, animation: false };
}
const grid = { left: 8, right: 8, top: 24, bottom: 8, containLabel: true };
const markLines = (input: FigureInput, palette: Palette) => {
  const data = [
    ...(input.target != null
      ? [{ yAxis: input.target, lineStyle: { color: palette.ok, type: 'dashed' } }]
      : []),
    ...(input.threshold != null
      ? [{ yAxis: input.threshold, lineStyle: { color: palette.error, type: 'dotted' } }]
      : []),
  ];
  return data.length ? { markLine: { symbol: 'none', label: { show: false }, data } } : {};
};

/** Bars or a line over the parts, the period before dashed, target and threshold drawn. */
function series(kind: 'bar' | 'line', input: FigureInput, palette: Palette): Option {
  const { label, values } = fieldsOf(input.rows);
  const value = values[0];
  const names = input.rows.map((r) => String((label ? r[label] : '') ?? '—'));
  const before = new Map(
    (input.previous ?? []).map((r) => [
      String((label ? r[label] : '') ?? '—'),
      num(value ? r[value] : 0),
    ]),
  );
  const dim = (name: string) => (input.selected && input.selected !== name ? 0.35 : 1);
  return {
    ...base(palette),
    tooltip: { trigger: 'axis' },
    grid,
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: palette.line } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: palette.line } } },
    series: [
      {
        name: input.words.now,
        type: kind,
        smooth: kind === 'line',
        data: names.map((name, i) => ({
          value: num(value ? input.rows[i]?.[value] : 0),
          itemStyle: { opacity: dim(name) },
        })),
        ...markLines(input, palette),
      },
      ...(input.previous
        ? [
            {
              name: input.words.before,
              type: 'line',
              data: names.map((name) => before.get(name) ?? null),
              lineStyle: { type: 'dashed', color: palette.muted },
              itemStyle: { color: palette.muted },
              symbol: 'none',
            },
          ]
        : []),
    ],
  };
}

function pie(input: FigureInput, palette: Palette): Option {
  const { label, values } = fieldsOf(input.rows);
  const value = values[0];
  return {
    ...base(palette),
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        label: { color: palette.text },
        data: input.rows.map((r) => {
          const name = String((label ? r[label] : '') ?? '—');
          return {
            name,
            value: num(value ? r[value] : 0),
            itemStyle: { opacity: input.selected && input.selected !== name ? 0.35 : 1 },
          };
        }),
      },
    ],
  };
}

/** Bars of the first measure, a line of the second on its own axis: revenue and margin. */
function combo(input: FigureInput, palette: Palette): Option {
  const { label, values } = fieldsOf(input.rows);
  const [bars, line] = values;
  const names = input.rows.map((r) => String((label ? r[label] : '') ?? '—'));
  return {
    ...base(palette),
    tooltip: { trigger: 'axis' },
    grid,
    legend: { top: 0, textStyle: { color: palette.text } },
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: palette.line } } },
    yAxis: [
      { type: 'value', splitLine: { lineStyle: { color: palette.line } } },
      { type: 'value', splitLine: { show: false } },
    ],
    series: [
      { name: bars ?? '', type: 'bar', data: input.rows.map((r) => num(bars ? r[bars] : 0)) },
      {
        name: line ?? '',
        type: 'line',
        yAxisIndex: 1,
        data: input.rows.map((r) => num(line ? r[line] : 0)),
      },
    ],
  };
}

/** The running total against a straight trajectory to the target: « 93 % of the budget ». */
function cumulative(input: FigureInput, palette: Palette): Option {
  const { label, values } = fieldsOf(input.rows);
  const value = values[0];
  const names = input.rows.map((r) => String((label ? r[label] : '') ?? '—'));
  let running = 0;
  const actual = input.rows.map((r) => (running += num(value ? r[value] : 0)));
  const steps = names.length;
  const trajectory =
    input.target != null && steps > 0
      ? names.map((_, i) => Math.round((((input.target as number) * (i + 1)) / steps) * 100) / 100)
      : [];
  return {
    ...base(palette),
    tooltip: { trigger: 'axis' },
    grid,
    legend: { top: 0, textStyle: { color: palette.text } },
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: palette.line } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: palette.line } } },
    series: [
      { name: input.words.cumulative, type: 'line', areaStyle: { opacity: 0.15 }, data: actual },
      ...(trajectory.length
        ? [
            {
              name: input.words.trajectory,
              type: 'line',
              data: trajectory,
              symbol: 'none',
              lineStyle: { type: 'dashed', color: palette.muted },
              itemStyle: { color: palette.muted },
            },
          ]
        : []),
    ],
  };
}

/**
 * From a total to another through what adds and takes away: « CA → achats → marge ». A row whose
 * `total` is true stands on the ground; the others float from the running sum.
 */
function waterfall(input: FigureInput, palette: Palette): Option {
  const { label, values } = fieldsOf(input.rows);
  const value = values[0];
  const names = input.rows.map((r) => String((label ? r[label] : '') ?? '—'));
  let running = 0;
  const ground: number[] = [];
  const bars: { value: number; itemStyle: { color: string } }[] = [];
  for (const r of input.rows) {
    const v = num(value ? r[value] : 0);
    if (r['total'] === true) {
      running = v;
      ground.push(0);
      bars.push({ value: v, itemStyle: { color: palette.series[0] ?? palette.text } });
    } else {
      const from = v >= 0 ? running : running + v;
      ground.push(from);
      bars.push({ value: Math.abs(v), itemStyle: { color: v >= 0 ? palette.ok : palette.error } });
      running += v;
    }
  }
  return {
    ...base(palette),
    tooltip: { trigger: 'axis' },
    grid,
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: palette.line } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: palette.line } } },
    series: [
      { type: 'bar', stack: 'w', silent: true, itemStyle: { color: 'transparent' }, data: ground },
      { name: input.words.now, type: 'bar', stack: 'w', data: bars },
    ],
  };
}

/** The causes, largest first, and the share they add up to: the few that make most. */
function pareto(input: FigureInput, palette: Palette): Option {
  const { label, values } = fieldsOf(input.rows);
  const value = values[0];
  const sorted = [...input.rows].sort(
    (a, b) => num(value ? b[value] : 0) - num(value ? a[value] : 0),
  );
  const total = sorted.reduce((s, r) => s + num(value ? r[value] : 0), 0);
  let running = 0;
  const share = sorted.map((r) => {
    running += num(value ? r[value] : 0);
    return total ? Math.round((running / total) * 1000) / 10 : 0;
  });
  return {
    ...base(palette),
    tooltip: { trigger: 'axis' },
    grid,
    xAxis: {
      type: 'category',
      data: sorted.map((r) => String((label ? r[label] : '') ?? '—')),
      axisLine: { lineStyle: { color: palette.line } },
    },
    yAxis: [
      { type: 'value', splitLine: { lineStyle: { color: palette.line } } },
      {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value} %' },
        splitLine: { show: false },
      },
    ],
    series: [
      { name: input.words.now, type: 'bar', data: sorted.map((r) => num(value ? r[value] : 0)) },
      {
        name: input.words.share,
        type: 'line',
        yAxisIndex: 1,
        data: share,
        markLine: {
          symbol: 'none',
          label: { show: false },
          data: [{ yAxis: 80, lineStyle: { color: palette.muted, type: 'dotted' } }],
        },
      },
    ],
  };
}

/** One profile on several axes, and the ring a value should not fall under. */
function radar(input: FigureInput, palette: Palette): Option {
  const { label, values } = fieldsOf(input.rows);
  const value = values[0];
  const top = Math.max(100, ...input.rows.map((r) => num(value ? r[value] : 0)));
  return {
    ...base(palette),
    tooltip: {},
    radar: {
      indicator: input.rows.map((r) => ({
        name: String((label ? r[label] : '') ?? '—'),
        max: top,
      })),
      axisName: { color: palette.text },
      splitLine: { lineStyle: { color: palette.line } },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            name: input.words.now,
            value: input.rows.map((r) => num(value ? r[value] : 0)),
            areaStyle: { opacity: 0.2 },
          },
          ...(input.threshold != null
            ? [
                {
                  name: '',
                  value: input.rows.map(() => input.threshold as number),
                  lineStyle: { type: 'dashed', color: palette.error },
                  itemStyle: { color: palette.error },
                  symbol: 'none',
                },
              ]
            : []),
        ],
      },
    ],
  };
}

/** How a duration spreads, part by part: its quartiles, its extremes, what lies far out. */
function boxplot(input: FigureInput, palette: Palette): Option {
  const { label } = fieldsOf(input.rows);
  const names = input.rows.map((r) => String((label ? r[label] : '') ?? '—'));
  const boxes = input.rows.map((r) => [
    num(r['min']),
    num(r['q1']),
    num(r['med']),
    num(r['q3']),
    num(r['max']),
  ]);
  const outliers = input.rows.flatMap((r, i) =>
    String(r['out'] ?? '')
      .split(',')
      .filter(Boolean)
      .map((v) => [i, Number(v)]),
  );
  return {
    ...base(palette),
    tooltip: { trigger: 'item' },
    grid,
    xAxis: { type: 'category', data: names, axisLine: { lineStyle: { color: palette.line } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: palette.line } } },
    series: [
      { name: input.words.now, type: 'boxplot', data: boxes, ...markLines(input, palette) },
      ...(outliers.length
        ? [{ type: 'scatter', data: outliers, itemStyle: { color: palette.error } }]
        : []),
    ],
  };
}

/** The charts ECharts draws; the others are components of their own. */
export const ECHARTS = [
  'bar',
  'line',
  'pie',
  'combo',
  'cumulative',
  'waterfall',
  'pareto',
  'radar',
  'boxplot',
] as const;
export type EchartsChart = (typeof ECHARTS)[number];

export function figureOption(chart: EchartsChart, input: FigureInput, palette: Palette): Option {
  switch (chart) {
    case 'bar':
    case 'line':
      return series(chart, input, palette);
    case 'pie':
      return pie(input, palette);
    case 'combo':
      return combo(input, palette);
    case 'cumulative':
      return cumulative(input, palette);
    case 'waterfall':
      return waterfall(input, palette);
    case 'pareto':
      return pareto(input, palette);
    case 'radar':
      return radar(input, palette);
    case 'boxplot':
      return boxplot(input, palette);
  }
}

/** A bullet's geometry: the value's bar, the target's tick, the alert zone, in percent of the scale. */
export function bulletOf(input: {
  value: number | null;
  target?: number | null;
  threshold?: number | null;
  min?: number;
  max?: number;
  better?: 'up' | 'down' | null;
}): { value: number | null; target: number | null; alert: { from: number; to: number } | null } {
  const min = input.min ?? 0;
  const max = Math.max(input.max ?? 100, input.value ?? 0, input.target ?? 0);
  const at = (v: number) => Math.max(0, Math.min(100, ((v - min) / (max - min || 1)) * 100));
  const alert =
    input.threshold == null
      ? null
      : input.better === 'down'
        ? { from: at(input.threshold), to: 100 }
        : { from: 0, to: at(input.threshold) };
  return {
    value: input.value === null ? null : at(input.value),
    target: input.target == null ? null : at(input.target),
    alert,
  };
}
