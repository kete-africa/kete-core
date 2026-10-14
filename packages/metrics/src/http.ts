import type { MetricReading } from '@kete/sdk';
import { validateMetricReading } from '@kete/sdk';
import type { MetricFilter, MetricRegistry } from './metrics.js';
import { isPeriod, type Period } from './period.js';

// The figures over HTTP (spec 103): an app answers `GET /api/metrics` with its readings for the
// person whose token it receives, within her rights; the center — or another app — reads them with
// her token. What travels is the contract metric-reading.v1.

/** What a reader asks, in the query string: `?names=a,b&period=30d&compare=1&project=prj_…`. */
export interface MetricsAsked {
  names: string[] | 'all';
  period: Period;
  compare: boolean;
  filter: MetricFilter;
}

const FILTERS = { project: 'project_id', party: 'party_id', person: 'person_id' } as const;

/** The question in a URL; anything it does not understand is ignored. */
export function metricsAsked(url: URL): MetricsAsked {
  const names = (url.searchParams.get('names') ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 50);
  const period = url.searchParams.get('period');
  const filter: MetricFilter = {};
  for (const [param, key] of Object.entries(FILTERS)) {
    const value = url.searchParams.get(param)?.trim();
    if (value && value.length <= 100) filter[key] = value;
  }
  return {
    names: names.length ? names : 'all',
    period: isPeriod(period) ? period : 'all',
    compare: url.searchParams.get('compare') === '1',
    filter,
  };
}

/** The work of a request, run within the reader's context (her rights). */
export type Within = <T>(work: () => Promise<T>) => Promise<T>;

/** An app's answer to `GET /api/metrics`: its readings for the reader, never kept by a cache. */
export async function metricsResponse(
  registry: MetricRegistry,
  request: Request,
  options: { today: string; within?: Within; now?: () => Date },
): Promise<Response> {
  const asked = metricsAsked(new URL(request.url));
  const read = () =>
    registry.read(asked.names, {
      today: options.today,
      period: asked.period,
      compare: asked.compare,
      filter: asked.filter,
      ...(options.now ? { now: options.now } : {}),
    });
  const readings = await (options.within ? options.within(read) : read());
  return Response.json({ readings }, { headers: { 'cache-control': 'no-store' } });
}

/**
 * Reads an app's figures with the reader's token; what breaks the contract is dropped, and an app
 * that does not answer gives none — a board shows its other figures.
 */
export async function readMetrics(options: {
  /** The app's address: `https://finance.example`. */
  url: string;
  token: string;
  names?: readonly string[];
  period?: Period;
  compare?: boolean;
  filter?: MetricFilter;
  fetch?: typeof fetch;
}): Promise<MetricReading[]> {
  const target = new URL('/api/metrics', options.url);
  if (options.names?.length) target.searchParams.set('names', options.names.join(','));
  if (options.period) target.searchParams.set('period', options.period);
  if (options.compare) target.searchParams.set('compare', '1');
  for (const [param, key] of Object.entries(FILTERS)) {
    const value = options.filter?.[key];
    if (value) target.searchParams.set(param, value);
  }
  try {
    const response = await (options.fetch ?? fetch)(target, {
      headers: { authorization: `Bearer ${options.token}` },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { readings?: unknown };
    return Array.isArray(body.readings)
      ? body.readings.filter(
          (reading): reading is MetricReading => validateMetricReading(reading).ok,
        )
      : [];
  } catch {
    return [];
  }
}
