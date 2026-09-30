import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';

/**
 * The instance's Drizzle database over Postgres, through its application role. Its schema includes
 * `@kete/identity/schema`; the instance may add its own tables.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- any schema that includes ours
export type IdentityDatabase = PgDatabase<PgQueryResultHKT, any>;
