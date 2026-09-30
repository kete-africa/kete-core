import { ACTIVE_ORGANIZATION_SQL } from '@kete/tenancy';

export interface DraftsMigrationOptions {
  /** Default `public`. */
  schema?: string;
  /** The application role. */
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;

function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

/**
 * The SQL creating the drafts table, with its RLS policies in the same migration (constitution V).
 * A decided draft (validated or refused) is frozen by the database: a restrictive policy lets the
 * application role update only drafts still waiting for a decision. Nothing is ever deleted.
 */
export function draftsMigrationSql(options: DraftsMigrationOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const t = `${schema}.kete_drafts`;
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  const actorKind = `in ('person', 'agent', 'service', 'app')`;
  return `
create table ${t} (
  draft_id text primary key,
  organization_id text not null,
  kind text not null check (kind in ('record', 'change')),
  record_type text not null,
  record_id text,
  base_version text,
  prepared jsonb not null,
  proposed jsonb not null,
  provenance jsonb not null default '{}',
  status text not null default 'prepared' check (status in ('prepared', 'validated', 'refused')),
  prepared_by_kind text not null check (prepared_by_kind ${actorKind}),
  prepared_by_id text not null,
  prepared_channel text not null,
  on_behalf_of_kind text check (on_behalf_of_kind ${actorKind}),
  on_behalf_of_id text,
  decided_by_kind text check (decided_by_kind = 'person'),
  decided_by_id text,
  decided_at timestamptz,
  refusal_reason text,
  corrections jsonb,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (kind = 'record' or record_id is not null),
  check ((status = 'prepared') = (decided_at is null))
);
create index kete_drafts_waiting on ${t} (organization_id, status, created_at desc);

alter table ${t} enable row level security;
create policy kete_drafts_isolation on ${t} as permissive for all to ${app}
  using (${organization})
  with check (${organization});
-- The old row must be waiting; the new one may carry the decision (an UPDATE policy without its own
-- WITH CHECK would apply USING to the new row too, and refuse every decision).
create policy kete_drafts_frozen_once_decided on ${t} as restrictive for update to ${app}
  using (status = 'prepared')
  with check (true);
grant usage on schema ${schema} to ${app};
revoke all on ${t} from ${app};
grant select, insert, update on ${t} to ${app};
`;
}
