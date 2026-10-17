import { newId } from '@kete/records';
import { ACTIVE_ORGANIZATION_SQL, type SqlExecutor } from '@kete/tenancy';
import type { SettingsRegistry } from './declare.js';

// The layers a product keeps itself (spec 115, FR-004): the app's, and each legal entity's or
// unit's, with their RLS policy in the same migration and an append-only journal of every change.
// The organization's and the person's layers live in the Compte Kete.

export interface SettingsMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

export function settingsMigrationSql(options: SettingsMigrationOptions): string {
  const s = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  return `
create table ${s}.kete_settings (
  organization_id text not null,
  layer text not null check (layer in ('app', 'entity')),
  scope_id text not null check (length(scope_id) between 1 and 100),
  key text not null check (length(key) between 3 and 120),
  value jsonb not null,
  set_by text not null,
  set_at timestamptz not null default now(),
  primary key (organization_id, layer, scope_id, key)
);
alter table ${s}.kete_settings enable row level security;
create policy kete_settings_isolation on ${s}.kete_settings as permissive for all to ${app}
  using (${organization}) with check (${organization});

create table ${s}.kete_setting_events (
  event_id text primary key,
  organization_id text not null,
  layer text not null,
  scope_id text not null,
  key text not null,
  before jsonb,
  after jsonb,
  by text not null,
  at timestamptz not null default now()
);
create index kete_setting_events_by_key on ${s}.kete_setting_events (organization_id, key, at);
alter table ${s}.kete_setting_events enable row level security;
create policy kete_setting_events_isolation on ${s}.kete_setting_events as permissive for all
  to ${app} using (${organization}) with check (${organization});

grant usage on schema ${s} to ${app};
revoke all on ${s}.kete_settings from ${app};
grant select, insert, update, delete on ${s}.kete_settings to ${app};
revoke all on ${s}.kete_setting_events from ${app};
grant select, insert on ${s}.kete_setting_events to ${app};
`;
}

export type StoredLayer = 'app' | 'entity';

/** The app's own scope: one per product. */
export const APP_SCOPE = 'app';

async function current(
  db: SqlExecutor,
  where: { layer: StoredLayer; scopeId: string; key: string },
): Promise<unknown> {
  const { rows } = await db.query<{ value: unknown }>(
    `select value from kete_settings where layer = $1 and scope_id = $2 and key = $3 for update`,
    [where.layer, where.scopeId, where.key],
  );
  return rows[0] ? rows[0].value : undefined;
}

async function journal(
  db: SqlExecutor,
  organizationId: string,
  change: {
    layer: StoredLayer;
    scopeId: string;
    key: string;
    before: unknown;
    after: unknown;
    by: string;
  },
  at: Date,
): Promise<void> {
  await db.query(
    `insert into kete_setting_events (event_id, organization_id, layer, scope_id, key, before,
       after, by, at) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      newId('sev'),
      organizationId,
      change.layer,
      change.scopeId,
      change.key,
      change.before === undefined ? null : JSON.stringify(change.before),
      change.after === undefined ? null : JSON.stringify(change.after),
      change.by,
      at,
    ],
  );
}

/**
 * Sets a value on the app's layer or an entity's, checked against its declaration and the layer;
 * the change is journaled with what it was before. The caller checks the permission.
 */
export async function setSetting(
  db: SqlExecutor,
  organizationId: string,
  registry: SettingsRegistry,
  input: { layer: StoredLayer; scopeId?: string; key: string; value: unknown; by: string },
  now = new Date(),
): Promise<unknown> {
  const value = registry.check(input.key, input.layer, input.value);
  const scopeId = input.scopeId ?? APP_SCOPE;
  const before = await current(db, { layer: input.layer, scopeId, key: input.key });
  await db.query(
    `insert into kete_settings (organization_id, layer, scope_id, key, value, set_by, set_at)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (organization_id, layer, scope_id, key)
       do update set value = excluded.value, set_by = excluded.set_by, set_at = excluded.set_at`,
    [organizationId, input.layer, scopeId, input.key, JSON.stringify(value), input.by, now],
  );
  await journal(
    db,
    organizationId,
    { layer: input.layer, scopeId, key: input.key, before, after: value, by: input.by },
    now,
  );
  return value;
}

/** Takes a value back to what it inherits; journaled. False when nothing was set. */
export async function clearSetting(
  db: SqlExecutor,
  organizationId: string,
  input: { layer: StoredLayer; scopeId?: string; key: string; by: string },
  now = new Date(),
): Promise<boolean> {
  const scopeId = input.scopeId ?? APP_SCOPE;
  const before = await current(db, { layer: input.layer, scopeId, key: input.key });
  if (before === undefined) return false;
  await db.query(`delete from kete_settings where layer = $1 and scope_id = $2 and key = $3`, [
    input.layer,
    scopeId,
    input.key,
  ]);
  await journal(
    db,
    organizationId,
    { layer: input.layer, scopeId, key: input.key, before, after: undefined, by: input.by },
    now,
  );
  return true;
}

/**
 * The layers kept here, for the active organization: the app's, and the entities' from the
 * broadest to the most precise — the last one given wins among them.
 */
export async function readLayers(
  db: SqlExecutor,
  query: { entityIds?: readonly string[] } = {},
): Promise<{ app: Record<string, unknown>; entity: Record<string, unknown> }> {
  const entityIds = [...(query.entityIds ?? [])];
  const { rows } = await db.query<{
    layer: StoredLayer;
    scope_id: string;
    key: string;
    value: unknown;
  }>(
    `select layer, scope_id, key, value from kete_settings
      where (layer = 'app' and scope_id = $1) or (layer = 'entity' and scope_id = any($2))`,
    [APP_SCOPE, entityIds],
  );
  const app: Record<string, unknown> = {};
  const entity: Record<string, unknown> = {};
  for (const r of rows.filter((r) => r.layer === 'app')) app[r.key] = r.value;
  for (const id of entityIds) {
    for (const r of rows) if (r.layer === 'entity' && r.scope_id === id) entity[r.key] = r.value;
  }
  return { app, entity };
}

/** The journal of a setting's changes, the newest first. */
export async function settingHistory(
  db: SqlExecutor,
  key: string,
  limit = 50,
): Promise<
  { layer: string; scopeId: string; before: unknown; after: unknown; by: string; at: Date }[]
> {
  const { rows } = await db.query<{
    layer: string;
    scope_id: string;
    before: unknown;
    after: unknown;
    by: string;
    at: Date;
  }>(
    `select layer, scope_id, before, after, by, at from kete_setting_events
      where key = $1 order by at desc, event_id desc limit $2`,
    [key, Math.min(Math.max(limit, 1), 500)],
  );
  return rows.map((r) => ({
    layer: r.layer,
    scopeId: r.scope_id,
    before: r.before,
    after: r.after,
    by: r.by,
    at: new Date(r.at),
  }));
}
