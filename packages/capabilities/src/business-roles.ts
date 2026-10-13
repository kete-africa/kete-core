import { organizationPolicySql, type SqlExecutor } from '@kete/tenancy';
import type { PermissionDefinition } from './permissions.js';

// Business roles (spec 093): an app sold alone, without Kete Enterprise, has the roles of its own
// trade — a cashier, a washer, a driver. Each permission names the business roles that hold it by
// default; the owner ticks or unticks what each role may do; a person holds what her role holds.
// The owners and administrators of the Compte Kete organization hold their own defaults; a member
// without a business role holds nothing. Once a center manages the app's rights, its grants win.

export interface BusinessRolesMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
const checked = (name: string) => {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
};

/** Who holds which business role, and what the owner decided for each role; with their RLS. */
export function businessRolesMigrationSql(options: BusinessRolesMigrationOptions): string {
  const s = checked(options.schema ?? 'public');
  const app = checked(options.appRole);
  const policy = (table: string) => organizationPolicySql({ schema: s, table, appRole: app });
  return `
create table ${s}.kete_business_roles (
  organization_id text not null,
  user_id text not null check (length(user_id) between 1 and 128),
  role text not null check (role ~ '^[a-z][a-z0-9_]{0,30}$'),
  assigned_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
${policy('kete_business_roles')}
grant select, insert, update, delete on ${s}.kete_business_roles to ${app};

-- What the owner ticked (true) or unticked (false) for a role; what he never touched keeps its
-- default, so a permission an app adds later arrives with it.
create table ${s}.kete_business_role_permissions (
  organization_id text not null,
  role text not null check (role ~ '^[a-z][a-z0-9_]{0,30}$'),
  permission text not null check (permission ~ '^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$'),
  granted boolean not null,
  decided_at timestamptz not null default now(),
  primary key (organization_id, role, permission)
);
${policy('kete_business_role_permissions')}
grant select, insert, update, delete on ${s}.kete_business_role_permissions to ${app};
`;
}

/** What each role holds before the owner changes anything; `owner` holds everything, always. */
export function businessDefaults(
  permissions: readonly PermissionDefinition[],
  roles: readonly string[],
): Map<string, Set<string>> {
  const all = permissions.map((p) => p.name);
  return new Map(
    roles.map((role) => [
      role,
      new Set(
        role === 'owner'
          ? all
          : permissions.filter((p) => p.businessRoles?.includes(role)).map((p) => p.name),
      ),
    ]),
  );
}

/**
 * What a person with `role` holds: its defaults, changed by what the owner decided. Only what the
 * app declares; nothing without a role; the `owner` role cannot be locked out.
 */
export function permissionsOfBusinessRole(
  role: string | null,
  permissions: readonly PermissionDefinition[],
  decided: ReadonlyMap<string, ReadonlyMap<string, boolean>>,
): Set<string> {
  if (!role) return new Set();
  const all = permissions.map((p) => p.name);
  if (role === 'owner') return new Set(all);
  const defaults = new Set(
    permissions.filter((p) => p.businessRoles?.includes(role)).map((p) => p.name),
  );
  const mine = decided.get(role);
  return new Set(all.filter((name) => mine?.get(name) ?? defaults.has(name)));
}

/** A person's business role in the organization of the transaction, or null. */
export async function businessRoleOf(db: SqlExecutor, userId: string): Promise<string | null> {
  const { rows } = await db.query<{ role: string }>(
    `select role from kete_business_roles where user_id = $1`,
    [userId],
  );
  return rows[0]?.role ?? null;
}

/** Gives a person a business role, or takes it away (null). */
export async function assignBusinessRole(
  db: SqlExecutor,
  organizationId: string,
  userId: string,
  role: string | null,
): Promise<void> {
  if (role === null) {
    await db.query(`delete from kete_business_roles where user_id = $1`, [userId]);
    return;
  }
  await db.query(
    `insert into kete_business_roles (organization_id, user_id, role) values ($1, $2, $3)
     on conflict (organization_id, user_id) do update set role = excluded.role, assigned_at = now()`,
    [organizationId, userId, role],
  );
}

/** What the owner decided for each role of the organization of the transaction. */
export async function businessRoleDecisions(
  db: SqlExecutor,
): Promise<Map<string, Map<string, boolean>>> {
  const { rows } = await db.query<{ role: string; permission: string; granted: boolean }>(
    `select role, permission, granted from kete_business_role_permissions`,
  );
  const decided = new Map<string, Map<string, boolean>>();
  for (const row of rows) {
    const role = decided.get(row.role) ?? new Map<string, boolean>();
    role.set(row.permission, row.granted);
    decided.set(row.role, role);
  }
  return decided;
}

/** The owner ticks (true) or unticks (false) a permission for a role; `owner` is not decided. */
export async function decideBusinessPermission(
  db: SqlExecutor,
  organizationId: string,
  decision: { role: string; permission: string; granted: boolean },
): Promise<void> {
  if (decision.role === 'owner') throw new Error('The owner role holds everything, always.');
  await db.query(
    `insert into kete_business_role_permissions (organization_id, role, permission, granted)
     values ($1, $2, $3, $4)
     on conflict (organization_id, role, permission)
       do update set granted = excluded.granted, decided_at = now()`,
    [organizationId, decision.role, decision.permission, decision.granted],
  );
}
