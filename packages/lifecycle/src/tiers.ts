import type { Resource } from '@kete/sdk';

// The tiers of a resource (spec 105; doctrine D-053): who may use a skill, an agent or an app — me,
// my team, my unit, the whole organization. It climbs one tier at a time, never skipping one; each
// step needs its test cases passing on the current version, its lessons decided, and a review by
// a role that its risk names. Its owner never reviews her own promotion.

export type Tier = Resource['tier'];
export type Risk = 'low' | 'medium' | 'high';

export const TIERS: readonly Tier[] = ['me', 'team', 'unit', 'organization'];

/** The tier above, or null at the top. */
export function nextTier(tier: Tier): Tier | null {
  return TIERS[TIERS.indexOf(tier) + 1] ?? null;
}

/** How many test cases a tier asks, at least, all passing on the current version. */
export const CASES_FOR: Record<Exclude<Tier, 'me'>, number> = {
  team: 3,
  unit: 5,
  organization: 10,
};

/**
 * Who reviews a promotion: the risk names a role — the team's lead, the unit's head, the
 * organization's administrator — and reaching the whole organization is never reviewed below the
 * unit's head.
 */
export function reviewerFor(risk: Risk, target: Exclude<Tier, 'me'>): string {
  const role = risk === 'high' ? 'admin' : risk === 'medium' ? 'unit_head' : 'team_lead';
  return target === 'organization' && role === 'team_lead' ? 'unit_head' : role;
}

export type Missing = 'top_tier' | 'cases' | 'cases_failing' | 'lessons_waiting' | 'review_pending';

/** Whether a resource may ask the next tier, and what it lacks. */
export function readiness(
  resource: Resource,
  options: { waitingLessons: number },
): { ready: true; target: Exclude<Tier, 'me'> } | { ready: false; missing: Missing[] } {
  const target = nextTier(resource.tier);
  if (!target || target === 'me') return { ready: false, missing: ['top_tier'] };
  const missing: Missing[] = [];
  const cases = resource.cases ?? { total: 0, passed: 0 };
  if (cases.total < CASES_FOR[target]) missing.push('cases');
  if (cases.passed < cases.total) missing.push('cases_failing');
  if (options.waitingLessons > 0) missing.push('lessons_waiting');
  if (resource.review?.state === 'asked') missing.push('review_pending');
  return missing.length ? { ready: false, missing } : { ready: true, target };
}
