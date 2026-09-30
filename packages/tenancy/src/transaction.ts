import { setOrganization, type SqlExecutor } from '@kete/sdk';
import { checkOrganizationId } from './setting.js';

/** A client that can run a transaction: a `pg` pool client, or any driver with a small adapter. */
export interface TransactionClient extends SqlExecutor {
  release(): void;
}

/** A pool handing out clients: a `pg.Pool` fits it as is. */
export interface ClientPool {
  connect(): Promise<TransactionClient>;
}

/**
 * Runs `fn` in a transaction where every RLS policy sees only `organizationId`. The setting is
 * local to the transaction: it resets at commit or rollback, so a pooled connection never carries
 * one organization into the next request.
 */
export async function inOrganization<T>(
  pool: ClientPool,
  organizationId: string,
  fn: (client: TransactionClient) => Promise<T>,
): Promise<T> {
  checkOrganizationId(organizationId);
  const client = await pool.connect();
  try {
    await client.query('begin');
    await setOrganization(client, organizationId);
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
