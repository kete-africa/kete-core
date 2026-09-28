export interface OutboxMigrationOptions {
  /** Schema holding the outbox (default `public`). */
  schema?: string;
  /** The application role: can insert and read its active organization's rows only. */
  appRole: string;
  /** The migration role owning the table and the relay functions. */
  ownerRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;

function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

/**
 * The SQL creating the outbox, with its RLS policy in the same migration (constitution V).
 * The relay claims and settles rows across organizations only through SECURITY DEFINER functions,
 * so the application role never needs BYPASSRLS.
 */
export function outboxMigrationSql(options: OutboxMigrationOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const owner = checkIdentifier(options.ownerRole);
  const t = `${schema}.kete_outbox`;
  return `
create table ${t} (
  event_id text primary key,
  organization_id text not null,
  envelope jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'delivered', 'refused')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  leased_until timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index kete_outbox_due on ${t} (next_attempt_at) where status = 'pending';

alter table ${t} enable row level security;
alter table ${t} force row level security;
create policy kete_outbox_organization on ${t} to ${app}
  using (organization_id = current_setting('kete.organization_id', true))
  with check (organization_id = current_setting('kete.organization_id', true));
create policy kete_outbox_relay on ${t} to ${owner} using (true) with check (true);
grant usage on schema ${schema} to ${app};
grant select, insert on ${t} to ${app};

create function ${schema}.kete_outbox_claim(batch_size integer, lease_seconds integer)
returns table (event_id text, envelope jsonb, attempts integer)
language sql security definer set search_path = ${schema}, pg_temp as $fn$
  update kete_outbox o
     set leased_until = now() + make_interval(secs => lease_seconds),
         attempts = o.attempts + 1
   where o.event_id in (
     select c.event_id from kete_outbox c
      where c.status = 'pending'
        and c.next_attempt_at <= now()
        and (c.leased_until is null or c.leased_until < now())
      order by c.next_attempt_at
      limit batch_size
      for update skip locked)
  returning o.event_id, o.envelope, o.attempts;
$fn$;

-- results: [{ "event_id", "outcome": "delivered" | "refused" | "retry", "reason", "delay_seconds" }]
create function ${schema}.kete_outbox_settle(results jsonb)
returns void
language sql security definer set search_path = ${schema}, pg_temp as $fn$
  update kete_outbox o
     set status = case r.outcome when 'retry' then 'pending' else r.outcome end,
         settled_at = case when r.outcome in ('delivered', 'refused') then now() end,
         last_error = r.reason,
         next_attempt_at = case when r.outcome = 'retry'
                                then now() + make_interval(secs => coalesce(r.delay_seconds, 5))
                                else o.next_attempt_at end,
         leased_until = null
    from jsonb_to_recordset(results) as r(event_id text, outcome text, reason text, delay_seconds integer)
   where o.event_id = r.event_id and o.status = 'pending';
$fn$;

create function ${schema}.kete_outbox_backlog()
returns table (pending bigint, oldest_pending_age_seconds integer)
language sql security definer set search_path = ${schema}, pg_temp as $fn$
  select count(*), extract(epoch from now() - min(created_at))::integer
    from kete_outbox where status = 'pending';
$fn$;

revoke all on function ${schema}.kete_outbox_claim(integer, integer) from public;
revoke all on function ${schema}.kete_outbox_settle(jsonb) from public;
revoke all on function ${schema}.kete_outbox_backlog() from public;
grant execute on function ${schema}.kete_outbox_claim(integer, integer) to ${app};
grant execute on function ${schema}.kete_outbox_settle(jsonb) to ${app};
grant execute on function ${schema}.kete_outbox_backlog() to ${app};
`;
}
