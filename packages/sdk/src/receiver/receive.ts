import type { DeliveryResult, KeteEvent } from '../contracts/types.gen.js';
import { validateDeliveryRequest, validateEvent } from '../contracts/validate.js';
import { MAX_BATCH_BYTES } from '../outbox/relay.js';
import type { SqlExecutor } from '../outbox/sql.js';
import { PRODUCT_HEADER, SIGNATURE_HEADER, verify, type KeyRing } from '../signing/signature.js';

/**
 * Remembers accepted events. `accept` stores the events it has never seen and returns their
 * identifiers; a known identifier is a duplicate (FR-012).
 */
export interface DedupeStore {
  accept(product: string, events: readonly KeteEvent[]): Promise<ReadonlySet<string>>;
}

export interface ReceiveOptions {
  keyRing: KeyRing;
  store: DedupeStore;
  /** The event types a product declares (from its manifest); omit to accept any type. */
  declaredTypes?: (product: string) => readonly string[] | undefined;
  now?: Date;
  toleranceSeconds?: number;
}

export interface ReceiveOutcome {
  /** 200 with per-event results; 401 or 413 when the whole batch is refused. */
  status: 200 | 401 | 413;
  result: DeliveryResult;
}

type RefusalReason = NonNullable<DeliveryResult['results'][number]['reason']>;

function refuseAll(ids: string[], reason: RefusalReason): DeliveryResult {
  return { results: ids.map((id) => ({ id, outcome: 'refused' as const, reason })) };
}

function idsOf(body: unknown): string[] {
  const events = (body as { events?: unknown } | null)?.events;
  if (!Array.isArray(events)) return [];
  return events
    .map((e) => (e as { id?: unknown } | null)?.id)
    .filter((id): id is string => typeof id === 'string');
}

/**
 * Verifies and processes a delivery: product, signature and freshness first, then each event on
 * its own, each accepted at most once. Stable reason codes (FR-013).
 */
export async function receiveDelivery(
  request: { headers: Headers; body: string },
  options: ReceiveOptions,
): Promise<ReceiveOutcome> {
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(request.body);
  } catch {
    parsed = null;
  }
  const ids = idsOf(parsed);
  if (Buffer.byteLength(request.body) > MAX_BATCH_BYTES) {
    return { status: 413, result: refuseAll(ids, 'batch_too_large') };
  }
  const product = request.headers.get(PRODUCT_HEADER);
  const check = verify(
    { product, signature: request.headers.get(SIGNATURE_HEADER), body: request.body },
    options.keyRing,
    {
      ...(options.now ? { now: options.now } : {}),
      ...(options.toleranceSeconds ? { toleranceSeconds: options.toleranceSeconds } : {}),
    },
  );
  if (!check.ok) return { status: 401, result: refuseAll(ids, check.reason) };
  if (!product) return { status: 401, result: refuseAll(ids, 'unknown_product') };

  const rawEvents = Array.isArray((parsed as { events?: unknown } | null)?.events)
    ? (parsed as { events: unknown[] }).events
    : [];
  const declared = options.declaredTypes?.(product);
  const results: DeliveryResult['results'] = [];
  const valid: KeteEvent[] = [];

  for (const raw of rawEvents) {
    const id = (raw as { id?: unknown } | null)?.id;
    const eventId = typeof id === 'string' ? id : '';
    if (!validateEvent(raw).ok || (raw as KeteEvent).product !== product) {
      results.push({ id: eventId, outcome: 'refused', reason: 'invalid_payload' });
      continue;
    }
    const event = raw as KeteEvent;
    if (declared && !declared.includes(event.type)) {
      results.push({ id: event.id, outcome: 'refused', reason: 'undeclared_type' });
      continue;
    }
    valid.push(event);
  }
  if (rawEvents.length === 0 || (!validateDeliveryRequest(parsed).ok && valid.length === 0)) {
    return { status: 200, result: { results } };
  }

  const accepted = await options.store.accept(product, valid);
  for (const event of valid) {
    results.push({ id: event.id, outcome: accepted.has(event.id) ? 'accepted' : 'duplicate' });
  }
  return { status: 200, result: { results } };
}

/** Wraps `receiveDelivery` as a Web `Request` handler (TanStack Start, Node, any Fetch server). */
export function deliveryHandler(options: ReceiveOptions): (request: Request) => Promise<Response> {
  return async (request) => {
    const outcome = await receiveDelivery(
      { headers: request.headers, body: await request.text() },
      options,
    );
    return Response.json(outcome.result, { status: outcome.status });
  };
}

/** An in-memory store, for tests and examples. */
export function memoryDedupeStore(): DedupeStore & { events: Map<string, KeteEvent> } {
  const events = new Map<string, KeteEvent>();
  return {
    events,
    accept(_product, batch) {
      const fresh = new Set<string>();
      for (const event of batch) {
        if (!events.has(event.id)) {
          events.set(event.id, event);
          fresh.add(event.id);
        }
      }
      return Promise.resolve(fresh);
    },
  };
}

/** The receiver-side table. Create it once in the receiver's database. */
export const receivedEventsMigrationSql = `
create table kete_received_events (
  event_id text primary key,
  product text not null,
  envelope jsonb not null,
  received_at timestamptz not null default now()
);
`;

/** A Postgres store: the unique event identifier makes processing exactly-once. */
export function postgresDedupeStore(db: SqlExecutor): DedupeStore {
  return {
    async accept(product, batch) {
      if (batch.length === 0) return new Set();
      const { rows } = await db.query<{ event_id: string }>(
        `insert into kete_received_events (event_id, product, envelope)
         select e->>'id', $1, e from jsonb_array_elements($2::jsonb) as e
         on conflict (event_id) do nothing
         returning event_id`,
        [product, JSON.stringify(batch)],
      );
      return new Set(rows.map((r) => r.event_id));
    },
  };
}
