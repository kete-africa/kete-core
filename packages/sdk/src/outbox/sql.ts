/**
 * The smallest database surface the SDK needs. A `pg` client, pool or transaction client fits it
 * as is; other drivers need a one-line adapter.
 */
export interface SqlExecutor {
  query<R extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: readonly unknown[],
  ): Promise<{ rows: R[] }>;
}

/**
 * Sets the active organization for the current transaction. Every RLS policy of a Kete app reads
 * `kete.organization_id`; it resets automatically at commit or rollback.
 */
export async function setOrganization(db: SqlExecutor, organization: string): Promise<void> {
  await db.query(`select set_config('kete.organization_id', $1, true)`, [organization]);
}
