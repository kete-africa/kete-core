import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { keteClaims, MANDATE_SCOPE } from '@/platform/auth';
import { db } from '@/platform/db';
import { prefixedId } from '@/platform/ids';
import { oauthClient, standingMandates, user } from '@/platform/schema';
import { inOrganization } from '@/platform/tenancy';
import { MANDATE_SECONDS, mandateInput, personOf, signMandate } from './mandates';
import { AppApiError, requireApp } from './people';

/**
 * Spec 150 — a standing mandate. The center's agents also work while the person is away (a
 * routine, an event they follow) and then hold no token of hers to exchange. Once, with her own
 * token, she lets one agent act for her; each use then asks the Compte Kete again, which signs her
 * claims as they are now — her role, her apps — for ten minutes. Withdrawn, or she no longer a
 * member, nothing more is signed. Never more than her: the mandate of spec 049, given ahead of time.
 */

const useInput = z.object({
  organization: z.string().regex(/^org_[\w-]{4,64}$/),
  grant: z.string().regex(/^smd_[\w-]{4,64}$/),
});

/** She gives the agent its standing mandate (her token is her consent); given again, it is renewed. */
export async function grantStandingMandate(request: Request): Promise<{ grant: string }> {
  const center = await requireApp(request, MANDATE_SCOPE);
  const parsed = mandateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppApiError(422, 'invalid_input');
  const person = await personOf(parsed.data.subjectToken);
  const organization = person.org as string;
  const [row] = await inOrganization(organization, (tx) =>
    tx
      .insert(standingMandates)
      .values({
        id: prefixedId('standingMandate'),
        organizationId: organization,
        userId: person.sub as string,
        clientId: center.clientId,
        agentId: parsed.data.agent.id,
        agentName: parsed.data.agent.name,
      })
      .onConflictDoUpdate({
        target: [
          standingMandates.organizationId,
          standingMandates.userId,
          standingMandates.clientId,
          standingMandates.agentId,
        ],
        set: { agentName: parsed.data.agent.name, grantedAt: sql`now()`, revokedAt: null },
      })
      .returning({ id: standingMandates.id }),
  );
  if (!row) throw new AppApiError(422, 'invalid_input');
  return { grant: row.id };
}

/**
 * The agent's mandate for now, from its standing grant: her claims read again, the same `act` as
 * spec 049, ten minutes. Refused when withdrawn, asked by another client, or she has left.
 */
export async function useStandingMandate(
  request: Request,
): Promise<{ token: string; expiresIn: number }> {
  const center = await requireApp(request, MANDATE_SCOPE);
  const parsed = useInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppApiError(422, 'invalid_input');
  const { organization, grant } = parsed.data;
  const [row] = await inOrganization(organization, (tx) =>
    tx
      .update(standingMandates)
      .set({ lastUsedAt: sql`now()` })
      .where(
        and(
          eq(standingMandates.id, grant),
          eq(standingMandates.clientId, center.clientId),
          isNull(standingMandates.revokedAt),
        ),
      )
      .returning(),
  );
  if (!row) throw new AppApiError(404, 'no_mandate');
  const [person] = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      twoFactorEnabled: user.twoFactorEnabled,
    })
    .from(user)
    .where(eq(user.id, row.userId));
  if (!person) throw new AppApiError(404, 'no_mandate');
  const claims = await keteClaims(person, organization);
  // She has left the organization: her mandate goes with her.
  if (!claims.org || !claims.role) throw new AppApiError(403, 'not_a_member');
  return signMandate(
    { sub: person.id, ...claims },
    { agent: { id: row.agentId, name: row.agentName }, clientId: center.clientId },
    Math.floor(Date.now() / 1000) + MANDATE_SECONDS,
  );
}

/** The center withdraws a grant: the agent removed, or she withdrew it there. */
export async function revokeStandingMandate(request: Request): Promise<void> {
  const center = await requireApp(request, MANDATE_SCOPE);
  const parsed = useInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppApiError(422, 'invalid_input');
  await inOrganization(parsed.data.organization, (tx) =>
    tx
      .update(standingMandates)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(standingMandates.id, parsed.data.grant),
          eq(standingMandates.clientId, center.clientId),
          isNull(standingMandates.revokedAt),
        ),
      ),
  );
}

export interface StandingMandateView {
  id: string;
  agentName: string;
  /** The app the agent belongs to, by its registered name. */
  appName: string | null;
  grantedAt: string;
  lastUsedAt: string | null;
}

/** What her agents may do for her while she is away, in this organization (Mon espace Kete). */
export async function readMyStandingMandates(
  organization: string,
  userId: string,
): Promise<StandingMandateView[]> {
  const rows = await inOrganization(organization, (tx) =>
    tx
      .select({
        id: standingMandates.id,
        agentName: standingMandates.agentName,
        appName: oauthClient.name,
        grantedAt: standingMandates.grantedAt,
        lastUsedAt: standingMandates.lastUsedAt,
      })
      .from(standingMandates)
      .leftJoin(oauthClient, eq(oauthClient.clientId, standingMandates.clientId))
      .where(and(eq(standingMandates.userId, userId), isNull(standingMandates.revokedAt)))
      .orderBy(desc(standingMandates.grantedAt)),
  );
  return rows.map((r) => ({
    id: r.id,
    agentName: r.agentName,
    appName: r.appName ?? null,
    grantedAt: r.grantedAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
  }));
}

/** She withdraws one: from now on, the agent no longer acts for her while she is away. */
export async function revokeMyStandingMandate(
  organization: string,
  userId: string,
  id: string,
): Promise<boolean> {
  const rows = await inOrganization(organization, (tx) =>
    tx
      .update(standingMandates)
      .set({ revokedAt: sql`now()` })
      .where(
        and(
          eq(standingMandates.id, id),
          eq(standingMandates.userId, userId),
          isNull(standingMandates.revokedAt),
        ),
      )
      .returning({ id: standingMandates.id }),
  );
  return rows.length > 0;
}
