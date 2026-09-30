import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { organizationClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/** The browser side of Better Auth; same origin as the Compte Kete. */
export const authClient = createAuthClient({
  plugins: [
    organizationClient(),
    // Spec 016: sign in with a passkey, and manage them in Mon espace Kete → Sécurité.
    passkeyClient(),
    twoFactorClient({
      // The query is kept: a sign-in started by another Kete app resumes after the code.
      onTwoFactorRedirect() {
        window.location.assign(`/connexion/code${window.location.search}`);
      },
    }),
    // Adds the signed authorization request of the page to sign-in calls, so a Kete app that sent
    // the person here gets them back once signed in.
    oauthProviderClient(),
  ],
});

/** Where to go after a successful sign-in, sign-up or code: the app that asked, or `fallback`. */
export function continueAfterSignIn(data: unknown, fallback: string): void {
  const next = (data ?? {}) as { url?: unknown; redirect?: unknown; twoFactorRedirect?: unknown };
  // The two-factor plugin already navigates to the code page, and the client itself follows a
  // `redirect` answer (a Kete app's authorization resuming): navigating again would replay the
  // app's one-time code.
  if (next.twoFactorRedirect === true || next.redirect === true) return;
  window.location.assign(typeof next.url === 'string' && next.url ? next.url : fallback);
}
