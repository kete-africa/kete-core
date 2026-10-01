-- The @kete/commands journal (commandsMigrationSql): every named gesture, who made it, on behalf of
-- whom, through which channel, why, and whether it can be undone. Append-only: the application role
-- may insert and read, never change. Created with its RLS policy (constitution V).
create table public.kete_commands (
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
create index kete_commands_recent on public.kete_commands (organization_id, created_at desc);

alter table public.kete_commands enable row level security;
create policy kete_commands_isolation on public.kete_commands as permissive for all to account_app
  using (organization_id = current_setting('kete.organization_id', true))
  with check (organization_id = current_setting('kete.organization_id', true));
grant usage on schema public to account_app;
revoke all on public.kete_commands from account_app;
grant select, insert on public.kete_commands to account_app;
