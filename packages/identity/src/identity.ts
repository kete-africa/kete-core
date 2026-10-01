import { oauthProvider } from '@better-auth/oauth-provider';
import { passkey } from '@better-auth/passkey';
import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware, getSessionFromCtx } from 'better-auth/api';
import { jwt, magicLink, organization, twoFactor } from 'better-auth/plugins';
import { and, asc, eq } from 'drizzle-orm';
import { KETE_APPS_AUDIENCE, type KeteClaims } from './claims.js';
import type { IdentityDatabase } from './database.js';
import { signInMethodsOf } from './methods.js';
import { member } from './schema.js';
// Named in the inferred type of `createIdentity`, which the declarations must be able to reach.
import type {} from '@simplewebauthn/server';
import type {} from 'zod/v4/core';

/** What the identity says to people by e-mail; the instance renders and sends it. */
export interface IdentityEmails {
  /** A link to choose a new password, for an account that has one. */
  passwordReset(message: { to: string; link: string }): Promise<void>;
  /** The same request, for an account without a password: it learns why, nothing is added. */
  passwordResetUnavailable(message: { to: string }): Promise<void>;
  invitation(message: {
    to: string;
    organization: string;
    inviter: string;
    link: string;
  }): Promise<void>;
}

export interface IdentityOptions {
  /** `Kete`: the issuer shown in authenticator apps. */
  appName: string;
  /** The public origin, e.g. https://compte.kete.africa: the issuer of every token. */
  baseURL: string;
  secret: string;
  db: IdentityDatabase;
  /** Every table the adapter reaches: `@kete/identity/schema`, and the instance's own. */
  schema: Record<string, unknown>;
  generateId(model: string): string;
  /** The name a passkey is saved under, e.g. `Compte Kete`. */
  passkeyName: string;
  emails: IdentityEmails;
  /** The instance's pages. */
  pages: {
    signIn: string;
    consent: string;
    /** Where a person lands once signed in, when no app asked for her. */
    home: string;
    invitation(id: string): string;
  };
  /** The apps an organization may use, each with the end of its access (the `apps` claim). */
  appsOf(organizationId: string): Promise<Record<string, string>>;
  /** Who may register, change or remove an app: the instance's operators. */
  isOperator(userId: string): Promise<boolean>;
  /** Called once an organization exists, in its own transaction: announce it. */
  onOrganizationCreated?(organizationId: string): Promise<void>;
  /** One-time sign-in links an app asks for a person it provisioned (spec 013). */
  signInLinks: { expiresIn: number; deliver(url: string): Promise<void> };
  /** Scopes beyond OpenID Connect's, e.g. `kete:people` (spec 013). */
  scopes?: string[];
  /** The framework's cookie plugin, which must stay last. */
  plugins?: BetterAuthPlugin[];
}

type Person = { id: string; email: string; name: string; twoFactorEnabled?: boolean | null };

/**
 * The Compte Kete's rules, for any instance that keeps its own identity (doctrine D-026): people
 * with a password, passkeys or both, a second factor, organizations with an owner, admins and
 * members, invitations, one-time sign-in links, and the OpenID provider every Kete app signs in
 * with — its tokens carrying the Kete claims.
 */
export function createIdentity(options: IdentityOptions) {
  const { db } = options;
  const methods = signInMethodsOf(db);

  /** The Kete claims of a person for one organization (null: none). */
  async function claimsOf(person: Person, organizationId: string | null): Promise<KeteClaims> {
    let role: KeteClaims['role'] = null;
    if (organizationId) {
      const [membership] = await db
        .select({ role: member.role })
        .from(member)
        .where(and(eq(member.organizationId, organizationId), eq(member.userId, person.id)));
      role = (membership?.role as KeteClaims['role']) ?? null;
    }
    const org = role ? organizationId : null;
    return {
      email: person.email,
      name: person.name,
      org,
      role,
      apps: org ? await options.appsOf(org) : {},
      // A second factor, or a passkey-only account (spec 016).
      two_factor: person.twoFactorEnabled === true || (await methods.signsInStrongly(person.id)),
    };
  }

  const auth = betterAuth({
    appName: options.appName,
    baseURL: options.baseURL,
    secret: options.secret,
    database: drizzleAdapter(db, { provider: 'pg', schema: options.schema }),
    emailAndPassword: {
      enabled: true,
      // Verification of existing unverified accounts is a separate decision: turning it on would
      // lock them out until they verify (spec 025, out of scope).
      requireEmailVerification: false,
      minPasswordLength: 10,
      resetPasswordTokenExpiresIn: 60 * 60,
      // A new password closes every other session (spec 025).
      revokeSessionsOnPasswordReset: true,
      // Only an account that has a password gets a link: Better Auth would otherwise add one, and
      // a passkey-only account chose to have none (spec 016). Others learn why, by e-mail only.
      async sendResetPassword({ user, url }) {
        const { password } = await methods.signInMethods(user.id);
        if (password) await options.emails.passwordReset({ to: user.email, link: url });
        else await options.emails.passwordResetUnavailable({ to: user.email });
      },
    },
    advanced: {
      database: { generateId: ({ model }) => options.generateId(model) },
    },
    hooks: {
      // A passkey-only account never removes its last passkey: she would lose her way in.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== '/passkey/delete-passkey') return;
        const session = ctx.context.session ?? (await getSessionFromCtx(ctx));
        if (!session) return;
        const found = await methods.signInMethods(session.user.id);
        if (!found.password && found.passkeys <= 1) {
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
              .select({ organizationId: member.organizationId })
              .from(member)
              .where(eq(member.userId, session.userId))
              .orderBy(asc(member.createdAt))
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
        // The invitation link, handed to the invited address, is the proof; requiring a verified
        // address waits for e-mail verification (spec 025, out of scope).
        requireEmailVerificationOnInvitation: false,
        organizationHooks: {
          // The organization is committed first, so its announcement follows in its own
          // transaction.
          async afterCreateOrganization({ organization: created }) {
            await options.onOrganizationCreated?.(created.id);
          },
        },
        async sendInvitationEmail({ email, organization: org, inviter, id }) {
          await options.emails.invitation({
            to: email,
            organization: org.name,
            inviter: inviter.user.name,
            link: new URL(options.pages.invitation(id), options.baseURL).toString(),
          });
        },
      }),
      twoFactor({ issuer: options.appName }),
      // Spec 016: a passkey (WebAuthn) — kept by the person's password manager or device.
      passkey({
        rpID: new URL(options.baseURL).hostname,
        rpName: options.passkeyName,
        origin: options.baseURL,
      }),
      // One-time sign-in links requested by an app for a person it provisioned (spec 013): the
      // link is handed back to the app, never e-mailed; single attempt, token stored hashed.
      magicLink({
        expiresIn: options.signInLinks.expiresIn,
        allowedAttempts: 1,
        storeToken: 'hashed',
        disableSignUp: true,
        sendMagicLink: async ({ url }) => options.signInLinks.deliver(url),
      }),
      jwt({
        jwt: {
          issuer: options.baseURL,
          audience: KETE_APPS_AUDIENCE,
          expirationTime: '15m',
          async definePayload({ user, session }) {
            const org =
              (session as { activeOrganizationId?: string | null }).activeOrganizationId ?? null;
            return { sub: user.id, ...(await claimsOf(user, org)) };
          },
        },
      }),
      openIdProvider(options, claimsOf),
      ...(options.plugins ?? []),
    ],
  });

  return { auth, claimsOf, ...methods };
}

/**
 * Every Kete app signs people in here (spec 007): OAuth 2.1 + OpenID Connect, PKCE required, only
 * registered clients, access tokens signed with the keys the identity publishes.
 *
 * The plugin's own types are not compatible with `exactOptionalPropertyTypes` (its OpenAPI
 * metadata declares `items?: undefined`); the cast is confined here.
 */
function openIdProvider(
  options: IdentityOptions,
  claimsOf: (person: Person, organizationId: string | null) => Promise<KeteClaims>,
): BetterAuthPlugin {
  const plugin = oauthProvider({
    loginPage: options.pages.signIn,
    consentPage: options.pages.consent,
    scopes: ['openid', 'profile', 'email', 'offline_access', ...(options.scopes ?? [])],
    resources: [KETE_APPS_AUDIENCE],
    enforcePerClientResources: false,
    allowDynamicClientRegistration: false,
    // Registering, changing or removing an app: operators only (two-factor included).
    clientPrivileges: async ({ user }) => (user ? options.isOperator(user.id) : false),
    accessTokenExpiresIn: 15 * 60,
    postLogin: {
      page: options.pages.home,
      // The authorization is tied to the organization active when the person signs in.
      consentReferenceId: ({ session }) =>
        (session as { activeOrganizationId?: string | null }).activeOrganizationId ?? undefined,
      shouldRedirect: () => false,
    },
    customAccessTokenClaims: async ({ user, referenceId }) =>
      user ? { ...(await claimsOf(user, referenceId ?? null)) } : {},
    customIdTokenClaims: async ({ user }) => ({ name: user.name, email: user.email }),
  });
  return plugin as unknown as BetterAuthPlugin;
}

export type Identity = ReturnType<typeof createIdentity>;
