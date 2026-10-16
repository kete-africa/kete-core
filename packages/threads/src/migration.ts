import { ACTIVE_ORGANIZATION_SQL } from '@kete/tenancy';

export interface ThreadsMigrationOptions {
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
 * The SQL creating threads, their members, their messages and who read them, with their RLS
 * policies in the same migration (constitution V). A trace at least as good as mail (D-057):
 * messages and reads are append-only — an edit is a new message naming the one it replaces —, a
 * member who leaves keeps the dates she knew; nothing is ever deleted.
 */
export function threadsMigrationSql(options: ThreadsMigrationOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const threads = `${schema}.kete_threads`;
  const members = `${schema}.kete_thread_members`;
  const messages = `${schema}.kete_messages`;
  const reads = `${schema}.kete_message_reads`;
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  const isolate = (table: string, name: string) => `
alter table ${table} enable row level security;
create policy ${name}_isolation on ${table} as permissive for all to ${app}
  using (${organization})
  with check (${organization});`;
  return `
create table ${threads} (
  thread_id text primary key,
  organization_id text not null,
  kind text not null check (kind in ('object', 'group', 'direct', 'kete')),
  object_kind text,
  object_id text,
  title text not null check (length(title) between 1 and 200),
  holder_kind text not null check (holder_kind in ('person', 'agent')),
  holder_id text not null check (length(holder_id) > 0),
  address text,
  retention text,
  state text not null default 'open' check (state in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  check ((kind = 'object') = (object_kind is not null and object_id is not null)),
  check ((state = 'closed') = (closed_at is not null))
);
-- One thread per object; one address per thread.
create unique index kete_threads_object on ${threads} (organization_id, object_kind, object_id)
  where kind = 'object';
create unique index kete_threads_address on ${threads} (address) where address is not null;
${isolate(threads, 'kete_threads')}

create table ${members} (
  organization_id text not null,
  thread_id text not null references ${threads} (thread_id),
  member_kind text not null check (member_kind in ('person', 'agent', 'contact')),
  member_id text not null check (length(member_id) > 0),
  role text not null default 'member' check (role in ('member', 'subscriber')),
  since timestamptz not null default now(),
  until timestamptz,
  primary key (thread_id, member_kind, member_id, since),
  check (until is null or until >= since)
);
create index kete_thread_members_by_member on ${members} (organization_id, member_kind, member_id)
  where until is null;
${isolate(members, 'kete_thread_members')}

create table ${messages} (
  message_id text primary key,
  organization_id text not null,
  thread_id text not null references ${threads} (thread_id),
  author_kind text not null check (author_kind in ('person', 'agent', 'contact')),
  author_id text not null check (length(author_id) > 0),
  text text not null check (length(text) <= 20000),
  attachments jsonb not null default '[]',
  for_what text not null check (for_what in ('action', 'information')),
  to_kind text check (to_kind in ('person', 'agent')),
  to_id text,
  via text not null check (via in ('kete', 'whatsapp', 'mail', 'telegram', 'form')),
  reply_to text references ${messages} (message_id),
  edited_from text references ${messages} (message_id),
  mentions jsonb not null default '[]',
  at timestamptz not null default now(),
  search tsvector generated always as (to_tsvector('simple', text)) stored,
  check ((to_kind is null) = (to_id is null))
);
-- An edit replaces one message once: the versions of a message are a line, never a tree.
create unique index kete_messages_edited_from on ${messages} (edited_from)
  where edited_from is not null;
create index kete_messages_by_thread on ${messages} (organization_id, thread_id, at);
create index kete_messages_search on ${messages} using gin (search);
${isolate(messages, 'kete_messages')}

create table ${reads} (
  organization_id text not null,
  message_id text not null references ${messages} (message_id),
  reader_kind text not null check (reader_kind in ('person', 'agent', 'contact')),
  reader_id text not null check (length(reader_id) > 0),
  at timestamptz not null default now(),
  primary key (message_id, reader_kind, reader_id)
);
${isolate(reads, 'kete_message_reads')}

grant usage on schema ${schema} to ${app};
revoke all on ${threads}, ${members}, ${messages}, ${reads} from ${app};
grant select, insert on ${threads}, ${members}, ${messages}, ${reads} to ${app};
-- A thread is put away and changes hands; a member leaves. Nothing else is ever changed.
grant update (state, closed_at, holder_kind, holder_id) on ${threads} to ${app};
grant update (until) on ${members} to ${app};
`;
}
