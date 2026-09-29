import {
  createEvent,
  createOutboxRelay,
  httpTransport,
  recordEvent,
  type KeteEvent,
  type SqlExecutor,
  type EventData,
} from '@kete/sdk';
import { sql, type SQL } from 'drizzle-orm';
import { getPool } from './db';

/** The Compte Kete's product identifier, as its manifest says. */
export const PRODUCT = 'prd_kete_account';

/** The events the Compte Kete announces (its manifest declares exactly these). */
export const DECLARED_EVENTS = ['account.created', 'payment.succeeded'] as const;
type Declared = (typeof DECLARED_EVENTS)[number];

export function accountEvent<T extends Declared>(
  type: T,
  organization: string,
  data: EventData<T>,
): KeteEvent {
  return createEvent({
    type,
    product: PRODUCT,
    organization,
    data,
    declaredTypes: DECLARED_EVENTS,
  });
}

/** A Drizzle transaction as the SDK's `SqlExecutor`: `$1…` placeholders become bound values. */
export function sqlExecutor(tx: {
  execute: (query: SQL) => Promise<{ rows: unknown[] }>;
}): SqlExecutor {
  return {
    async query(text, params = []) {
      const parts = text.split(/\$(\d+)/);
      const chunks: SQL[] = [];
      parts.forEach((part, index) => {
        if (index % 2 === 0) chunks.push(sql.raw(part));
        else chunks.push(sql`${params[Number(part) - 1]}`);
      });
      const result = await tx.execute(sql.join(chunks));
      return { rows: result.rows as never[] };
    },
  };
}

/**
 * Writes the event in the caller's transaction (organization set on it): the change and its event
 * commit or roll back together.
 */
export function record(
  tx: { execute: (query: SQL) => Promise<{ rows: unknown[] }> },
  event: KeteEvent,
): Promise<void> {
  return recordEvent(sqlExecutor(tx), event);
}

let started = false;

/**
 * Delivers the outbox to Kete Cockpit (`KETE_EVENTS_URL`), signed with the key the Cockpit handed
 * out (`KETE_EVENTS_KID`, `KETE_EVENTS_SECRET`). Nothing is sent while those are unset: events wait
 * in the outbox.
 */
export function startRelay(): void {
  const url = process.env.KETE_EVENTS_URL;
  const kid = process.env.KETE_EVENTS_KID;
  const secret = process.env.KETE_EVENTS_SECRET;
  if (started || !url || !kid || !secret) return;
  started = true;
  const relay = createOutboxRelay({
    pool: getPool(),
    transport: httpTransport({ url }),
    product: PRODUCT,
    key: { kid, secret },
  });
  relay.start(Number(process.env.KETE_EVENTS_INTERVAL_MS ?? 10_000), (error) =>
    console.warn(`[events] relay: ${error instanceof Error ? error.message : 'failed'}`),
  );
}
