import type { Pool } from 'pg';
import type { DeliveryResult, KeteEvent } from '../contracts/types.gen.js';
import type { Transport } from '../delivery/transport.js';
import { sign, type SigningKey } from '../signing/signature.js';

/** Maximum events and bytes per delivered batch (research R-04). */
export const MAX_BATCH_EVENTS = 100;
export const MAX_BATCH_BYTES = 256 * 1024;

/** Exponential backoff with jitter, from 5 seconds to 1 hour. */
export function backoffSeconds(attempts: number, random: () => number = Math.random): number {
  const base = Math.min(3600, 5 * 2 ** Math.max(0, attempts - 1));
  return Math.max(1, Math.round(base * (0.5 + random())));
}

export interface RelayOptions {
  /** A pool connected with the application role. */
  pool: Pool;
  transport: Transport;
  product: string;
  /**
   * Signs each batch (Kete Cockpit). Without it, the transport authenticates the app otherwise —
   * its own token, for its center (spec 049).
   */
  key?: SigningKey;
  /** The outbox to deliver (default `kete_outbox`). */
  outbox?: string;
  batchSize?: number;
  leaseSeconds?: number;
  /** Overrides the retry delay (tests). */
  retryDelaySeconds?: (attempts: number) => number;
}

export interface FlushReport {
  claimed: number;
  delivered: number;
  refused: number;
  retried: number;
}

interface Settlement {
  event_id: string;
  outcome: 'delivered' | 'refused' | 'retry';
  reason?: string;
  delay_seconds?: number;
}

interface ClaimedRow extends Record<string, unknown> {
  event_id: string;
  envelope: KeteEvent;
  attempts: number;
}

function splitBatches(events: KeteEvent[]): KeteEvent[][] {
  const batches: KeteEvent[][] = [];
  let current: KeteEvent[] = [];
  let bytes = 0;
  for (const event of events) {
    const size = Buffer.byteLength(JSON.stringify(event)) + 1;
    const full = current.length >= MAX_BATCH_EVENTS || bytes + size > MAX_BATCH_BYTES;
    if (current.length > 0 && full) {
      batches.push(current);
      current = [];
      bytes = 0;
    }
    current.push(event);
    bytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

/**
 * Delivers pending outbox events: claim with a lease, sign, send, settle each event.
 * At-least-once from the app; the receiver makes it exactly-once (research R-06).
 */
export function createOutboxRelay(options: RelayOptions) {
  const outbox = options.outbox ?? 'kete_outbox';
  if (!/^[a-z_][a-z0-9_]*$/.test(outbox)) throw new Error(`Invalid outbox: ${outbox}`);
  const batchSize = options.batchSize ?? MAX_BATCH_EVENTS;
  const leaseSeconds = options.leaseSeconds ?? 60;
  const delayFor = options.retryDelaySeconds ?? ((attempts: number) => backoffSeconds(attempts));
  let timer: NodeJS.Timeout | undefined;
  let running: Promise<FlushReport> | undefined;

  async function deliver(batch: KeteEvent[], attempts: Map<string, number>): Promise<Settlement[]> {
    const retry = (id: string, reason: string): Settlement => ({
      event_id: id,
      outcome: 'retry',
      reason,
      delay_seconds: delayFor(attempts.get(id) ?? 1),
    });
    const body = JSON.stringify({ events: batch });
    let result: DeliveryResult;
    try {
      result = await options.transport.send({
        body,
        product: options.product,
        signature: options.key ? sign(body, options.key) : '',
      });
    } catch (error) {
      return batch.map((e) => retry(e.id, (error as Error).message));
    }
    const byId = new Map(result.results.map((r) => [r.id, r]));
    return batch.map((e): Settlement => {
      const r = byId.get(e.id);
      if (!r) return retry(e.id, 'missing result');
      if (r.outcome === 'refused') {
        return { event_id: e.id, outcome: 'refused', reason: r.reason ?? 'refused' };
      }
      return { event_id: e.id, outcome: 'delivered' };
    });
  }

  async function flushOnce(): Promise<FlushReport> {
    const report: FlushReport = { claimed: 0, delivered: 0, refused: 0, retried: 0 };
    const { rows } = await options.pool.query<ClaimedRow>(`select * from ${outbox}_claim($1, $2)`, [
      batchSize,
      leaseSeconds,
    ]);
    if (rows.length === 0) return report;
    report.claimed = rows.length;
    const attempts = new Map(rows.map((r) => [r.event_id, r.attempts]));
    const settlements: Settlement[] = [];
    for (const batch of splitBatches(rows.map((r) => r.envelope))) {
      settlements.push(...(await deliver(batch, attempts)));
    }
    await options.pool.query(`select ${outbox}_settle($1::jsonb)`, [JSON.stringify(settlements)]);
    for (const s of settlements) {
      if (s.outcome === 'delivered') report.delivered++;
      else if (s.outcome === 'refused') report.refused++;
      else report.retried++;
    }
    return report;
  }

  const relay = {
    /** Delivers one claimed batch. Concurrent calls share the same run. */
    flush(): Promise<FlushReport> {
      running ??= flushOnce().finally(() => {
        running = undefined;
      });
      return running;
    },
    /** Flushes on an interval until `stop()`. Errors are reported, never thrown. */
    start(intervalMs = 5000, onError: (error: unknown) => void = () => undefined): void {
      if (timer) return;
      timer = setInterval(() => {
        relay.flush().catch(onError);
      }, intervalMs);
    },
    stop(): void {
      if (timer) clearInterval(timer);
      timer = undefined;
    },
  };
  return relay;
}

export type OutboxRelay = ReturnType<typeof createOutboxRelay>;
