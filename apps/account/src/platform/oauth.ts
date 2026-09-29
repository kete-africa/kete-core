import { oauthProvider } from '@better-auth/oauth-provider';
import type { BetterAuthPlugin } from 'better-auth';
import { KETE_APPS_AUDIENCE, type KeteClaims } from './claims';
import { isOperator } from './operators';

export const PEOPLE_SCOPE = 'kete:people';

type ClaimsOf = (
  user: { id: string; email: string; name: string; twoFactorEnabled?: boolean | null },
  organizationId: string | null,
) => Promise<KeteClaims>;

/**
 * Every Kete app signs people in here (spec 007): OAuth 2.1 + OpenID Connect, PKCE required, only
 * registered clients, access tokens signed with the keys the Compte Kete publishes.
 *
 * The plugin's own types are not compatible with `exactOptionalPropertyTypes` (its OpenAPI
 * metadata declares `items?: undefined`); the cast is confined here.
 */
export function keteOAuthProvider(keteClaims: ClaimsOf): BetterAuthPlugin {
  const plugin = oauthProvider({
    loginPage: '/connexion',
    consentPage: '/consentement',
    // `kete:people`: a trusted app provisions people by phone and asks for their sign-in links
    // (spec 013) — through `client_credentials` only, granted per client by an operator.
    scopes: ['openid', 'profile', 'email', 'offline_access', PEOPLE_SCOPE],
    resources: [KETE_APPS_AUDIENCE],
    enforcePerClientResources: false,
    allowDynamicClientRegistration: false,
    // Registering, changing or removing an app: Kete operators only (two-factor included).
    clientPrivileges: async ({ user }) => (user ? isOperator(user.id) : false),
    accessTokenExpiresIn: 15 * 60,
    postLogin: {
      page: '/espace',
      // The authorization is tied to the organization active when the person signs in.
      consentReferenceId: ({ session }) =>
        (session as { activeOrganizationId?: string | null }).activeOrganizationId ?? undefined,
      shouldRedirect: () => false,
    },
    customAccessTokenClaims: async ({ user, referenceId }) =>
      user ? { ...(await keteClaims(user, referenceId ?? null)) } : {},
    customIdTokenClaims: async ({ user }) => ({ name: user.name, email: user.email }),
  });
  return plugin as unknown as BetterAuthPlugin;
}
