import { and, eq } from 'drizzle-orm';
import { auth } from './auth';
import { contactOf } from '@kete/identity';
import { db } from './db';
import { member } from './schema';

export type OrganizationRole = 'owner' | 'admin' | 'member';

/** Who is acting, for whom, with which role (CONCEPTION 10). */
export interface Actor {
  userId: string;
  email: string;
  name: string;
  organizationId: string | null;
  role: OrganizationRole | null;
}

export class ForbiddenError extends Error {
  constructor(readonly code: 'unauthenticated' | 'no_organization' | 'forbidden') {
    super(code);
    this.name = 'ForbiddenError';
  }
}

/** Resolves the actor from the request's session; null when nobody is signed in. */
export async function actorFromHeaders(headers: Headers): Promise<Actor | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  const organizationId =
    (session.session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
  let role: OrganizationRole | null = null;
  if (organizationId) {
    const [membership] = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)));
    role = (membership?.role as OrganizationRole | undefined) ?? null;
  }
  return {
    userId: session.user.id,
    // A person provisioned by phone is shown her number, never the placeholder address.
    email: contactOf(session.user as { email: string; phoneNumber?: string | null }),
    name: session.user.name,
    // A session pointing at an organization the person left is treated as none.
    organizationId: role ? organizationId : null,
    role,
  };
}

/** The actor must be a member of an active organization. */
export function requireMember(
  actor: Actor | null,
): Actor & { organizationId: string; role: OrganizationRole } {
  if (!actor) throw new ForbiddenError('unauthenticated');
  if (!actor.organizationId || !actor.role) throw new ForbiddenError('no_organization');
  return actor as Actor & { organizationId: string; role: OrganizationRole };
}

export function canAdminister(role: OrganizationRole): boolean {
  return role === 'owner' || role === 'admin';
}

export { inOrganization } from './tenancy';
