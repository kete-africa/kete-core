import { inOrganization } from '../../platform/tenancy';
import { subscriptions, type KeteApp } from '../../platform/schema';

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
