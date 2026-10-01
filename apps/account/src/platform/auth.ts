import { createIdentity } from '@kete/identity';
import { tanstackStartCookies } from 'better-auth/tanstack-start';
import { db } from './db';
import { sendEmail } from './email';
import { env } from './env';
import { prefixedId } from './ids';
import { accountEvent, record } from './events';
import { isOperator } from './operators';
import { deliverSignInLink, SIGN_IN_LINK_SECONDS } from './sign-in-links';
import { inOrganization } from './tenancy';
import * as schema from './schema';
import { accessUntil } from '../features/payments/access';
import {
  invitationEmail,
  passwordResetEmail,
  passwordResetUnavailableEmail,
} from '../features/emails/templates';

/** `kete:people`: a trusted app provisions people by phone and asks for their sign-in links (spec
 * 013) — through `client_credentials` only, granted per client by an operator. */
export const PEOPLE_SCOPE = 'kete:people';

// The Compte Kete is @kete/identity (spec 026) with its own e-mails, events, offers and operators.
export const {
  auth,
  claimsOf: keteClaims,
  signInMethods,
  signsInStrongly,
  removePassword,
} = createIdentity({
  appName: 'Kete',
  baseURL: env.publicUrl,
  secret: env.authSecret,
  db,
  schema,
  generateId: prefixedId,
  passkeyName: 'Compte Kete',
  pages: {
    signIn: '/connexion',
    consent: '/consentement',
    home: '/espace',
    invitation: (id) => `/invitation/${id}`,
  },
  emails: {
    passwordReset: ({ to, link }) => sendEmail(passwordResetEmail, { to, values: { link } }).then(),
    passwordResetUnavailable: ({ to }) =>
      sendEmail(passwordResetUnavailableEmail, { to, values: {} }).then(),
    invitation: ({ to, ...values }) => sendEmail(invitationEmail, { to, values }).then(),
  },
  appsOf: accessUntil,
  isOperator,
  // Announced to Kete Cockpit through the outbox.
  onOrganizationCreated: (organizationId) =>
    inOrganization(organizationId, (tx) =>
      record(tx, accountEvent('account.created', organizationId, {})),
    ),
  signInLinks: { expiresIn: SIGN_IN_LINK_SECONDS, deliver: async (url) => deliverSignInLink(url) },
  scopes: [PEOPLE_SCOPE],
  // MCP servers (Kete Enterprise's gateway…) whose clients ask for a token bound to them.
  resources: env.oauthResources,
  // Must stay last: lets server functions set the session cookies.
  plugins: [tanstackStartCookies()],
});

export type Session = typeof auth.$Infer.Session;
