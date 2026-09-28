import type { HealthReport } from '../contracts/types.gen.js';
import type { SqlExecutor } from '../outbox/sql.js';

export interface DependencyCheck {
  /** A short public name, e.g. `database`. Never a connection string. */
  name: string;
  /** Resolves when the dependency is up; throws or times out when it is down. */
  probe: () => Promise<unknown>;
}

export interface HealthOptions {
  version: string;
  dependencies: readonly DependencyCheck[];
  /** Reads the outbox backlog; see `outboxBacklog`. */
  backlog: () => Promise<HealthReport['outbox']>;
  timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

/** Reads the pending delivery backlog across organizations, through its definer function. */
export async function outboxBacklog(db: SqlExecutor): Promise<HealthReport['outbox']> {
  const { rows } = await db.query<{ pending: string; oldest_pending_age_seconds: number | null }>(
    'select * from kete_outbox_backlog()',
  );
  const row = rows[0];
  const pending = Number(row?.pending ?? 0);
  return row?.oldest_pending_age_seconds == null
    ? { pending }
    : { pending, oldest_pending_age_seconds: Math.max(0, row.oldest_pending_age_seconds) };
}

/**
 * Builds the health report (FR-016): each dependency's state and the outbox backlog. One down
 * dependency makes the app `degraded`; all down makes it `down`.
 */
export async function buildHealthReport(options: HealthOptions): Promise<HealthReport> {
  const timeout = options.timeoutMs ?? 3000;
  const dependencies = await Promise.all(
    options.dependencies.map(async ({ name, probe }) => {
      const started = performance.now();
      try {
        await withTimeout(probe(), timeout);
        return { name, status: 'up' as const, latency_ms: Math.round(performance.now() - started) };
      } catch {
        return { name, status: 'down' as const };
      }
    }),
  );
  const down = dependencies.filter((d) => d.status === 'down').length;
  const status = down === 0 ? 'healthy' : down === dependencies.length ? 'down' : 'degraded';
  let outbox: HealthReport['outbox'] = { pending: 0 };
  if (status !== 'down') {
    try {
      outbox = await withTimeout(options.backlog(), timeout);
    } catch {
      outbox = { pending: 0 };
    }
  }
  return {
    status,
    version: options.version,
    checked_at: new Date().toISOString(),
    dependencies,
    outbox,
  };
}

/** `GET /health`: 200 when healthy or degraded, 503 when down. */
export function healthHandler(options: HealthOptions): () => Promise<Response> {
  return async () => {
    const report = await buildHealthReport(options);
    return Response.json(report, {
      status: report.status === 'down' ? 503 : 200,
      headers: { 'cache-control': 'no-store' },
    });
  };
}
