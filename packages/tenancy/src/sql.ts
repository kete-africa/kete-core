import { ACTIVE_ORGANIZATION_SQL } from './setting.js';

const identifier = /^[a-z_][a-z0-9_]*$/;

function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

export interface OrganizationPolicyOptions {
  table: string;
  /** Default `public`. */
  schema?: string;
  /** The application role the policy applies to; it must not bypass RLS. */
  appRole: string;
  /** The column holding the organization (default `organization_id`). */
  column?: string;
  /** The policy name (default `<table>_isolation`). */
  policy?: string;
}

/**
 * The SQL that isolates a table per organization, to write in the migration that creates the table
 * (constitution V): row-level security on, and one policy reading and writing only the active
 * organization's rows.
 */
export function organizationPolicySql(options: OrganizationPolicyOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const table = checkIdentifier(options.table);
  const role = checkIdentifier(options.appRole);
  const column = checkIdentifier(options.column ?? 'organization_id');
  const policy = checkIdentifier(options.policy ?? `${table}_isolation`);
  const condition = `${column} = ${ACTIVE_ORGANIZATION_SQL}`;
  return [
    `alter table ${schema}.${table} enable row level security;`,
    `create policy ${policy} on ${schema}.${table} as permissive for all to ${role}`,
    `  using (${condition})`,
    `  with check (${condition});`,
  ].join('\n');
}
