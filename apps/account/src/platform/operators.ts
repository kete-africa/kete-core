import { and, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { member, user } from './schema';

/**
 * Kete operators are owners or administrators of Kete's own organization (named by
 * KETE_OPERATORS_ORGANIZATION_ID) who sign in with a second factor (spec 007). Same Compte Kete
 * as everyone: being an operator is a membership, not another account.
 */
export function operatorsOrganizationId(): string | null {
  return process.env.KETE_OPERATORS_ORGANIZATION_ID || null;
}

export async function isOperator(userId: string): Promise<boolean> {
  const organizationId = operatorsOrganizationId();
  if (!organizationId) return false;
  const [row] = await db
    .select({ twoFactorEnabled: user.twoFactorEnabled })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, userId),
        inArray(member.role, ['owner', 'admin']),
      ),
    );
  return row?.twoFactorEnabled === true;
}
