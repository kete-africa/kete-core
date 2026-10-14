import { isHuman, type Actor } from '@kete/commands';
import { newId } from '@kete/records';
import type { Lesson, Resource } from '@kete/sdk';
import { validateLesson, validateResource } from '@kete/sdk';
import { ACTIVE_ORGANIZATION_SQL, type SqlExecutor } from '@kete/tenancy';
import { nextTier, readiness, reviewerFor, type Missing, type Risk } from './tiers.js';

// Where the lifecycle is kept (spec 105; doctrine D-053): each resource — a skill, an agent, an app
// — with its owner, version, tier, test cases and the review it asked; and the lessons its use
// taught, gathered with consent, which its owner keeps — they become test cases — or drops.

export interface LifecycleMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;
const checked = (name: string) => {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
};

/** The two tables, with their RLS policies in the same migration (constitution V). */
export function lifecycleMigrationSql(options: LifecycleMigrationOptions): string {
  const schema = checked(options.schema ?? 'public');
  const app = checked(options.appRole);
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  return `
create table ${schema}.kete_resources (
  organization_id text not null,
  kind text not null check (kind in ('skill', 'agent', 'app')),
  resource_id text not null,
  name text not null,
  owner text not null,
  version text not null,
  tier text not null default 'me' check (tier in ('me', 'team', 'unit', 'organization')),
  review jsonb,
  cases jsonb not null default '{"total": 0, "passed": 0}',
  updated_at timestamptz not null default now(),
  primary key (organization_id, kind, resource_id)
);
create table ${schema}.kete_lessons (
  lesson_id text primary key,
  organization_id text not null,
  kind text not null check (kind in ('skill', 'agent', 'app')),
  resource_id text not null,
  source text not null check (source in ('correction', 'note', 'agent')),
  observed text not null check (length(observed) between 1 and 1000),
  proposal text,
  case_text text,
  state text not null default 'waiting' check (state in ('waiting', 'kept', 'dropped')),
  decided_by text,
  created_at timestamptz not null default now(),
  foreign key (organization_id, kind, resource_id)
    references ${schema}.kete_resources (organization_id, kind, resource_id)
);
create index kete_lessons_waiting on ${schema}.kete_lessons (organization_id, kind, resource_id, state);

alter table ${schema}.kete_resources enable row level security;
create policy kete_resources_isolation on ${schema}.kete_resources as permissive for all to ${app}
  using (${organization}) with check (${organization});
alter table ${schema}.kete_lessons enable row level security;
create policy kete_lessons_isolation on ${schema}.kete_lessons as permissive for all to ${app}
  using (${organization}) with check (${organization});
-- A lesson decided stays as it was decided.
create policy kete_lessons_frozen on ${schema}.kete_lessons as restrictive for update to ${app}
  using (state = 'waiting') with check (true);
grant usage on schema ${schema} to ${app};
revoke all on ${schema}.kete_resources, ${schema}.kete_lessons from ${app};
grant select, insert, update on ${schema}.kete_resources, ${schema}.kete_lessons to ${app};
`;
}

export class LifecycleError extends Error {
  constructor(
    readonly code:
      | 'invalid'
      | 'not_found'
      | 'human_required'
      | 'not_owner'
      | 'not_ready'
      | 'no_review'
      | 'not_reviewer'
      | 'own_promotion'
      | 'consent_required'
      | 'already_decided',
    message: string,
    readonly missing: Missing[] = [],
  ) {
    super(message);
    this.name = 'LifecycleError';
  }
}

type Ref = { kind: Resource['kind']; id: string };

interface ResourceRow extends Record<string, unknown> {
  kind: Resource['kind'];
  resource_id: string;
  name: string;
  owner: string;
  version: string;
  tier: Resource['tier'];
  review: Resource['review'] | null;
  cases: NonNullable<Resource['cases']>;
}

const toResource = (row: ResourceRow): Resource => ({
  kind: row.kind,
  id: row.resource_id,
  name: row.name,
  owner: row.owner,
  version: row.version,
  tier: row.tier,
  ...(row.review ? { review: row.review } : {}),
  cases: row.cases,
});

const RESOURCE = 'kind, resource_id, name, owner, version, tier, review, cases';

export async function getResource(db: SqlExecutor, ref: Ref): Promise<Resource | null> {
  const { rows } = await db.query<ResourceRow>(
    `select ${RESOURCE} from kete_resources where kind = $1 and resource_id = $2`,
    [ref.kind, ref.id],
  );
  return rows[0] ? toResource(rows[0]) : null;
}

/**
 * Says a resource's current version: new, it starts at its owner's tier (`me`); a new version keeps
 * its tier but its test cases must pass again.
 */
export async function registerResource(
  db: SqlExecutor,
  organizationId: string,
  resource: Pick<Resource, 'kind' | 'id' | 'name' | 'owner' | 'version'>,
): Promise<Resource> {
  const full: Resource = { ...resource, tier: 'me' };
  const valid = validateResource(full);
  if (!valid.ok) throw new LifecycleError('invalid', valid.errors.join('; '));
  const { rows } = await db.query<ResourceRow>(
    `insert into kete_resources (organization_id, kind, resource_id, name, owner, version)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (organization_id, kind, resource_id) do update
       set name = excluded.name,
           version = excluded.version,
           cases = case when kete_resources.version = excluded.version then kete_resources.cases
                        else '{"total": 0, "passed": 0}'::jsonb end,
           updated_at = now()
     returning ${RESOURCE}`,
    [organizationId, full.kind, full.id, full.name, full.owner, full.version],
  );
  return toResource(rows[0] as ResourceRow);
}

/** Its test cases on a version; a result for another version than the current one is ignored. */
export async function recordCases(
  db: SqlExecutor,
  ref: Ref,
  version: string,
  cases: { total: number; passed: number },
): Promise<Resource | null> {
  const total = Math.max(0, Math.floor(cases.total));
  const passed = Math.min(Math.max(0, Math.floor(cases.passed)), total);
  const { rows } = await db.query<ResourceRow>(
    `update kete_resources set cases = $4::jsonb, updated_at = now()
      where kind = $1 and resource_id = $2 and version = $3
      returning ${RESOURCE}`,
    [ref.kind, ref.id, version, JSON.stringify({ total, passed })],
  );
  return rows[0] ? toResource(rows[0]) : null;
}

async function waitingLessons(db: SqlExecutor, ref: Ref): Promise<number> {
  const { rows } = await db.query<{ n: string }>(
    `select count(*) as n from kete_lessons where kind = $1 and resource_id = $2 and state = 'waiting'`,
    [ref.kind, ref.id],
  );
  return Number(rows[0]?.n ?? 0);
}

/** What a resource lacks to ask the next tier. */
export async function readinessOf(db: SqlExecutor, ref: Ref) {
  const resource = await getResource(db, ref);
  if (!resource) throw new LifecycleError('not_found', `No ${ref.kind} ${ref.id}.`);
  return {
    resource,
    readiness: readiness(resource, { waitingLessons: await waitingLessons(db, ref) }),
  };
}

/** Its owner asks the next tier, with its risk: the review goes to the role the risk names. */
export async function askPromotion(
  db: SqlExecutor,
  ref: Ref,
  options: { by: Actor; risk: Risk },
): Promise<Resource> {
  if (!isHuman(options.by)) throw new LifecycleError('human_required', 'A person asks.');
  const { resource, readiness: ready } = await readinessOf(db, ref);
  if (resource.owner !== options.by.id) throw new LifecycleError('not_owner', 'Its owner asks.');
  if (!ready.ready) throw new LifecycleError('not_ready', 'It is not ready.', ready.missing);
  const review = {
    state: 'asked',
    risk: options.risk,
    by: reviewerFor(options.risk, ready.target),
  };
  const { rows } = await db.query<ResourceRow>(
    `update kete_resources set review = $3::jsonb, updated_at = now()
      where kind = $1 and resource_id = $2 returning ${RESOURCE}`,
    [ref.kind, ref.id, JSON.stringify(review)],
  );
  return toResource(rows[0] as ResourceRow);
}

/**
 * The reviewer decides: approved, the resource climbs one tier. She holds the role the review
 * names, and is not its owner.
 */
export async function decidePromotion(
  db: SqlExecutor,
  ref: Ref,
  options: { by: Actor; roles: readonly string[]; approve: boolean },
): Promise<Resource> {
  if (!isHuman(options.by)) throw new LifecycleError('human_required', 'A person reviews.');
  const resource = await getResource(db, ref);
  if (!resource) throw new LifecycleError('not_found', `No ${ref.kind} ${ref.id}.`);
  const review = resource.review;
  if (review?.state !== 'asked') throw new LifecycleError('no_review', 'Nothing was asked.');
  if (resource.owner === options.by.id) {
    throw new LifecycleError('own_promotion', 'Its owner does not review it.');
  }
  if (!review.by || !options.roles.includes(review.by)) {
    throw new LifecycleError('not_reviewer', `The review is ${review.by ?? 'nobody'}'s.`);
  }
  const tier = options.approve ? (nextTier(resource.tier) ?? resource.tier) : resource.tier;
  const { rows } = await db.query<ResourceRow>(
    `update kete_resources set tier = $3, review = $4::jsonb, updated_at = now()
      where kind = $1 and resource_id = $2 returning ${RESOURCE}`,
    [
      ref.kind,
      ref.id,
      tier,
      JSON.stringify({ ...review, state: options.approve ? 'approved' : 'refused' }),
    ],
  );
  return toResource(rows[0] as ResourceRow);
}

interface LessonRow extends Record<string, unknown> {
  lesson_id: string;
  kind: Resource['kind'];
  resource_id: string;
  source: Lesson['source'];
  observed: string;
  proposal: string | null;
  case_text: string | null;
  state: Lesson['state'];
}

const toLesson = (row: LessonRow): Lesson => ({
  id: row.lesson_id,
  resource: { kind: row.kind, id: row.resource_id },
  source: row.source,
  observed: row.observed,
  ...(row.proposal ? { proposal: row.proposal } : {}),
  ...(row.case_text ? { case: row.case_text } : {}),
  consent: true,
  state: row.state,
});

const LESSON = 'lesson_id, kind, resource_id, source, observed, proposal, case_text, state';

/**
 * Gathers what a use taught — only with the person's consent; it is data, never an instruction to
 * the resource. It waits for the owner.
 */
export async function gatherLesson(
  db: SqlExecutor,
  organizationId: string,
  lesson: Omit<Lesson, 'id' | 'state' | 'consent'> & { consent: boolean },
): Promise<Lesson> {
  if (lesson.consent !== true) throw new LifecycleError('consent_required', 'She did not agree.');
  const full = { ...lesson, consent: true as const, id: newId('lsn'), state: 'waiting' as const };
  const valid = validateLesson(full);
  if (!valid.ok) throw new LifecycleError('invalid', valid.errors.join('; '));
  if (!(await getResource(db, lesson.resource))) {
    throw new LifecycleError('not_found', `No ${lesson.resource.kind} ${lesson.resource.id}.`);
  }
  const { rows } = await db.query<LessonRow>(
    `insert into kete_lessons
       (lesson_id, organization_id, kind, resource_id, source, observed, proposal, case_text)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${LESSON}`,
    [
      full.id,
      organizationId,
      full.resource.kind,
      full.resource.id,
      full.source,
      full.observed,
      full.proposal ?? null,
      full.case ?? null,
    ],
  );
  return toLesson(rows[0] as LessonRow);
}

/** A resource's lessons, the oldest first — those waiting, by default. */
export async function lessonsOf(
  db: SqlExecutor,
  ref: Ref,
  state: Lesson['state'] = 'waiting',
): Promise<Lesson[]> {
  const { rows } = await db.query<LessonRow>(
    `select ${LESSON} from kete_lessons
      where kind = $1 and resource_id = $2 and state = $3 order by created_at limit 200`,
    [ref.kind, ref.id, state],
  );
  return rows.map(toLesson);
}

/** Its owner keeps a lesson — its case becomes a test case of the resource — or drops it. */
export async function decideLesson(
  db: SqlExecutor,
  id: string,
  options: { by: Actor; keep: boolean },
): Promise<Lesson> {
  if (!isHuman(options.by)) throw new LifecycleError('human_required', 'A person decides.');
  const { rows: found } = await db.query<LessonRow>(
    `select ${LESSON} from kete_lessons where lesson_id = $1`,
    [id],
  );
  const lesson = found[0];
  if (!lesson) throw new LifecycleError('not_found', `No lesson ${id}.`);
  if (lesson.state !== 'waiting') throw new LifecycleError('already_decided', 'It was decided.');
  const resource = await getResource(db, { kind: lesson.kind, id: lesson.resource_id });
  if (resource?.owner !== options.by.id)
    throw new LifecycleError('not_owner', 'Its owner decides.');
  const { rows } = await db.query<LessonRow>(
    `update kete_lessons set state = $2, decided_by = $3 where lesson_id = $1 returning ${LESSON}`,
    [id, options.keep ? 'kept' : 'dropped', options.by.id],
  );
  return toLesson(rows[0] as LessonRow);
}
