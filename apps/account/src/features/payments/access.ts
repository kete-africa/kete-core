import type { PlanClaim } from '@kete/identity';
import { eq } from 'drizzle-orm';
import { inOrganization } from '../../platform/tenancy';
import { offers, subscriptions, type KeteApp } from '../../platform/schema';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Apps the organization may use now, and until when (end of grace): carried in the token. */
export async function accessUntil(
  organizationId: string,
): Promise<Partial<Record<KeteApp, string>>> {
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(subscriptions));
  const now = new Date();
  return Object.fromEntries(
    rows
      .filter((row) => row.graceUntil > now)
      .map((row) => [row.app, row.graceUntil.toISOString()]),
  );
}

/**
 * The organization's offer in each app it subscribed to (spec 092): its limits, whether it is a
 * trial, until when it acts and until when it still reads. Carried in the token as `plans`; an
 * offer whose reading has ended is no longer carried.
 */
export async function plansOf(organizationId: string): Promise<Record<string, PlanClaim>> {
  const rows = await inOrganization(organizationId, (tx) =>
    tx
      .select({ subscription: subscriptions, offer: offers })
      .from(subscriptions)
      .innerJoin(offers, eq(offers.id, subscriptions.offerId)),
  );
  const now = new Date();
  const plans: Record<string, PlanClaim> = {};
  for (const { subscription, offer } of rows) {
    const readableUntil = new Date(subscription.graceUntil.getTime() + offer.readDays * DAY_MS);
    if (readableUntil <= now) continue;
    plans[subscription.app] = {
      offer: offer.name,
      trial: subscription.trial,
      until: subscription.graceUntil.toISOString(),
      readable_until: readableUntil.toISOString(),
      limits: offer.limits as Record<string, number>,
    };
  }
  return plans;
}
