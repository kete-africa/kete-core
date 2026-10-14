// The public entry point of @kete/metrics, for screens: periods and trends, nothing that runs only
// on a server. Computing, serving and reading figures is `@kete/metrics/server`.
export type {
  Compute,
  MetricDefinition,
  MetricFilter,
  MetricQuery,
  MetricRegistry,
  ReadOptions,
} from './metrics.js';
export {
  isPeriod,
  periodRange,
  PERIODS,
  previousRange,
  type Period,
  type Range,
} from './period.js';
export { trend, type Trend } from './trend.js';
