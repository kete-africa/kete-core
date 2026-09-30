/**
 * Drizzle helpers (`@kete/tenancy/drizzle`), for the services written with Drizzle (doctrine
 * D-016). The main entry point stays free of any driver.
 */
import { sql, type SQL } from 'drizzle-orm';
import { pgPolicy, type PgRole } from 'drizzle-orm/pg-core';
import type { SqlExecutor } from '@kete/sdk';
import { ACTIVE_ORGANIZATION_SQL, checkOrganizationId, ORGANIZATION_SETTING } from './setting.js';

/** The active organization, as a Drizzle SQL fragment. */
export const activeOrganization: SQL = sql.raw(ACTIVE_ORGANIZATION_SQL);

/**
 * The policy isolating a table per organization, declared with the table (constitution V):
 * `pgTable('files', {...}, () => [organizationIsolation('files_isolation', appRole)]).enableRLS()`.
 */
export function organizationIsolation(name: string, appRole: PgRole, column = 'organization_id') {
  // Written as plain text (the name is checked), so the policy reads exactly like a hand-written
  // one and drizzle-kit sees no change in existing migrations.
  if (!/^[a-z_][a-z0-9_]*$/.test(column)) throw new Error(`Invalid column name: ${column}`);
  const condition = sql.raw(`${column} = ${ACTIVE_ORGANIZATION_SQL}`);
  return pgPolicy(name, {
    as: 'permissive',
    for: 'all',
    to: appRole,
    using: condition,
    withCheck: condition,
  });
}

/**
 * A Drizzle database or transaction as the `SqlExecutor` every Kete package takes: `$1…`
 * placeholders become bound values, so a package's SQL runs in the caller's transaction.
 */
export function sqlExecutorOf(db: {
  execute(query: SQL): Promise<{ rows: unknown[] }>;
}): SqlExecutor {
  return {
    async query<R extends Record<string, unknown>>(text: string, params: readonly unknown[] = []) {
      const chunks: SQL[] = text
        .split(/\$(\d+)/)
        .map((part, index) => (index % 2 === 0 ? sql.raw(part) : sql`${params[Number(part) - 1]}`));
      const result = await db.execute(sql.join(chunks));
      return { rows: result.rows as R[] };
    },
  };
}

/** Anything with Drizzle's `transaction`: a database, or a transaction (nested as a savepoint). */
interface Transactional<Tx> {
  transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
}

/** Runs `fn` in a Drizzle transaction where every RLS policy sees only `organizationId`. */
export function inOrganizationTx<Tx extends { execute(query: SQL): Promise<unknown> }, T>(
  db: Transactional<Tx>,
  organizationId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  checkOrganizationId(organizationId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config(${ORGANIZATION_SETTING}, ${organizationId}, true)`);
    return fn(tx);
  });
}
