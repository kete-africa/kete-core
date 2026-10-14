// The server half of @kete/metrics: an app's figures computed within the reader's rights, served at
// /api/metrics, and read from another app with her token. Anything not exported here is internal.
export {
  metricsAsked,
  metricsResponse,
  readMetrics,
  type MetricsAsked,
  type Within,
} from './http.js';
export { defineMetrics, MetricDenied } from './metrics.js';
