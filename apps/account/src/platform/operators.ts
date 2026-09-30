import { and, eq, inArray } from 'drizzle-orm';
import { db } from './db';
import { member } from './schema';
import { signsInStrongly } from './strength';

/**
 * Kete operators are owners or administrators of Kete's own organization (named by
 * KETE_OPERATORS_ORGANIZATION_ID) who sign in strongly: a second factor, or a passkey-only
 * account (specs 007 and 016). Same Compte Kete
 * as everyone: being an operator is a membership, not another account.
 */
export function operatorsOrganizationId(): string | null {
  return process.env.KETE_OPERATORS_ORGANIZATION_ID || null;
}

export async function isOperator(userId: string): Promise<boolean> {
  const organizationId = operatorsOrganizationId();
  if (!organizationId) return false;
  const [row] = await db
    .select({ userId: member.userId })
    .from(member)
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.userId, userId),
        inArray(member.role, ['owner', 'admin']),
      ),
    );
  return row !== undefined && (await signsInStrongly(userId));
}
