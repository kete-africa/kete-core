import { and, asc, eq, gt } from 'drizzle-orm';
import type { Actor, OrganizationRole } from '@/platform/actor';
import { contactOf } from '@kete/identity';
import { db } from '@/platform/db';
import { invitation, member, organization, user } from '@/platform/schema';

export interface OrganizationSummary {
  id: string;
  name: string;
  role: OrganizationRole;
}

export interface Viewer {
  actor: Actor;
  organizations: OrganizationSummary[];
}

/** The signed-in person and the organizations they belong to (identity tables: decision 0003). */
export async function readViewer(actor: Actor | null): Promise<Viewer | null> {
  if (!actor) return null;
  const rows = await db
    .select({ id: organization.id, name: organization.name, role: member.role })
    .from(member)
    .innerJoin(organization, eq(organization.id, member.organizationId))
    .where(eq(member.userId, actor.userId))
    .orderBy(asc(organization.name));
  return {
    actor,
    organizations: rows.map((row) => ({ ...row, role: row.role as OrganizationRole })),
  };
}

export interface MemberRow {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: OrganizationRole;
}

export interface PendingInvitation {
  id: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
}

/** Members and pending invitations of one organization, for a person who belongs to it. */
export async function readMembers(
  organizationId: string,
): Promise<{ members: MemberRow[]; invitations: PendingInvitation[] }> {
  const members = await db
    .select({
      id: member.id,
      userId: member.userId,
      name: user.name,
      email: user.email,
      phoneNumber: user.phoneNumber,
      role: member.role,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(eq(member.organizationId, organizationId))
    .orderBy(asc(member.createdAt));
  const invitations = await db
    .select({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .where(
      and(
        eq(invitation.organizationId, organizationId),
        eq(invitation.status, 'pending'),
        gt(invitation.expiresAt, new Date()),
      ),
    )
    .orderBy(asc(invitation.expiresAt));
  return {
    members: members.map(({ phoneNumber, ...row }) => ({
      ...row,
      email: contactOf({ email: row.email, phoneNumber }),
      role: row.role as OrganizationRole,
    })),
    invitations: invitations.map((row) => ({
      id: row.id,
      email: row.email,
      role: (row.role ?? 'member') as OrganizationRole,
      expiresAt: row.expiresAt.toISOString(),
    })),
  };
}

export interface InvitationPreview {
  organizationName: string;
  email: string;
}

/**
 * What an invitation link shows before sign-in. The identifier is unguessable, so it reveals only
 * the organization's name and the invited address; anything no longer pending is null.
 */
export async function readInvitation(id: string): Promise<InvitationPreview | null> {
  const [row] = await db
    .select({
      organizationName: organization.name,
      email: invitation.email,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
    })
    .from(invitation)
    .innerJoin(organization, eq(organization.id, invitation.organizationId))
    .where(eq(invitation.id, id));
  if (!row || row.status !== 'pending' || row.expiresAt <= new Date()) return null;
  return { organizationName: row.organizationName, email: row.email };
}
