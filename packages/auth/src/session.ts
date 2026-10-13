import { SignJWT } from 'jose';
import { planToClaim } from './plans.js';
import type { KeteIdentity } from './verify.js';

// An app's own session (spec 093): the cookie its sign-in writes once the Compte Kete answered,
// signed with the app's session secret. The sign-in writes it; a browser test writes the same, so
// that a test signs a person in without a Compte Kete.

/** The person a session is written for: who she is, her organization and role, her offers. */
export type SessionPerson = Pick<
  KeteIdentity,
  'userId' | 'email' | 'name' | 'organizationId' | 'role'
> &
  Partial<Pick<KeteIdentity, 'apps' | 'plans' | 'twoFactor'>>;

/** The value of the session cookie for a person, valid `seconds`. */
export async function signSession(
  sessionSecret: string,
  person: SessionPerson,
  options: { seconds?: number; accessToken?: string } = {},
): Promise<string> {
  if (sessionSecret.length < 32) throw new Error('sessionSecret: at least 32 characters');
  return new SignJWT({
    email: person.email,
    name: person.name,
    org: person.organizationId,
    role: person.role,
    apps: Object.fromEntries(
      Object.entries(person.apps ?? {}).map(([app, until]) => [app, until.toISOString()]),
    ),
    ...(person.plans
      ? {
          plans: Object.fromEntries(
            Object.entries(person.plans).map(([app, plan]) => [app, planToClaim(plan)]),
          ),
        }
      : {}),
    two_factor: person.twoFactor === true,
    ...(options.accessToken ? { at: options.accessToken } : {}),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(person.userId)
    .setIssuedAt()
    .setExpirationTime(`${options.seconds ?? 3600}s`)
    .sign(new TextEncoder().encode(sessionSecret));
}
