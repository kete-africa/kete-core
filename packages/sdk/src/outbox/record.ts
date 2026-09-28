import type { KeteEvent } from '../contracts/types.gen.js';
import type { SqlExecutor } from './sql.js';

/**
 * Writes an event into the outbox, inside the caller's transaction: the business change and its
 * event commit or roll back together (FR-006). The active organization must be set on that
 * transaction (`setOrganization`), and must match the event's organization.
 */
export async function recordEvent(db: SqlExecutor, event: KeteEvent): Promise<void> {
  await db.query(
    'insert into kete_outbox (event_id, organization_id, envelope) values ($1, $2, $3)',
    [event.id, event.organization, JSON.stringify(event)],
  );
}
