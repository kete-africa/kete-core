import { organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

/** The browser side of Better Auth; same origin as the Compte Kete. */
export const authClient = createAuthClient({ plugins: [organizationClient()] });
