import { ACTIVE_ORGANIZATION_SQL } from '@kete/tenancy';

export interface WorkMigrationOptions {
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
 * The SQL creating the holdings and their events, with their RLS policies in the same migration
 * (constitution V). A holding always has a holder: the database refuses one without. Its events
 * are append-only: the application role may insert and read them, never change or delete them.
 * Nothing is ever deleted.
 */
export function workMigrationSql(options: WorkMigrationOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const holdings = `${schema}.kete_holdings`;
  const events = `${schema}.kete_holding_events`;
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  return `
create table ${holdings} (
  holding_id text primary key,
  organization_id text not null,
  source_app text not null,
  source_kind text not null,
  source_ref text not null,
  object_kind text not null,
  object_id text not null,
  what text not null,
  holder_kind text not null check (holder_kind in ('person', 'agent')),
  holder_id text not null check (length(holder_id) > 0),
  waiting_on_kind text check (waiting_on_kind in ('person', 'agent', 'party')),
  waiting_on_id text,
  waiting_since timestamptz,
  since timestamptz not null default now(),
  due date,
  state text not null check (state in ('held', 'waiting', 'done')),
  purpose text not null default 'action' check (purpose in ('action', 'information')),
  taken_over_from_kind text check (taken_over_from_kind in ('person', 'agent')),
  taken_over_from_id text,
  last_nudged_at timestamptz,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, source_app, source_kind, source_ref),
  check ((waiting_on_kind is null) = (waiting_on_id is null)),
  check (state <> 'waiting' or waiting_on_kind is not null),
  check ((state = 'done') = (done_at is not null))
);
create index kete_holdings_by_holder on ${holdings} (organization_id, holder_kind, holder_id, state);
create index kete_holdings_by_waiting_on on ${holdings} (organization_id, waiting_on_kind, waiting_on_id)
  where state = 'waiting';

alter table ${holdings} enable row level security;
create policy kete_holdings_isolation on ${holdings} as permissive for all to ${app}
  using (${organization})
  with check (${organization});

create table ${events} (
  event_id text primary key,
  organization_id text not null,
  holding_id text not null references ${holdings} (holding_id),
  type text not null check (type in ('holding.created', 'holding.waiting', 'holding.nudged',
    'holding.taken_over', 'holding.handed_back', 'holding.done')),
  data jsonb not null default '{}',
  at timestamptz not null default now()
);
create index kete_holding_events_by_holding on ${events} (organization_id, holding_id, at);

alter table ${events} enable row level security;
create policy kete_holding_events_isolation on ${events} as permissive for all to ${app}
  using (${organization})
  with check (${organization});

grant usage on schema ${schema} to ${app};
revoke all on ${holdings} from ${app};
grant select, insert, update on ${holdings} to ${app};
revoke all on ${events} from ${app};
grant select, insert on ${events} to ${app};
`;
}

/**
 * Holdings with a priority, a snooze, and another holding waited on (spec 139). Run after
 * `workLinksMigrationSql`.
 */
export function workPrioritiesMigrationSql(
  options: Pick<WorkMigrationOptions, 'schema'> = {},
): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const holdings = `${schema}.kete_holdings`;
  const events = `${schema}.kete_holding_events`;
  return `
alter table ${holdings}
  add column priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  add column snoozed_until timestamptz,
  drop constraint kete_holdings_waiting_on_kind_check,
  add constraint kete_holdings_waiting_on_kind_check
    check (waiting_on_kind in ('person', 'agent', 'party', 'holding'));
create index kete_holdings_by_waited_holding on ${holdings} (organization_id, waiting_on_id)
  where state = 'waiting' and waiting_on_kind = 'holding';
alter table ${events}
  drop constraint kete_holding_events_type_check,
  add constraint kete_holding_events_type_check check (type in ('holding.created',
    'holding.waiting', 'holding.nudged', 'holding.taken_over', 'holding.handed_back',
    'holding.prioritized', 'holding.snoozed', 'holding.resumed', 'holding.done'));
`;
}

/**
 * Where a holding opens (spec 114): the address its app gives it, read by « Pour moi ». Run after
 * `workMigrationSql`.
 */
export function workLinksMigrationSql(options: Pick<WorkMigrationOptions, 'schema'> = {}): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  return `
alter table ${schema}.kete_holdings
  add column href text check (href is null or length(href) between 1 and 500);
`;
}
