-- The journal keeps the chain of agents behind a gesture (commandsDelegationMigrationSql, doctrine
-- D-039): the agents that asked, and the trace of a delegated task. Additive; the table's RLS policy
-- and its append-only grants are unchanged.
alter table public.kete_commands
  add column if not exists delegated_by jsonb
    check (delegated_by is null or jsonb_typeof(delegated_by) = 'array'),
  add column if not exists trace_id text;
create index if not exists kete_commands_trace on public.kete_commands (organization_id, trace_id)
  where trace_id is not null;
