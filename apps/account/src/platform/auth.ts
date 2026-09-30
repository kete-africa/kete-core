import { passkey } from '@better-auth/passkey';
import { betterAuth } from 'better-auth';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt, magicLink, organization, twoFactor } from 'better-auth/plugins';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { and, asc, eq } from 'drizzle-orm';
import { db } from './db';
import { sendEmail } from './email';
import { env } from './env';
import { prefixedId } from './ids';
import { KETE_APPS_AUDIENCE, type KeteClaims } from './claims';
import { accountEvent, record } from './events';
import { keteOAuthProvider } from './oauth';
import { deliverSignInLink, SIGN_IN_LINK_SECONDS } from './sign-in-links';
import { signInMethods, signsInStrongly } from './strength';
import { inOrganization } from './tenancy';
import * as schema from './schema';
import { accessUntil } from '../features/payments/access';
import {
  invitationEmail,
  passwordResetEmail,
  passwordResetUnavailableEmail,
} from '../features/emails/templates';

/** The Kete claims of a person for one organization (null: none), from the database. */
export async function keteClaims(
  user: { id: string; email: string; name: string; twoFactorEnabled?: boolean | null },
  organizationId: string | null,
): Promise<KeteClaims> {
  let role: KeteClaims['role'] = null;
  if (organizationId) {
    const [membership] = await db
      .select({ role: schema.member.role })
      .from(schema.member)
      .where(
        and(eq(schema.member.organizationId, organizationId), eq(schema.member.userId, user.id)),
      );
    role = (membership?.role as KeteClaims['role']) ?? null;
  }
  const org = role ? organizationId : null;
  return {
    email: user.email,
    name: user.name,
    org,
    role,
    apps: org ? await accessUntil(org) : {},
    // A second factor, or a passkey-only account (spec 016).
    two_factor: user.twoFactorEnabled === true || (await signsInStrongly(user.id)),
  };
}

export const auth = betterAuth({
  appName: 'Kete',
  baseURL: env.publicUrl,
  secret: env.authSecret,
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  emailAndPassword: {
    enabled: true,
    // Verification of existing unverified accounts is a separate decision: turning it on would
    // lock them out until they verify (spec 025, out of scope).
    requireEmailVerification: false,
    minPasswordLength: 10,
    resetPasswordTokenExpiresIn: 60 * 60,
    // A new password closes every other session (spec 025).
    revokeSessionsOnPasswordReset: true,
    // Only an account that has a password gets a link: Better Auth would otherwise add one, and a
    // passkey-only account chose to have none (spec 016). Others learn why, by e-mail only.
    async sendResetPassword({ user, url }) {
      const { password } = await signInMethods(user.id);
      if (password) await sendEmail(passwordResetEmail, { to: user.email, values: { link: url } });
      else await sendEmail(passwordResetUnavailableEmail, { to: user.email, values: {} });
    },
  },
  advanced: {
    database: { generateId: ({ model }) => prefixedId(model) },
  },
  hooks: {
    // A passkey-only account never removes its last passkey: she would lose her way in (spec 016).
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== '/passkey/delete-passkey') return;
      const session = ctx.context.session ?? (await getSessionFromHeaders(ctx.headers));
      if (!session) return;
      const methods = await signInMethods(session.user.id);
      if (!methods.password && methods.passkeys <= 1) {
        throw new APIError('FORBIDDEN', { message: 'last_passkey' });
      }
    }),
  },
  user: {
    additionalFields: {
      // Set only by a trusted app's provisioning (spec 013), never by the person's own input.
      phoneNumber: { type: 'string', required: false, input: false },
    },
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
      organizationHooks: {
        // Announced to Kete Cockpit through the outbox. Better Auth commits the organization first,
        // so the event follows in its own transaction.
        async afterCreateOrganization({ organization: created }) {
          await inOrganization(created.id, (tx) =>
            record(tx, accountEvent('account.created', created.id, {})),
          );
        },
      },
      async sendInvitationEmail({ email, organization: org, inviter, id }) {
        await sendEmail(invitationEmail, {
          to: email,
          values: {
            organization: org.name,
            inviter: inviter.user.name,
            link: `${env.publicUrl}/invitation/${id}`,
          },
        });
      },
    }),
    twoFactor({ issuer: 'Kete' }),
    // Spec 016: a passkey (WebAuthn) — kept by the person's password manager or device.
    passkey({
      rpID: new URL(env.publicUrl).hostname,
      rpName: 'Compte Kete',
      origin: env.publicUrl,
    }),
    // One-time sign-in links requested by an app for a person it provisioned (spec 013): the link
    // is handed back to the app, never e-mailed; single attempt, token stored hashed.
    magicLink({
      expiresIn: SIGN_IN_LINK_SECONDS,
      allowedAttempts: 1,
      storeToken: 'hashed',
      disableSignUp: true,
      sendMagicLink: async ({ url }) => deliverSignInLink(url),
    }),
    jwt({
      jwt: {
        issuer: env.publicUrl,
        audience: KETE_APPS_AUDIENCE,
        expirationTime: '15m',
        async definePayload({ user, session }) {
          const org =
            (session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
          return { sub: user.id, ...(await keteClaims(user, org)) };
        },
      },
    }),
    keteOAuthProvider(keteClaims),
    // Must stay last: lets server functions set the session cookies.
    tanstackStartCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

async function getSessionFromHeaders(headers: Headers | undefined) {
  return headers ? auth.api.getSession({ headers }) : null;
}
