import { newId } from '@kete/records';
import type { Emitter } from '@kete/sdk';
import { organizationPolicySql, type SqlExecutor } from '@kete/tenancy';

// Who uses what (spec 091): usage events per organization, kept in the app's own Postgres —
// no analytics service, no third party. An organization reads its own, by feature and by person.
// Kete Cockpit reads counts only: each day, the app records a `metrics.daily` event per
// organization in its outbox to Cockpit — numbers, never a person nor a word she wrote.

export interface UsageMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
const checked = (name: string) => {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
};

/** The usage table with its row-level security, and the one lookup across organizations. */
export function usageMigrationSql(options: UsageMigrationOptions): string {
  const s = checked(options.schema ?? 'public');
  const app = checked(options.appRole);
  return `
create table ${s}.kete_usage_events (
  organization_id text not null,
  event_id text not null,
  -- What was used, as \`feature.action\`: \`deposits.create\`, \`assistant.ask\`.
  name text not null check (name ~ '^[a-z][a-z0-9_]{0,30}\\.[a-z][a-z0-9_]{0,30}$'),
  actor_kind text not null check (actor_kind in ('person', 'agent')),
  actor_id text not null check (length(actor_id) between 1 and 128),
  -- Where it was done: web, chat, whatsapp, telegram, api, mcp…
  surface text not null default 'web' check (surface ~ '^[a-z][a-z0-9_]{0,20}$'),
  properties jsonb not null default '{}',
  at timestamptz not null default now(),
  primary key (organization_id, event_id)
);
create index kete_usage_events_at on ${s}.kete_usage_events (organization_id, at);
create index kete_usage_events_name on ${s}.kete_usage_events (organization_id, name, at);
${organizationPolicySql({ schema: s, table: 'kete_usage_events', appRole: app })}
grant select, insert, delete on ${s}.kete_usage_events to ${app};
revoke update, truncate on ${s}.kete_usage_events from ${app};

-- A worker's round has no organization: which ones used the app that day? Identifiers only.
create function ${s}.kete_usage_organizations(p_from timestamptz, p_to timestamptz)
  returns table (organization_id text)
  language sql stable security definer set search_path = ${s}, pg_temp
  as $fn$ select distinct organization_id from kete_usage_events
           where at >= p_from and at < p_to $fn$;
revoke all on function ${s}.kete_usage_organizations(timestamptz, timestamptz) from public;
grant execute on function ${s}.kete_usage_organizations(timestamptz, timestamptz) to ${app};
`;
}

/** What the usage refuses: it measures, it never keeps a person's words nor her contact. */
export class UsageError extends Error {
  constructor(
    readonly code: 'invalid_name' | 'invalid_property' | 'personal_data',
    readonly detail = '',
  ) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = 'UsageError';
  }
}

export type UsageValue = string | number | boolean;

export interface UsageEvent {
  /** `feature.action`, in the app's own words. */
  name: string;
  actor: { kind: 'person' | 'agent'; id: string };
  /** Default `web`. */
  surface?: string;
  /** A few facts about the use: a count, a mode, a choice. Never a name, an e-mail, a phone. */
  properties?: Record<string, UsageValue>;
}

const NAME = /^[a-z][a-z0-9_]{0,30}\.[a-z][a-z0-9_]{0,30}$/;
const KEY = /^[a-z][a-z0-9_]{0,30}$/;
const looksPersonal = [/[\w.+-]+@[\w-]+\.[\w.-]+/, /\+?\d[\d ().-]{7,}\d/];

function checkProperties(properties: Record<string, UsageValue>): Record<string, UsageValue> {
  const entries = Object.entries(properties);
  if (entries.length > 10) throw new UsageError('invalid_property', 'ten at most');
  for (const [key, value] of entries) {
    if (!KEY.test(key)) throw new UsageError('invalid_property', key);
    if (typeof value === 'string') {
      if (value.length > 80) throw new UsageError('invalid_property', `${key} is too long`);
      if (looksPersonal.some((pattern) => pattern.test(value))) {
        throw new UsageError('personal_data', key);
      }
    } else if (typeof value === 'number' ? !Number.isFinite(value) : typeof value !== 'boolean') {
      throw new UsageError('invalid_property', key);
    }
  }
  return properties;
}

/** Records one use, in the organization's transaction. */
export async function trackUsage(
  db: SqlExecutor,
  organizationId: string,
  event: UsageEvent,
): Promise<string> {
  if (!NAME.test(event.name)) throw new UsageError('invalid_name', event.name);
  const properties = checkProperties(event.properties ?? {});
  const eventId = newId('use');
  await db.query(
    `insert into kete_usage_events
       (organization_id, event_id, name, actor_kind, actor_id, surface, properties)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      organizationId,
      eventId,
      event.name,
      event.actor.kind,
      event.actor.id,
      event.surface ?? 'web',
      JSON.stringify(properties),
    ],
  );
  return eventId;
}

export interface Period {
  /** Inclusive. */
  from: Date;
  /** Exclusive. */
  to: Date;
}

export interface FeatureUsage {
  name: string;
  events: number;
  /** Distinct people. */
  people: number;
  /** Distinct agents. */
  agents: number;
}

/** What the organization used in a period, the most used first. */
export async function usageByFeature(db: SqlExecutor, period: Period): Promise<FeatureUsage[]> {
  const { rows } = await db.query<{ name: string; events: number; people: number; agents: number }>(
    `select name, count(*)::int as events,
            count(distinct actor_id) filter (where actor_kind = 'person')::int as people,
            count(distinct actor_id) filter (where actor_kind = 'agent')::int as agents
       from kete_usage_events where at >= $1 and at < $2
      group by name order by events desc, name`,
    [period.from, period.to],
  );
  return rows;
}

export interface PersonUsage {
  personId: string;
  events: number;
  features: number;
  lastAt: string;
}

/** Who used it in a period, for the organization's own administrators. */
export async function usageByPerson(db: SqlExecutor, period: Period): Promise<PersonUsage[]> {
  const { rows } = await db.query<{
    actor_id: string;
    events: number;
    features: number;
    last_at: Date;
  }>(
    `select actor_id, count(*)::int as events, count(distinct name)::int as features,
            max(at) as last_at
       from kete_usage_events
      where actor_kind = 'person' and at >= $1 and at < $2
      group by actor_id order by events desc, actor_id`,
    [period.from, period.to],
  );
  return rows.map((row) => ({
    personId: row.actor_id,
    events: row.events,
    features: row.features,
    lastAt: row.last_at.toISOString(),
  }));
}

/** A day, `2026-10-13`, as the period it covers in UTC. */
export function dayPeriod(day: string): Period {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new TypeError(`Not a day: ${day}`);
  const from = new Date(`${day}T00:00:00.000Z`);
  return { from, to: new Date(from.getTime() + 86_400_000) };
}

/** The most counters a day carries to Cockpit (the contract's names are 60 characters at most). */
const MAX_COUNTERS = 50;

/**
 * A day's counters of an organization, as `metrics.daily` carries them: events, active people
 * and agents, and one counter per feature (`use_deposits_create`), the most used first.
 */
export async function dailyCounters(db: SqlExecutor, day: string): Promise<Record<string, number>> {
  const features = await usageByFeature(db, dayPeriod(day));
  const { rows } = await db.query<{ people: number; agents: number }>(
    `select count(distinct actor_id) filter (where actor_kind = 'person')::int as people,
            count(distinct actor_id) filter (where actor_kind = 'agent')::int as agents
       from kete_usage_events where at >= $1 and at < $2`,
    [dayPeriod(day).from, dayPeriod(day).to],
  );
  const counters: Record<string, number> = {
    usage_events: features.reduce((sum, feature) => sum + feature.events, 0),
    usage_people: rows[0]?.people ?? 0,
    usage_agents: rows[0]?.agents ?? 0,
  };
  for (const feature of features.slice(0, MAX_COUNTERS)) {
    counters[`use_${feature.name.replace('.', '_')}`.slice(0, 60)] = feature.events;
  }
  return counters;
}

/** The organizations that used the app in a period: what a worker's round visits. */
export async function organizationsWithUsage(
  lookup: SqlExecutor,
  period: Period,
): Promise<string[]> {
  const { rows } = await lookup.query<{ organization_id: string }>(
    `select organization_id from kete_usage_organizations($1, $2) order by organization_id`,
    [period.from, period.to],
  );
  return rows.map((row) => row.organization_id);
}

/**
 * Records the day's counters of an organization as `metrics.daily`, in its outbox to Kete
 * Cockpit, in the same transaction. Nothing is recorded for a day without use. The app's manifest
 * declares `metrics.daily`.
 */
export async function recordDailyUsage(
  db: SqlExecutor,
  emitter: Pick<Emitter, 'record'>,
  organizationId: string,
  day: string,
): Promise<Record<string, number> | null> {
  const counters = await dailyCounters(db, day);
  if (counters.usage_events === 0) return null;
  await emitter.record(db, {
    type: 'metrics.daily',
    organization: organizationId,
    data: { day, counters },
  });
  return counters;
}

/** Forgets what is older than the retention (default 400 days): usage is not an archive. */
export async function pruneUsage(db: SqlExecutor, days = 400): Promise<number> {
  const { rows } = await db.query(
    `delete from kete_usage_events where at < now() - make_interval(days => $1) returning event_id`,
    [days],
  );
  return rows.length;
}
