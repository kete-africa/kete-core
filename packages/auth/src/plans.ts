import type { KeteIdentity } from './verify.js';

// What an organization's offer allows in an app (spec 092): its limits, whether it is a trial,
// until when it may act, and until when it may still read once that ends. The Compte Kete puts it
// in the token (`plans`); an app reads it here, refuses a costly gesture beyond a limit or after
// the end, and stays readable.

/** The limits an offer may set; a limit not set is no limit. */
export const limitNames = [
  'people',
  'ai_tokens_month',
  'storage_mb',
  'connected_apps',
  'agents',
] as const;
export type LimitName = (typeof limitNames)[number];

export interface KetePlan {
  /** The offer's name, as the organization bought it. */
  offer: string;
  trial: boolean;
  /** The end of its use, grace included: afterwards nothing new is done. */
  until: Date;
  /** The end of reading: what was done stays readable until then. */
  readableUntil: Date;
  limits: Partial<Record<LimitName, number>>;
}

/** Why a gesture is refused. */
export type Refusal =
  | { reason: 'no_plan' }
  | { reason: 'ended'; until: Date }
  | { reason: 'limit'; limit: LimitName; allowed: number; used: number };

export class PlanRefusedError extends Error {
  constructor(readonly refusal: Refusal) {
    super(
      refusal.reason === 'limit'
        ? `The offer allows ${refusal.allowed} ${refusal.limit}; ${refusal.used} already used.`
        : refusal.reason === 'ended'
          ? 'The offer has ended: reading only.'
          : 'No offer for this app.',
    );
    this.name = 'PlanRefusedError';
  }
}

/** The organization's offer in an app, or null. */
export function planOf(identity: Pick<KeteIdentity, 'plans'>, app: string): KetePlan | null {
  return identity.plans?.[app] ?? null;
}

/** A limit of the offer; null when the offer sets none. */
export function limitOf(
  identity: Pick<KeteIdentity, 'plans'>,
  app: string,
  limit: LimitName,
): number | null {
  return planOf(identity, app)?.limits[limit] ?? null;
}

/** Whether what was done in the app may still be read: during its use, and after it ends. */
export function mayRead(
  identity: Pick<KeteIdentity, 'plans' | 'apps'>,
  app: string,
  now: Date = new Date(),
): boolean {
  const plan = planOf(identity, app);
  if (plan) return plan.readableUntil > now;
  const until = identity.apps[app];
  return until !== undefined && until > now;
}

/**
 * Whether a gesture may be done: the offer has not ended, and — for a costly gesture — adding
 * `adding` to what is `used` stays within the limit. Returns the refusal, or null.
 */
export function refusalOf(
  identity: Pick<KeteIdentity, 'plans' | 'apps'>,
  app: string,
  cost?: { limit: LimitName; used: number; adding?: number },
  now: Date = new Date(),
): Refusal | null {
  const plan = planOf(identity, app);
  const until = plan?.until ?? identity.apps[app];
  if (!until) return { reason: 'no_plan' };
  if (until <= now) return { reason: 'ended', until };
  if (cost) {
    const allowed = plan?.limits[cost.limit];
    if (allowed !== undefined && cost.used + (cost.adding ?? 1) > allowed) {
      return { reason: 'limit', limit: cost.limit, allowed, used: cost.used };
    }
  }
  return null;
}

/** Throws `PlanRefusedError` when the gesture is beyond the offer; see `refusalOf`. */
export function requireWithinPlan(
  identity: Pick<KeteIdentity, 'plans' | 'apps'>,
  app: string,
  cost?: { limit: LimitName; used: number; adding?: number },
  now: Date = new Date(),
): void {
  const refusal = refusalOf(identity, app, cost, now);
  if (refusal) throw new PlanRefusedError(refusal);
}

const LIMIT = new Set<string>(limitNames);

/** The `plans` claim, read; anything malformed is not a Compte Kete token. */
export function plansClaim(value: unknown, invalid: () => Error): Record<string, KetePlan> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw invalid();
  const plans: Record<string, KetePlan> = {};
  for (const [app, raw] of Object.entries(value as Record<string, unknown>)) {
    const plan = raw as Record<string, unknown> | null;
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(app) || typeof plan !== 'object' || plan === null) {
      throw invalid();
    }
    const until = new Date(String(plan.until));
    const readableUntil = new Date(String(plan.readable_until));
    const limits = (plan.limits ?? {}) as Record<string, unknown>;
    if (
      typeof plan.offer !== 'string' ||
      Number.isNaN(until.getTime()) ||
      Number.isNaN(readableUntil.getTime()) ||
      typeof limits !== 'object' ||
      Array.isArray(limits)
    ) {
      throw invalid();
    }
    const kept: KetePlan['limits'] = {};
    for (const [name, amount] of Object.entries(limits)) {
      if (!LIMIT.has(name) || !Number.isInteger(amount) || (amount as number) < 0) throw invalid();
      kept[name as LimitName] = amount as number;
    }
    plans[app] = {
      offer: plan.offer,
      trial: plan.trial === true,
      until,
      readableUntil,
      limits: kept,
    };
  }
  return plans;
}

/** A plan as the claim carries it (JSON). */
export function planToClaim(plan: KetePlan): Record<string, unknown> {
  return {
    offer: plan.offer,
    trial: plan.trial,
    until: plan.until.toISOString(),
    readable_until: plan.readableUntil.toISOString(),
    limits: plan.limits,
  };
}
