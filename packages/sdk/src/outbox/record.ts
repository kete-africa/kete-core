import type { KeteEvent } from '../contracts/types.gen.js';
import type { SqlExecutor } from './sql.js';

/**
 * Writes an event into the outbox (`kete_outbox` by default, or a named one: spec 049), inside the caller's transaction: the business change and its
 * event commit or roll back together (FR-006). The active organization must be set on that
 * transaction (`setOrganization`), and must match the event's organization.
 */
export async function recordEvent(
  db: SqlExecutor,
  event: KeteEvent,
  options: { outbox?: string } = {},
): Promise<void> {
  const outbox = options.outbox ?? 'kete_outbox';
  if (!/^[a-z_][a-z0-9_]*$/.test(outbox)) throw new Error(`Invalid outbox: ${outbox}`);
  await db.query(
    `insert into ${outbox} (event_id, organization_id, envelope) values ($1, $2, $3)`,
    [event.id, event.organization, JSON.stringify(event)],
  );
}
