import type { Dataset, DatasetAnswer, DatasetQuery } from '@kete/sdk';
import { validateDatasetQuery } from '@kete/sdk';

// The Measure's query engine (spec 144, ADR 0015): a data set's rows summed up where they live —
// filtered on the center's four axes through the data set's `axes`, on its own fields, grouped,
// measured — so that only the answer travels (dataset-answer.v1). The same engine serves an app's
// data sets (`@kete/capabilities`) and the center's own tables. No one writes a query language:
// every field named is the data set's own.

/** The rows an app sums up at once; beyond, the answer says it was cut. */
export const MAX_ROWS = 50_000;

export type DatasetRow = Record<string, unknown>;
type Measure = DatasetQuery['measures'][number];
type Axes = NonNullable<DatasetQuery['filter']>;

export class QueryRefused extends Error {
  constructor(
    readonly code: 'invalid_query' | 'unknown_field' | 'not_a_number',
    message: string,
  ) {
    super(message);
    this.name = 'QueryRefused';
  }
}

/** The key a measure takes in a group: `count`, or `fn(field)`. */
export const measureName = (m: Measure): string =>
  m.fn === 'count' && !m.field ? 'count' : `${m.fn}(${m.field ?? ''})`;

/** A data set's fields, and those that are numbers, read from its row's JSON Schema. */
export function fieldsOf(dataset: Pick<Dataset, 'row'>): {
  all: Set<string>;
  numbers: Set<string>;
} {
  const properties = (dataset.row as { properties?: Record<string, { type?: unknown }> })
    .properties;
  const all = new Set<string>();
  const numbers = new Set<string>();
  for (const [name, schema] of Object.entries(properties ?? {})) {
    all.add(name);
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (types.includes('number') || types.includes('integer')) numbers.add(name);
  }
  return { all, numbers };
}

const AXIS_FIELD = {
  project_id: 'project',
  party_id: 'party',
  unit_id: 'unit',
  person_id: 'person',
  object_id: 'object',
} as const;

/** The axes asked that the data set carries, each with the field that holds it. */
function axesOf(dataset: Pick<Dataset, 'axes'>, filter: Axes | undefined) {
  const applied: Axes = {};
  const tests: [string, string][] = [];
  const axes = dataset.axes ?? {};
  type Axis = (typeof AXIS_FIELD)[keyof typeof AXIS_FIELD];
  for (const [key, axis] of Object.entries(AXIS_FIELD) as [keyof Axes, Axis][]) {
    const value = filter?.[key];
    const held = axes[axis];
    const field = typeof held === 'string' ? held : held?.field;
    if (!value || !field) continue;
    applied[key] = value;
    tests.push([field, value]);
  }
  return { applied, tests };
}

function passes(row: DatasetRow, where: NonNullable<DatasetQuery['where']>): boolean {
  return where.every((f) => {
    const v = row[f.field];
    if (v === null || v === undefined) return f.op === 'neq';
    const text = String(v).toLowerCase();
    const wanted = String(f.value).toLowerCase();
    switch (f.op) {
      case 'eq':
        return text === wanted;
      case 'neq':
        return text !== wanted;
      case 'gte':
        return typeof v === 'number' ? v >= Number(f.value) : String(v) >= String(f.value);
      case 'lte':
        return typeof v === 'number' ? v <= Number(f.value) : String(v) <= String(f.value);
      case 'contains':
        return text.includes(wanted);
    }
  });
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;
const cell = (v: unknown): number | string | boolean | null =>
  typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean' ? v : null;

/** Checks a question against a data set: its own fields only, numbers where a sum is asked. */
export function checkQuery(dataset: Pick<Dataset, 'row'>, query: unknown): DatasetQuery {
  const checked = validateDatasetQuery(query);
  if (!checked.ok) throw new QueryRefused('invalid_query', checked.errors[0] ?? 'invalid');
  const q = query as DatasetQuery;
  const { all, numbers } = fieldsOf(dataset);
  const named = [
    ...(q.where ?? []).map((f) => f.field),
    ...(q.group_by ?? []),
    ...q.measures.flatMap((m) => (m.field ? [m.field] : [])),
  ];
  const unknown = named.filter((n) => !all.has(n));
  if (unknown.length) {
    throw new QueryRefused('unknown_field', `Unknown fields: ${unknown.join(', ')}`);
  }
  for (const m of q.measures) {
    if (m.fn !== 'count' && (!m.field || !numbers.has(m.field))) {
      throw new QueryRefused('not_a_number', `${m.fn} needs a number field.`);
    }
  }
  return q;
}

/**
 * Sums a data set's rows up for a question: the axes it carries, its own filters, its period, its
 * groups — the largest first. `cut` says the rows given were already cut at the source.
 */
export function answerQuery(
  dataset: Pick<Dataset, 'name' | 'row' | 'time' | 'axes'>,
  rows: readonly DatasetRow[],
  question: unknown,
  options: { cut?: boolean; now?: () => Date } = {},
): DatasetAnswer {
  const q = checkQuery(dataset, question);
  const { applied, tests } = axesOf(dataset, q.filter);
  const time = dataset.time;
  const kept = rows.filter((row) => {
    for (const [field, value] of tests) if (String(row[field] ?? '') !== value) return false;
    if (time && (q.from || q.to)) {
      const day = String(row[time] ?? '').slice(0, 10);
      if (!day || (q.from && day < q.from) || (q.to && day > q.to)) return false;
    }
    return passes(row, q.where ?? []);
  });
  const groupBy = q.group_by ?? [];
  const groups = new Map<string, { key: Record<string, unknown>; rows: DatasetRow[] }>();
  for (const row of kept) {
    const key = Object.fromEntries(groupBy.map((g) => [g, cell(row[g])]));
    const id = JSON.stringify(key);
    const group = groups.get(id) ?? { key, rows: [] };
    group.rows.push(row);
    groups.set(id, group);
  }
  // No group asked and no row: one line all the same — a count of 0 is an answer, a sum is not.
  if (groupBy.length === 0 && groups.size === 0) groups.set('{}', { key: {}, rows: [] });
  const result = [...groups.values()].map(({ key, rows: members }) => {
    const out: Record<string, number | string | boolean | null> = {
      ...(key as Record<string, number | string | boolean | null>),
    };
    for (const m of q.measures) {
      const values = m.field
        ? members
            .map((r) => r[m.field as string])
            .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
        : [];
      const sum = values.reduce((a, b) => a + b, 0);
      out[measureName(m)] =
        m.fn === 'count'
          ? m.field
            ? values.length
            : members.length
          : values.length === 0
            ? null
            : m.fn === 'sum'
              ? round(sum)
              : m.fn === 'avg'
                ? round(sum / values.length)
                : m.fn === 'min'
                  ? Math.min(...values)
                  : Math.max(...values);
    }
    return out;
  });
  const first = measureName(q.measures[0] as Measure);
  const limit = q.limit ?? 100;
  result.sort((a, b) => Number(b[first] ?? -Infinity) - Number(a[first] ?? -Infinity));
  return {
    dataset: dataset.name,
    rows: result.slice(0, limit),
    counted: kept.length,
    truncated: Boolean(options.cut) || result.length > limit,
    filter: applied,
    at: (options.now ?? (() => new Date()))().toISOString(),
  };
}
