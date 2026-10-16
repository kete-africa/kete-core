import { ACTIVE_ORGANIZATION_SQL } from '@kete/tenancy';

export interface ChannelsMigrationOptions {
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
 * The SQL creating the router's rules, its journal and the mailboxes' cursors, with their RLS
 * policies in the same migration (constitution V). The journal is append-only: each routing — and
 * each card « à classer » settled — is a new row; a rule learned is never edited, a newer one wins.
 */
export function channelsMigrationSql(options: ChannelsMigrationOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const rules = `${schema}.kete_routing_rules`;
  const routings = `${schema}.kete_routings`;
  const cursors = `${schema}.kete_mailbox_cursors`;
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  const isolate = (table: string, name: string) => `
alter table ${table} enable row level security;
create policy ${name}_isolation on ${table} as permissive for all to ${app}
  using (${organization})
  with check (${organization});`;
  return `
create table ${rules} (
  rule_id text primary key,
  organization_id text not null,
  -- A sender's key (\`mail:abla@kya.tg\`, \`whatsapp:22890…\`) or a mail domain (\`domain:kya.tg\`).
  match text not null check (length(match) between 3 and 300),
  object_kind text not null,
  object_id text not null,
  intent text not null check (intent ~ '^[a-z][a-z0-9_]{0,59}$'),
  learned_from text,
  created_by text not null,
  created_at timestamptz not null default now()
);
create index kete_routing_rules_match on ${rules} (organization_id, match, created_at desc);
${isolate(rules, 'kete_routing_rules')}

create table ${routings} (
  routing_id text primary key,
  organization_id text not null,
  via text not null check (via in ('whatsapp', 'telegram', 'mail', 'form')),
  ref text not null check (length(ref) between 1 and 300),
  received jsonb not null,
  object_kind text,
  object_id text,
  thread_id text,
  holding_id text,
  intent text not null,
  confidence numeric not null check (confidence between 0 and 1),
  by text not null check (by in ('rule', 'model', 'person')),
  asked text,
  at timestamptz not null default now()
);
create index kete_routings_by_ref on ${routings} (organization_id, via, ref, at desc);
${isolate(routings, 'kete_routings')}

create table ${cursors} (
  organization_id text not null,
  mailbox text not null,
  last_uid bigint not null default 0,
  primary key (organization_id, mailbox)
);
${isolate(cursors, 'kete_mailbox_cursors')}

grant usage on schema ${schema} to ${app};
revoke all on ${rules}, ${routings}, ${cursors} from ${app};
grant select, insert on ${rules}, ${routings} to ${app};
grant select, insert, update on ${cursors} to ${app};
`;
}
