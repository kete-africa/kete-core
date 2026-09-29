import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt, organization } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { and, asc, eq } from 'drizzle-orm';
import { db } from './db';
import { sendEmail } from './email';
import { env } from './env';
import { prefixedId } from './ids';
import * as schema from './schema';
import { accessUntil } from '@/features/payments/access';

/** Claims every Kete app reads from a Compte Kete token (@kete/auth). */
export interface KeteClaims {
  sub: string;
  email: string;
  name: string;
  org: string | null;
  role: 'owner' | 'admin' | 'member' | null;
  /** Apps the organization may use, each with the end of its access (grace included). */
  apps: Record<string, string>;
}

export const auth = betterAuth({
  appName: 'Kete',
  baseURL: env.publicUrl,
  secret: env.authSecret,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    // No mail provider yet: verification waits for one (spec, assumptions).
    requireEmailVerification: false,
    minPasswordLength: 10,
  },
  advanced: {
    database: { generateId: ({ model }) => prefixedId(model) },
  },
  databaseHooks: {
    session: {
      create: {
        // A new session opens on the person's first organization, so apps get one in the token.
        async before(session) {
          const [first] = await db
            .select({ organizationId: schema.member.organizationId })
            .from(schema.member)
            .where(eq(schema.member.userId, session.userId))
            .orderBy(asc(schema.member.createdAt))
            .limit(1);
          return { data: { ...session, activeOrganizationId: first?.organizationId ?? null } };
        },
      },
    },
  },
  plugins: [
    organization({
      creatorRole: 'owner',
      invitationExpiresIn: 7 * 24 * 60 * 60,
      // No mail provider yet, so no address can be verified: the invitation link, handed to the
      // invited person, is the proof. Turn this back on with e-mail delivery (spec 003, edge cases).
      requireEmailVerificationOnInvitation: false,
      async sendInvitationEmail({ email, organization: org, inviter, id }) {
        await sendEmail({
          to: email,
          template: 'invitation',
          values: {
            organization: org.name,
            inviter: inviter.user.name,
            link: `${env.publicUrl}/invitation/${id}`,
          },
        });
      },
    }),
    jwt({
      jwt: {
        issuer: env.publicUrl,
        audience: 'kete-apps',
        expirationTime: '15m',
        async definePayload({ user, session }): Promise<KeteClaims> {
          const org =
            (session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
          let role: KeteClaims['role'] = null;
          if (org) {
            const [membership] = await db
              .select({ role: schema.member.role })
              .from(schema.member)
              .where(and(eq(schema.member.organizationId, org), eq(schema.member.userId, user.id)));
            role = (membership?.role as KeteClaims['role']) ?? null;
          }
          const apps = org && role ? await accessUntil(org) : {};
          return { sub: user.id, email: user.email, name: user.name, org, role, apps };
        },
      },
    }),
    // Must stay last: lets server functions set the session cookies.
    tanstackStartCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
