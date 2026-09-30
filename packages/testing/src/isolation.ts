import type pg from 'pg';

export interface IsolationCheck {
  /** Connected as the application role. */
  app: pg.Pool;
  /** The table holding organization data. */
  table: string;
  /** The column holding the organization (default `organization_id`). */
  column?: string;
  /** Two organizations. */
  organizations: readonly [string, string];
  /** Inserts one row belonging to `organization`, with the client given (inside a transaction). */
  insert(client: pg.PoolClient, organization: string): Promise<void>;
}

export class IsolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IsolationError';
  }
}

const identifier = /^[a-z_][a-z0-9_]*$/;

async function asOrganization<T>(
  app: pg.Pool,
  organization: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await app.connect();
  try {
    await client.query('begin');
    // The same setting as @kete/tenancy's inOrganization; this kit depends on no other package.
    await client.query(`select set_config('kete.organization_id', $1, true)`, [organization]);
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

/**
 * Proves, on the real database, that two organizations never see nor write each other's rows:
 * each sees only its own row, sees nothing without an active organization, and cannot write a row
 * for the other. Throws an `IsolationError` saying what leaked.
 */
export async function assertOrganizationIsolation(check: IsolationCheck): Promise<void> {
  const column = check.column ?? 'organization_id';
  if (!identifier.test(check.table) || !identifier.test(column)) {
    throw new TypeError('Invalid table or column name.');
  }
  const [a, b] = check.organizations;
  for (const organization of check.organizations) {
    await asOrganization(check.app, organization, (client) => check.insert(client, organization));
  }
  for (const organization of check.organizations) {
    const seen = await asOrganization(check.app, organization, async (client) => {
      const { rows } = await client.query<{ owner: string }>(
        `select ${column} as owner from ${check.table}`,
      );
      return rows.map((row) => row.owner);
    });
    if (!seen.includes(organization)) {
      throw new IsolationError(`${organization} does not see its own row in ${check.table}.`);
    }
    const foreign = seen.filter((owner) => owner !== organization);
    if (foreign.length > 0) {
      throw new IsolationError(`${organization} sees rows of ${foreign[0]} in ${check.table}.`);
    }
  }
  const { rows: unscoped } = await check.app.query(`select 1 from ${check.table}`);
  if (unscoped.length > 0) {
    throw new IsolationError(`${check.table} shows rows without an active organization.`);
  }
  const crossWrite = await asOrganization(check.app, a, (client) => check.insert(client, b)).then(
    () => true,
    () => false,
  );
  if (crossWrite) {
    throw new IsolationError(`${a} could write a row of ${b} into ${check.table}.`);
  }
}
