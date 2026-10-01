import type { SqlExecutor } from '@kete/sdk';

/** What the connected role can do regardless of row-level security. */
export interface RoleIsolation {
  role: string;
  superuser: boolean;
  bypassesRls: boolean;
}

export class RlsBypassError extends Error {
  constructor(readonly isolation: RoleIsolation) {
    super(
      `The role "${isolation.role}" ${isolation.superuser ? 'is a superuser' : 'has BYPASSRLS'}: ` +
        'row-level security would not isolate organizations. Connect the service with its ' +
        'application role (created in SQL, without BYPASSRLS).',
    );
    this.name = 'RlsBypassError';
  }
}

/** Reads whether the connected role escapes row-level security. */
export async function checkRoleIsolation(db: SqlExecutor): Promise<RoleIsolation> {
  const { rows } = await db.query<{ role: string; superuser: boolean; bypass: boolean }>(
    `select rolname as role, rolsuper as superuser, rolbypassrls as bypass
       from pg_roles where rolname = current_user`,
  );
  const row = rows[0];
  if (!row) throw new Error('The connected role was not found in pg_roles.');
  return { role: row.role, superuser: row.superuser, bypassesRls: row.bypass };
}

/**
 * Throws if the connected role escapes row-level security. A service calls it at start-up with its
 * application connection, so a misconfigured role never serves a request.
 */
export async function assertRoleIsolated(db: SqlExecutor): Promise<void> {
  const isolation = await checkRoleIsolation(db);
  if (isolation.superuser || isolation.bypassesRls) throw new RlsBypassError(isolation);
}

export interface RlsAuditOptions {
  /** Default `public`. */
  schema?: string;
  /** The column that marks organization data (default `organization_id`). */
  column?: string;
  /** Tables that carry the column but are global by decision (for example, identity tables). */
  exempt?: readonly string[];
}

export interface RlsViolation {
  table: string;
  problem: 'row level security disabled' | 'no policy';
}

/**
 * Lists every table holding organization data without its isolation: row-level security off, or
 * no policy. A test runs it on the migrated database, so a table never ships without its policy.
 */
export async function auditRls(
  db: SqlExecutor,
  options: RlsAuditOptions = {},
): Promise<RlsViolation[]> {
  const { rows } = await db.query<{ name: string; enabled: boolean; policies: string }>(
    `select c.relname as name, c.relrowsecurity as enabled,
            (select count(*) from pg_policies p
              where p.schemaname = n.nspname and p.tablename = c.relname)::text as policies
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = $1 and c.relkind in ('r', 'p')
        and exists (select 1 from pg_attribute a
                     where a.attrelid = c.oid and a.attname = $2 and not a.attisdropped)
      order by c.relname`,
    [options.schema ?? 'public', options.column ?? 'organization_id'],
  );
  const exempt = new Set(options.exempt ?? []);
  const violations: RlsViolation[] = [];
  for (const row of rows) {
    if (exempt.has(row.name)) continue;
    if (!row.enabled) violations.push({ table: row.name, problem: 'row level security disabled' });
    else if (Number(row.policies) === 0) violations.push({ table: row.name, problem: 'no policy' });
  }
  return violations;
}
