import type { Actor } from '@kete/commands';
import { ACTIVE_ORGANIZATION_SQL, inOrganization, type ClientPool } from '@kete/tenancy';
import { costOf, type ModelPrices } from './observability.js';

/** What a model call cost, in tokens: the unit budgets are counted in. */
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  modelCalls: number;
}

/** Who a budget applies to: the whole organization, or one agent. */
export interface BudgetScope {
  kind: 'organization' | 'agent';
  id: string;
}

export interface UsageContext {
  organizationId: string;
  actor: Actor;
  /** What the call was for, e.g. `chat`, `quote_extraction`. */
  purpose: string;
  model: string;
}

export class BudgetExceededError extends Error {
  constructor(
    readonly scope: BudgetScope,
    readonly limit: number,
    readonly spent: number,
  ) {
    super(
      `The ${scope.kind} budget of ${limit} tokens this month is spent (${spent}): no model call.`,
    );
    this.name = 'BudgetExceededError';
  }
}

/** Budgets and usage, kept by the product (@kete/ai reads and writes them). */
export interface BudgetStore {
  /** Throws `BudgetExceededError` if a scope of this call has spent its monthly budget. */
  check(context: Pick<UsageContext, 'organizationId' | 'actor'>): Promise<void>;
  /** Records a call's usage, whatever happens to the caller's transaction: the tokens were spent. */
  record(context: UsageContext, usage: Usage): Promise<void>;
}

/** The scopes a call counts against: its organization, and the agent when an agent calls. */
export function scopesOf(organizationId: string, actor: Actor): BudgetScope[] {
  const scopes: BudgetScope[] = [{ kind: 'organization', id: organizationId }];
  if (actor.kind === 'agent') scopes.push({ kind: 'agent', id: actor.id });
  return scopes;
}

export interface AiMigrationOptions {
  /** Default `public`. */
  schema?: string;
  appRole: string;
}

const identifier = /^[a-z_][a-z0-9_]*$/;

function checkIdentifier(name: string): string {
  if (!identifier.test(name)) throw new Error(`Invalid SQL identifier: ${name}`);
  return name;
}

/**
 * The SQL creating the usage journal (append-only for the application role) and the monthly budgets,
 * each with its RLS policy in the same migration (constitution V).
 */
export function aiMigrationSql(options: AiMigrationOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  const app = checkIdentifier(options.appRole);
  const organization = `organization_id = ${ACTIVE_ORGANIZATION_SQL}`;
  return `
create table ${schema}.kete_ai_usage (
  id bigint generated always as identity primary key,
  organization_id text not null,
  actor_kind text not null,
  actor_id text not null,
  on_behalf_of_id text,
  purpose text not null,
  model text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  model_calls integer not null check (model_calls >= 0),
  created_at timestamptz not null default now()
);
create index kete_ai_usage_month on ${schema}.kete_ai_usage (organization_id, created_at);
alter table ${schema}.kete_ai_usage enable row level security;
create policy kete_ai_usage_isolation on ${schema}.kete_ai_usage as permissive for all to ${app}
  using (${organization}) with check (${organization});
revoke all on ${schema}.kete_ai_usage from ${app};
grant select, insert on ${schema}.kete_ai_usage to ${app};

create table ${schema}.kete_ai_budgets (
  organization_id text not null,
  scope_kind text not null check (scope_kind in ('organization', 'agent')),
  scope_id text not null,
  monthly_tokens integer not null check (monthly_tokens >= 0),
  updated_at timestamptz not null default now(),
  primary key (organization_id, scope_kind, scope_id)
);
alter table ${schema}.kete_ai_budgets enable row level security;
create policy kete_ai_budgets_isolation on ${schema}.kete_ai_budgets as permissive for all to ${app}
  using (${organization}) with check (${organization});
revoke all on ${schema}.kete_ai_budgets from ${app};
grant select, insert, update on ${schema}.kete_ai_budgets to ${app};
grant usage on schema ${schema} to ${app};
`;
}

/**
 * What each call cost, in millionths of a dollar (spec 058): a column added to the usage journal,
 * run after `aiMigrationSql` (idempotent). Null for a model without a price.
 */
export function aiCostMigrationSql(options: AiMigrationOptions): string {
  const schema = checkIdentifier(options.schema ?? 'public');
  return `
alter table ${schema}.kete_ai_usage add column if not exists cost_micro_usd bigint
  check (cost_micro_usd >= 0);
create index if not exists kete_ai_usage_purpose on ${schema}.kete_ai_usage (organization_id, purpose, created_at);
`;
}

/** One line of a usage report: calls of one purpose, model and actor over the period. */
export interface UsageLine {
  purpose: string;
  model: string;
  actorKind: string;
  actorId: string;
  onBehalfOfId: string | null;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  /** Millionths of a dollar; null when none of these calls had a price. */
  costMicroUsd: number | null;
}

/**
 * Budgets and usage in the product's Postgres (`aiMigrationSql`). A scope without a budget row is
 * not limited; `setBudget` sets one. With `prices` (and `aiCostMigrationSql`), each call also
 * records what it cost.
 */
export function postgresBudgetStore(
  pool: ClientPool,
  options: { prices?: ModelPrices } = {},
): BudgetStore & {
  setBudget(organizationId: string, scope: BudgetScope, monthlyTokens: number): Promise<void>;
  spent(organizationId: string, scope: BudgetScope): Promise<number>;
  /** Usage over a period (default: this month), by purpose, model and actor, its cost included. */
  report(organizationId: string, period?: { from?: Date; to?: Date }): Promise<UsageLine[]>;
} {
  const prices = options.prices;
  async function spent(organizationId: string, scope: BudgetScope): Promise<number> {
    return inOrganization(pool, organizationId, async (db) => {
      const { rows } = await db.query<{ spent: string }>(
        `select coalesce(sum(input_tokens + output_tokens), 0)::text as spent from kete_ai_usage
          where created_at >= date_trunc('month', now())
            and ($1 = 'organization' or (actor_kind = 'agent' and actor_id = $2))`,
        [scope.kind, scope.id],
      );
      return Number(rows[0]?.spent ?? 0);
    });
  }

  return {
    spent,
    async setBudget(organizationId, scope, monthlyTokens) {
      await inOrganization(pool, organizationId, (db) =>
        db.query(
          `insert into kete_ai_budgets (organization_id, scope_kind, scope_id, monthly_tokens)
           values ($1, $2, $3, $4)
           on conflict (organization_id, scope_kind, scope_id)
           do update set monthly_tokens = excluded.monthly_tokens, updated_at = now()`,
          [organizationId, scope.kind, scope.id, monthlyTokens],
        ),
      );
    },
    async check({ organizationId, actor }) {
      for (const scope of scopesOf(organizationId, actor)) {
        const limit = await inOrganization(pool, organizationId, async (db) => {
          const { rows } = await db.query<{ monthly_tokens: number }>(
            `select monthly_tokens from kete_ai_budgets where scope_kind = $1 and scope_id = $2`,
            [scope.kind, scope.id],
          );
          return rows[0]?.monthly_tokens ?? null;
        });
        if (limit === null) continue;
        const used = await spent(organizationId, scope);
        if (used >= limit) throw new BudgetExceededError(scope, limit, used);
      }
    },
    async record(context, usage) {
      const values = [
        context.organizationId,
        context.actor.kind,
        context.actor.id,
        context.actor.onBehalfOf?.id ?? null,
        context.purpose,
        context.model,
        usage.inputTokens,
        usage.outputTokens,
        usage.modelCalls,
      ];
      await inOrganization(pool, context.organizationId, (db) =>
        prices
          ? db.query(
              `insert into kete_ai_usage (organization_id, actor_kind, actor_id, on_behalf_of_id,
                 purpose, model, input_tokens, output_tokens, model_calls, cost_micro_usd)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
              [...values, costOf(context.model, usage, prices)],
            )
          : db.query(
              `insert into kete_ai_usage (organization_id, actor_kind, actor_id, on_behalf_of_id,
                 purpose, model, input_tokens, output_tokens, model_calls)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              values,
            ),
      );
    },
    async report(organizationId, period = {}) {
      return inOrganization(pool, organizationId, async (db) => {
        const { rows } = await db.query<{
          purpose: string;
          model: string;
          actor_kind: string;
          actor_id: string;
          on_behalf_of_id: string | null;
          calls: string;
          input_tokens: string;
          output_tokens: string;
          cost: string | null;
        }>(
          `select purpose, model, actor_kind, actor_id, on_behalf_of_id,
                  sum(model_calls)::text as calls, sum(input_tokens)::text as input_tokens,
                  sum(output_tokens)::text as output_tokens,
                  ${prices ? 'sum(cost_micro_usd)::text' : 'null::text'} as cost
             from kete_ai_usage
            where created_at >= coalesce($1, date_trunc('month', now()))
              and created_at < coalesce($2, 'infinity'::timestamptz)
            group by purpose, model, actor_kind, actor_id, on_behalf_of_id
            order by sum(input_tokens + output_tokens) desc`,
          [period.from ?? null, period.to ?? null],
        );
        return rows.map((r) => ({
          purpose: r.purpose,
          model: r.model,
          actorKind: r.actor_kind,
          actorId: r.actor_id,
          onBehalfOfId: r.on_behalf_of_id,
          calls: Number(r.calls),
          inputTokens: Number(r.input_tokens),
          outputTokens: Number(r.output_tokens),
          costMicroUsd: r.cost === null ? null : Number(r.cost),
        }));
      });
    },
  };
}
