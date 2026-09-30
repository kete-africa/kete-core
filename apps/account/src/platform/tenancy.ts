import { inOrganizationTx } from '@kete/tenancy/drizzle';
import { db, type Database } from './db';

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Runs `fn` in a transaction where every RLS policy sees only `organizationId`
 * (constitution V, `@kete/tenancy`). The setting resets at commit or rollback.
 */
export function inOrganization<T>(
  organizationId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return inOrganizationTx<Transaction, T>(db, organizationId, fn);
}
