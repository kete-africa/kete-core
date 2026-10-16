import { newId } from '@kete/records';
import { ACTIVE_ORGANIZATION_SQL, type SqlExecutor } from '@kete/tenancy';
import { validateGesture, type Gesture, type Policy, type PolicyDecision } from '@kete/sdk';
import type { Entity, PolicyEngine } from './engine.js';

// The organization's policies, each change a new version, and every decision journaled with the
// policies and versions that made it (spec 112, FR-002, FR-006). Nothing is changed or deleted.

export interface PoliciesMigrationOptions {
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
 * The SQL creating the policies' versions and the decisions' journal, with their RLS policies in
 * the same migration (constitution V). Both are append-only for the application role.
 */
export function policiesMigrationSql(options: PoliciesMigrationOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const policies = `${schema}.kete_policies`;
  const decisions = `${schema}.kete_policy_decisions`;
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  return `
create table ${policies} (
  organization_id text not null,
  policy_id text not null,
  version integer not null check (version >= 1),
  sentence text not null check (length(sentence) between 1 and 500),
  rule text not null check (length(rule) between 1 and 4000),
  policy_set text not null check (policy_set in ('authority', 'approval')),
  approver text,
  owner text not null,
  status text not null check (status in ('active', 'trial', 'off')),
  written_by text not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, policy_id, version),
  check (policy_set = 'approval' or approver is null)
);

alter table ${policies} enable row level security;
create policy kete_policies_isolation on ${policies} as permissive for all to ${app}
  using (${organization})
  with check (${organization});

create table ${decisions} (
  decision_id text primary key,
  organization_id text not null,
  gesture jsonb not null,
  effect text not null check (effect in ('allow', 'approve', 'refuse')),
  approvers text[] not null default '{}',
  policies jsonb not null,
  trial jsonb not null,
  at timestamptz not null default now()
);
create index kete_policy_decisions_by_time on ${decisions} (organization_id, at desc);

alter table ${decisions} enable row level security;
create policy kete_policy_decisions_isolation on ${decisions} as permissive for all to ${app}
  using (${organization})
  with check (${organization});

grant usage on schema ${schema} to ${app};
revoke all on ${policies} from ${app};
grant select, insert on ${policies} to ${app};
revoke all on ${decisions} from ${app};
grant select, insert on ${decisions} to ${app};
`;
}

export class PolicyError extends Error {
  constructor(
    readonly code: 'invalid_rule' | 'invalid_gesture' | 'not_found',
    message: string,
    readonly issues: string[] = [],
  ) {
    super(message);
    this.name = 'PolicyError';
  }
}

interface PolicyRow extends Record<string, unknown> {
  policy_id: string;
  version: number;
  sentence: string;
  rule: string;
  policy_set: Policy['set'];
  approver: string | null;
  owner: string;
  status: Policy['status'];
}

const toPolicy = (row: PolicyRow): Policy => ({
  id: row.policy_id,
  version: Number(row.version),
  sentence: row.sentence,
  rule: row.rule,
  set: row.policy_set,
  ...(row.approver ? { approver: row.approver } : {}),
  owner: row.owner,
  status: row.status,
});

/** The current version of each policy of the active organization, off ones included. */
export async function currentPolicies(db: SqlExecutor): Promise<Policy[]> {
  const { rows } = await db.query<PolicyRow>(
    `select distinct on (policy_id) policy_id, version, sentence, rule, policy_set, approver, owner,
            status
       from kete_policies order by policy_id, version desc`,
  );
  return rows.map(toPolicy);
}

/** Every version of a policy, the first first. */
export async function policyVersions(db: SqlExecutor, policyId: string): Promise<Policy[]> {
  const { rows } = await db.query<PolicyRow>(
    `select policy_id, version, sentence, rule, policy_set, approver, owner, status
       from kete_policies where policy_id = $1 order by version`,
    [policyId],
  );
  return rows.map(toPolicy);
}

/**
 * Keeps a policy as a person validated it (FR-002): its rule must fit the product's schema; it is
 * a new version of the policy, never an edit. A new policy should start on trial (FR-003).
 */
export async function savePolicy(
  db: SqlExecutor,
  organizationId: string,
  engine: PolicyEngine,
  input: Omit<Policy, 'version'> & { writtenBy: string },
): Promise<Policy> {
  const checked = engine.check(input.rule);
  if (!checked.ok) throw new PolicyError('invalid_rule', 'The rule does not fit.', checked.errors);
  const { rows } = await db.query<PolicyRow>(
    `insert into kete_policies (organization_id, policy_id, version, sentence, rule, policy_set,
       approver, owner, status, written_by)
     select $1, $2, coalesce(max(version), 0) + 1, $3, $4, $5, $6, $7, $8, $9
       from kete_policies where policy_id = $2
     returning policy_id, version, sentence, rule, policy_set, approver, owner, status`,
    [
      organizationId,
      input.id,
      input.sentence,
      input.rule,
      input.set,
      input.set === 'approval' ? (input.approver ?? 'manager') : null,
      input.owner,
      input.status,
      input.writtenBy,
    ],
  );
  return toPolicy(rows[0] as PolicyRow);
}

/** One journaled decision, as its reader finds it again. */
export interface JournaledDecision extends PolicyDecision {
  decisionId: string;
  gesture: Gesture;
  at: Date;
}

/**
 * Decides a gesture under the organization's current policies and journals the decision with the
 * policies and versions that made it (FR-001, FR-006). The product calls it before the command
 * runs, for a person and an agent alike, and gives the entities the gesture touches.
 */
export async function decideGesture(
  db: SqlExecutor,
  organizationId: string,
  input: { engine: PolicyEngine; gesture: Gesture; entities: readonly Entity[] },
): Promise<JournaledDecision> {
  const checked = validateGesture(input.gesture);
  if (!checked.ok) {
    throw new PolicyError(
      'invalid_gesture',
      'The gesture does not fit gesture.v1.',
      checked.errors,
    );
  }
  const policies = (await currentPolicies(db)).filter((p) => p.status !== 'off');
  const decision = input.engine.decide({
    policies,
    gesture: input.gesture,
    entities: input.entities,
  });
  const decisionId = newId('pdc');
  const { rows } = await db.query<{ at: Date }>(
    `insert into kete_policy_decisions (decision_id, organization_id, gesture, effect, approvers,
       policies, trial)
     values ($1, $2, $3, $4, $5, $6, $7) returning at`,
    [
      decisionId,
      organizationId,
      JSON.stringify(input.gesture),
      decision.effect,
      decision.approvers ?? [],
      JSON.stringify(decision.policies),
      JSON.stringify(decision.trial),
    ],
  );
  return {
    ...decision,
    decisionId,
    gesture: input.gesture,
    at: new Date((rows[0] as { at: Date }).at),
  };
}

/** The latest journaled decisions, newest first: what the owner of a policy on trial reads. */
export async function readDecisions(
  db: SqlExecutor,
  query: { policyId?: string; limit?: number } = {},
): Promise<JournaledDecision[]> {
  const { rows } = await db.query<{
    decision_id: string;
    gesture: Gesture;
    effect: PolicyDecision['effect'];
    approvers: string[];
    policies: PolicyDecision['policies'];
    trial: PolicyDecision['trial'];
    at: Date;
  }>(
    `select decision_id, gesture, effect, approvers, policies, trial, at
       from kete_policy_decisions
      where $1::text is null
         or policies @> jsonb_build_array(jsonb_build_object('id', $1::text))
         or trial @> jsonb_build_array(jsonb_build_object('id', $1::text))
      order by at desc, decision_id desc limit $2`,
    [query.policyId ?? null, Math.min(Math.max(query.limit ?? 50, 1), 500)],
  );
  return rows.map((row) => ({
    decisionId: row.decision_id,
    gesture: row.gesture,
    effect: row.effect,
    ...(row.approvers.length > 0 ? { approvers: row.approvers } : {}),
    policies: row.policies,
    trial: row.trial,
    at: new Date(row.at),
  }));
}

/**
 * The hook `@kete/commands` asks before a command runs (FR-001): the product says which gesture a
 * command's input is and which entities it touches; the gesture is decided and journaled.
 */
export function authorizeWith(
  db: SqlExecutor,
  organizationId: string,
  options: {
    engine: PolicyEngine;
    gestureOf(input: unknown, actor: { kind: string; id: string }): Gesture;
    entitiesOf(gesture: Gesture): Promise<readonly Entity[]> | readonly Entity[];
  },
): (input: unknown, actor: { kind: string; id: string }) => Promise<PolicyDecision> {
  return async (input, actor) => {
    const gesture = options.gestureOf(input, actor);
    return decideGesture(db, organizationId, {
      engine: options.engine,
      gesture,
      entities: await options.entitiesOf(gesture),
    });
  };
}
