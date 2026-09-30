import { ACTIVE_ORGANIZATION_SQL } from '@kete/tenancy';

export interface CommandsMigrationOptions {
  /** Default `public`. */
  schema?: string;
  /** The application role: it may add to the journal and read it, never change it. */
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;

function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

/**
 * The SQL creating the command journal, with its RLS policy in the same migration (constitution V).
 * The application role may only insert and read: the journal is append-only, enforced by the
 * database itself, not by the code.
 */
export function commandsMigrationSql(options: CommandsMigrationOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const t = `${schema}.kete_commands`;
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  return `
create table ${t} (
  command_id text primary key,
  organization_id text not null,
  name text not null,
  idempotency_key text not null,
  input_hash text not null,
  input jsonb,
  output jsonb,
  summary text,
  reason text,
  actor_kind text not null check (actor_kind in ('person', 'agent', 'service', 'app')),
  actor_id text not null,
  on_behalf_of_kind text check (on_behalf_of_kind in ('person', 'agent', 'service', 'app')),
  on_behalf_of_id text,
  channel text not null,
  reversible boolean not null,
  inverse text,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);
create index kete_commands_recent on ${t} (organization_id, created_at desc);

alter table ${t} enable row level security;
create policy kete_commands_isolation on ${t} as permissive for all to ${app}
  using (${organization})
  with check (${organization});
grant usage on schema ${schema} to ${app};
revoke all on ${t} from ${app};
grant select, insert on ${t} to ${app};
`;
}
