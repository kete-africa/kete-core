import { newId } from '@kete/records';
import { ACTIVE_ORGANIZATION_SQL, type SqlExecutor } from '@kete/tenancy';
import type { OAuthTokens } from './oauth.js';
import type { Sealer } from './seal.js';

// The tools an organization connects (spec 119): one row each with its credential sealed, its
// health and its state, and an append-only journal of who connected, refreshed, checked or revoked
// it. A reading never returns the credential; only `credentialOf`, server-side, opens it for the
// call it serves — never an agent's answer.

export interface ConnectionsMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

export function connectionsMigrationSql(options: ConnectionsMigrationOptions): string {
  const s = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  return `
create table ${s}.kete_connections (
  connection_id text primary key,
  organization_id text not null,
  tool text not null check (tool ~ '^[a-z][a-z0-9_.-]{1,60}$'),
  label text not null check (length(label) between 1 and 120),
  kind text not null check (kind in ('key', 'oauth')),
  scopes text[] not null default '{}',
  credential text,
  status text not null default 'connected' check (status in ('connected', 'failing', 'revoked')),
  failure text,
  checked_at timestamptz,
  expires_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now(),
  check ((status = 'revoked') = (credential is null))
);
create index kete_connections_by_tool on ${s}.kete_connections (organization_id, tool);
alter table ${s}.kete_connections enable row level security;
create policy kete_connections_isolation on ${s}.kete_connections as permissive for all to ${app}
  using (${organization}) with check (${organization});

create table ${s}.kete_connection_events (
  event_id text primary key,
  organization_id text not null,
  connection_id text not null,
  what text not null check (what in ('connected', 'refreshed', 'checked', 'failed', 'revoked')),
  detail text,
  by text not null,
  at timestamptz not null default now()
);
create index kete_connection_events_by_connection
  on ${s}.kete_connection_events (organization_id, connection_id, at);
alter table ${s}.kete_connection_events enable row level security;
create policy kete_connection_events_isolation on ${s}.kete_connection_events as permissive for all
  to ${app} using (${organization}) with check (${organization});

grant usage on schema ${s} to ${app};
revoke all on ${s}.kete_connections from ${app};
grant select, insert, update on ${s}.kete_connections to ${app};
revoke all on ${s}.kete_connection_events from ${app};
grant select, insert on ${s}.kete_connection_events to ${app};
`;
}

/** A connection as a screen, an agent or a log may see it: never its credential. */
export interface Connection {
  connectionId: string;
  tool: string;
  label: string;
  kind: 'key' | 'oauth';
  scopes: string[];
  status: 'connected' | 'failing' | 'revoked';
  failure: string | null;
  checkedAt: Date | null;
  expiresAt: Date | null;
  createdBy: string;
  createdAt: Date;
}

/** What `credentialOf` opens for the call it serves. */
export type Credential = { kind: 'key'; key: string } | { kind: 'oauth'; accessToken: string };

type Stored = { kind: 'key'; key: string } | ({ kind: 'oauth' } & OAuthTokens);

export class ConnectionError extends Error {
  constructor(
    readonly code: 'not_found' | 'revoked' | 'unreadable' | 'expired' | 'invalid_input',
    message: string,
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

const COLUMNS = `connection_id, tool, label, kind, scopes, status, failure, checked_at, expires_at,
  created_by, created_at`;

type Row = {
  connection_id: string;
  tool: string;
  label: string;
  kind: 'key' | 'oauth';
  scopes: string[];
  status: Connection['status'];
  failure: string | null;
  checked_at: Date | null;
  expires_at: Date | null;
  created_by: string;
  created_at: Date;
};

const toConnection = (r: Row): Connection => ({
  connectionId: r.connection_id,
  tool: r.tool,
  label: r.label,
  kind: r.kind,
  scopes: r.scopes,
  status: r.status,
  failure: r.failure,
  checkedAt: r.checked_at ? new Date(r.checked_at) : null,
  expiresAt: r.expires_at ? new Date(r.expires_at) : null,
  createdBy: r.created_by,
  createdAt: new Date(r.created_at),
});

async function journal(
  db: SqlExecutor,
  organizationId: string,
  event: { connectionId: string; what: string; detail?: string | null; by: string },
  at: Date,
): Promise<void> {
  await db.query(
    `insert into kete_connection_events (event_id, organization_id, connection_id, what, detail,
       by, at) values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      newId('cev'),
      organizationId,
      event.connectionId,
      event.what,
      event.detail ?? null,
      event.by,
      at,
    ],
  );
}

/**
 * Connects a tool, by a key or by what OAuth granted: the credential sealed, the connection
 * journaled. The caller checks who may connect.
 */
export async function connect(
  db: SqlExecutor,
  organizationId: string,
  sealer: Sealer,
  input: {
    tool: string;
    label: string;
    by: string;
  } & ({ key: string } | { tokens: OAuthTokens }),
  now = new Date(),
): Promise<Connection> {
  const stored: Stored =
    'key' in input ? { kind: 'key', key: input.key } : { kind: 'oauth', ...input.tokens };
  if (stored.kind === 'key' ? !stored.key.trim() : !stored.accessToken) {
    throw new ConnectionError('invalid_input', 'A connection needs its credential.');
  }
  const connectionId = newId('cnx');
  const scopes = stored.kind === 'oauth' ? (stored.scopes ?? []) : [];
  const expiresAt = stored.kind === 'oauth' && stored.expiresAt ? new Date(stored.expiresAt) : null;
  const { rows } = await db.query<Row>(
    `insert into kete_connections (connection_id, organization_id, tool, label, kind, scopes,
       credential, expires_at, created_by, created_at)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning ${COLUMNS}`,
    [
      connectionId,
      organizationId,
      input.tool,
      input.label,
      stored.kind,
      scopes,
      sealer.seal(JSON.stringify(stored)),
      expiresAt,
      input.by,
      now,
    ],
  );
  await journal(db, organizationId, { connectionId, what: 'connected', by: input.by }, now);
  return toConnection(rows[0] as Row);
}

/** The active organization's connections, without their credentials. */
export async function listConnections(
  db: SqlExecutor,
  query: { tool?: string } = {},
): Promise<Connection[]> {
  const { rows } = await db.query<Row>(
    `select ${COLUMNS} from kete_connections
      where ($1::text is null or tool = $1) order by created_at, connection_id`,
    [query.tool ?? null],
  );
  return rows.map(toConnection);
}

/**
 * Opens a connection's credential for the call it serves, server-side. An OAuth access token
 * close to its end is refreshed first with `refresh` — the new tokens sealed and journaled.
 */
export async function credentialOf(
  db: SqlExecutor,
  organizationId: string,
  sealer: Sealer,
  connectionId: string,
  options: { refresh?: (refreshToken: string) => Promise<OAuthTokens>; now?: Date } = {},
): Promise<Credential> {
  const now = options.now ?? new Date();
  const { rows } = await db.query<{ credential: string | null; status: string }>(
    `select credential, status from kete_connections where connection_id = $1 for update`,
    [connectionId],
  );
  const row = rows[0];
  if (!row) throw new ConnectionError('not_found', `No connection ${connectionId}.`);
  if (row.status === 'revoked' || !row.credential) {
    throw new ConnectionError('revoked', `${connectionId} was revoked.`);
  }
  const opened = sealer.open(row.credential);
  if (!opened) throw new ConnectionError('unreadable', `${connectionId} cannot be opened here.`);
  const stored = JSON.parse(opened) as Stored;
  if (stored.kind === 'key') return { kind: 'key', key: stored.key };
  const ending = stored.expiresAt !== undefined && stored.expiresAt - 60_000 <= now.getTime();
  if (!ending) return { kind: 'oauth', accessToken: stored.accessToken };
  if (!stored.refreshToken || !options.refresh) {
    throw new ConnectionError('expired', `${connectionId} needs to be connected again.`);
  }
  const tokens = await options.refresh(stored.refreshToken);
  const next: Stored = { ...stored, ...tokens };
  await db.query(
    `update kete_connections set credential = $2, expires_at = $3 where connection_id = $1`,
    [
      connectionId,
      sealer.seal(JSON.stringify(next)),
      next.expiresAt ? new Date(next.expiresAt) : null,
    ],
  );
  await journal(db, organizationId, { connectionId, what: 'refreshed', by: 'kete' }, now);
  return { kind: 'oauth', accessToken: next.accessToken };
}

/**
 * What a check of the tool said: healthy, or failing with why (its words, never its secret). A
 * failing connection stays connected: the next good check heals it.
 */
export async function recordCheck(
  db: SqlExecutor,
  organizationId: string,
  input: { connectionId: string; ok: boolean; failure?: string; by: string },
  now = new Date(),
): Promise<Connection> {
  const failure = input.ok ? null : (input.failure ?? 'failed').slice(0, 500);
  const { rows } = await db.query<Row>(
    `update kete_connections set status = $2, failure = $3, checked_at = $4
      where connection_id = $1 and status <> 'revoked' returning ${COLUMNS}`,
    [input.connectionId, input.ok ? 'connected' : 'failing', failure, now],
  );
  const row = rows[0];
  if (!row) throw new ConnectionError('not_found', `No live connection ${input.connectionId}.`);
  await journal(
    db,
    organizationId,
    {
      connectionId: input.connectionId,
      what: input.ok ? 'checked' : 'failed',
      detail: failure,
      by: input.by,
    },
    now,
  );
  return toConnection(row);
}

/** Revokes a connection: its credential wiped for good, journaled. False when already revoked. */
export async function revokeConnection(
  db: SqlExecutor,
  organizationId: string,
  input: { connectionId: string; by: string },
  now = new Date(),
): Promise<boolean> {
  const { rows } = await db.query(
    `update kete_connections set status = 'revoked', credential = null, failure = null
      where connection_id = $1 and status <> 'revoked' returning connection_id`,
    [input.connectionId],
  );
  if (rows.length === 0) return false;
  await journal(
    db,
    organizationId,
    { connectionId: input.connectionId, what: 'revoked', by: input.by },
    now,
  );
  return true;
}

/** A connection's journal, the newest first. */
export async function connectionHistory(
  db: SqlExecutor,
  connectionId: string,
): Promise<{ what: string; detail: string | null; by: string; at: Date }[]> {
  const { rows } = await db.query<{ what: string; detail: string | null; by: string; at: Date }>(
    `select what, detail, by, at from kete_connection_events where connection_id = $1
      order by at desc, event_id desc limit 200`,
    [connectionId],
  );
  return rows.map((r) => ({ ...r, at: new Date(r.at) }));
}
