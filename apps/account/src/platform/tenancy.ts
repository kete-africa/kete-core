import { sql } from 'drizzle-orm';
import { db, type Database } from './db';

/**
 * Runs `fn` in a transaction where every RLS policy sees only `organizationId`
 * (constitution V). The setting resets at commit or rollback.
 */
export function inOrganization<T>(
  organizationId: string,
  fn: (tx: Parameters<Parameters<Database['transaction']>[0]>[0]) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('kete.organization_id', ${organizationId}, true)`);
    return fn(tx);
  });
}
