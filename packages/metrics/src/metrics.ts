import type { Metric, MetricReading } from '@kete/sdk';
import { validateMetric } from '@kete/sdk';
import { periodRange, previousRange, type Period, type Range } from './period.js';

// The figures of an app (spec 103; doctrine D-052): each declared in the manifest (metric.v1) and
// computed by the app's own code, within the reader's rights — the caller runs `read` inside her
// context. A reading says what it applied: the period when the figure has one, the filters on its
// axes only. No one writes a query.

/** The filters a reader asks, on the center's references. */
export interface MetricFilter {
  project_id?: string;
  party_id?: string;
  person_id?: string;
}

/** What a figure is computed over: its days (none for everything, or for a state) and filters. */
export interface MetricQuery {
  period: Range | null;
  filter: MetricFilter;
}

/** How a figure is computed: null when there is nothing to count. */
export type Compute = (query: MetricQuery) => Promise<number | null>;

/** Thrown by a computation the reader may not see: her reading says so, without a value. */
export class MetricDenied extends Error {
  constructor() {
    super('denied');
    this.name = 'MetricDenied';
  }
}

export interface MetricDefinition {
  metric: Metric;
  compute: Compute;
  /** For a figure in money: its currency, ISO 4217. */
  currency?: string;
}

export interface ReadOptions {
  /** The organization's today, `2026-10-14`: periods end on it. */
  today: string;
  period?: Period;
  /** Also read the period just before, of the same length. */
  compare?: boolean;
  filter?: MetricFilter;
  now?: () => Date;
}

export interface MetricRegistry {
  /** The figures, as the manifest declares them. */
  readonly metrics: readonly Metric[];
  /** The figures named — every one for `'all'` — read for the reader; an unknown name is skipped. */
  read(names: readonly string[] | 'all', options: ReadOptions): Promise<MetricReading[]>;
}

const AXES = { project_id: 'project', party_id: 'party', person_id: 'person' } as const;

/** The figures of an app; a figure that breaks its contract is refused at start. */
export function defineMetrics(definitions: readonly MetricDefinition[]): MetricRegistry {
  const byName = new Map<string, MetricDefinition>();
  for (const definition of definitions) {
    const { name } = definition.metric;
    const checked = validateMetric(definition.metric);
    if (!checked.ok) throw new Error(`The metric ${name} breaks metric.v1: ${checked.errors[0]}`);
    if (byName.has(name)) throw new Error(`The metric ${name} is declared twice.`);
    if (definition.metric.unit === 'money' && !/^[A-Z]{3}$/.test(definition.currency ?? '')) {
      throw new Error(`The metric ${name} is in money: give its currency.`);
    }
    byName.set(name, definition);
  }

  async function readOne(definition: MetricDefinition, options: ReadOptions) {
    const { metric } = definition;
    const axes = new Set(metric.axes ?? []);
    // A filter on an axis the figure does not have is left out: the reading shows it.
    const filter = Object.fromEntries(
      Object.entries(options.filter ?? {}).filter(
        ([key, value]) => value && axes.has(AXES[key as keyof MetricFilter]),
      ),
    ) as MetricFilter;
    // A figure without the period axis is a state — what is available now — never dated.
    const period = axes.has('period') ? periodRange(options.period ?? 'all', options.today) : null;
    const reading: MetricReading = {
      name: metric.name,
      value: null,
      at: (options.now?.() ?? new Date()).toISOString(),
      ...(definition.currency ? { currency: definition.currency } : {}),
      ...(period ? { period } : {}),
      ...(Object.keys(filter).length ? { filter } : {}),
    };
    try {
      reading.value = await definition.compute({ period, filter });
      if (options.compare && period) {
        reading.previous = await definition.compute({ period: previousRange(period), filter });
      }
    } catch (error) {
      if (!(error instanceof MetricDenied)) throw error;
      return { ...reading, value: null, denied: true } satisfies MetricReading;
    }
    return reading;
  }

  return {
    metrics: definitions.map((definition) => definition.metric),
    async read(names, options) {
      const chosen =
        names === 'all'
          ? [...byName.values()]
          : names.flatMap((name) => {
              const definition = byName.get(name);
              return definition ? [definition] : [];
            });
      return Promise.all(chosen.map((definition) => readOne(definition, options)));
    },
  };
}
