import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
import { z } from 'zod';
import { KETE_APPS_AUDIENCE } from '@kete/identity';
import { auth, MANDATE_SCOPE } from '@/platform/auth';
import { env } from '@/platform/env';
import { AppApiError, requireApp } from './people';

/**
 * Spec 049 (part 3) — an agent's mandate. The center (Kete Enterprise, scope `kete:mandate`)
 * exchanges a person's token for one its agent carries to an app (RFC 8693): the same person, her
 * same claims — never more — and an `act` claim naming the agent and the center. Ten minutes at
 * most, and never beyond the person's own token. A mandate is not exchanged again.
 */
export const mandateInput = z.object({
  subjectToken: z.string().min(20).max(8000),
  agent: z.object({
    id: z.string().regex(/^agt_[\w-]{1,64}$/),
    name: z.string().trim().min(1).max(120),
  }),
});

export const MANDATE_SECONDS = 600;

const api = auth.api as unknown as {
  getJwks(): Promise<JSONWebKeySet>;
  signJWT(input: {
    body: { payload: Record<string, unknown>; overrideOptions?: Record<string, unknown> };
  }): Promise<{ token: string }>;
};

/** The claims of a person's token the mandate carries: the same, nothing added. */
const carried = ['sub', 'email', 'name', 'org', 'role', 'apps', 'two_factor'] as const;

/** The person behind a token the Compte Kete signed: never a mandate, always in an organization. */
export async function personOf(subjectToken: string): Promise<Record<string, unknown>> {
  let person: Record<string, unknown>;
  try {
    ({ payload: person } = await jwtVerify(subjectToken, createLocalJWKSet(await api.getJwks()), {
      issuer: env.publicUrl,
      audience: KETE_APPS_AUDIENCE,
      requiredClaims: ['sub', 'exp'],
    }));
  } catch {
    throw new AppApiError(422, 'invalid_subject');
  }
  // A person's token only, in an organization; a mandate is not exchanged again.
  if (
    person.act !== undefined ||
    typeof person.org !== 'string' ||
    typeof person.email !== 'string'
  ) {
    throw new AppApiError(422, 'invalid_subject');
  }
  return person;
}

/** Signs a mandate: the person's claims, the agent and the center in `act`, until `expiresAt`. */
export async function signMandate(
  claims: Record<string, unknown>,
  act: { agent: { id: string; name: string }; clientId: string },
  expiresAt: number,
): Promise<{ token: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = {};
  for (const claim of carried) if (claims[claim] !== undefined) payload[claim] = claims[claim];
  payload.act = { sub: act.agent.id, name: act.agent.name, client_id: act.clientId };
  const { token } = await api.signJWT({
    body: {
      payload,
      // The same issuer and audience as every token of the Compte Kete; its own end.
      overrideOptions: {
        jwt: { issuer: env.publicUrl, audience: KETE_APPS_AUDIENCE, expirationTime: expiresAt },
      },
    },
  });
  return { token, expiresIn: Math.max(0, expiresAt - now) };
}

export async function issueMandate(
  request: Request,
): Promise<{ token: string; expiresIn: number }> {
  const center = await requireApp(request, MANDATE_SCOPE);
  const parsed = mandateInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppApiError(422, 'invalid_input');
  const person = await personOf(parsed.data.subjectToken);
  const now = Math.floor(Date.now() / 1000);
  return signMandate(
    person,
    { agent: parsed.data.agent, clientId: center.clientId },
    Math.min(now + MANDATE_SECONDS, person.exp as number),
  );
}
