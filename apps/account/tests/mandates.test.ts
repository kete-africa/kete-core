import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createLocalJWKSet, decodeJwt, jwtVerify, type JSONWebKeySet } from 'jose';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { issueMandate } from '@/features/apps/mandates';
import { AppApiError } from '@/features/apps/people';
import { auth } from '@/platform/auth';
import { db, getPool } from '@/platform/db';
import { user } from '@/platform/schema';

// Spec 049 (part 3) — the center exchanges a person's token for a mandate its agent carries: the
// same person, never more, an `act` claim naming the agent; only the center may ask.

const run = randomBytes(4).toString('hex');
const BASE = process.env.BETTER_AUTH_URL ?? 'http://localhost:3100';
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });
const api = auth.api as unknown as {
  signUpEmail(input: {
    body: { name: string; email: string; password: string };
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { user: { id: string } } }>;
  createOrganization(input: { body: { name: string; slug: string }; headers: Headers }): Promise<{
    id: string;
  }>;
  adminCreateOAuthClient(input: {
    body: Record<string, unknown>;
    headers: Headers;
  }): Promise<{ client_id: string; client_secret: string }>;
  signJWT(input: { body: { payload: Record<string, unknown> } }): Promise<{ token: string }>;
  getJwks(): Promise<JSONWebKeySet>;
};

let operatorId = '';
let organization = '';
let center = { client_id: '', client_secret: '' };
let other = { client_id: '', client_secret: '' };

async function tokenFor(client: { client_id: string; client_secret: string }, scope: string) {
  const response = await auth.handler(
    new Request(`${BASE}/api/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client.client_id,
        client_secret: client.client_secret,
        scope,
        resource: 'urn:kete:apps',
      }),
    }),
  );
  return ((await response.json()) as { access_token?: string }).access_token ?? '';
}

/** A person's token, as the Compte Kete signs it for her. */
const personToken = async () =>
  (
    await api.signJWT({
      body: {
        payload: {
          sub: 'usr_awa',
          email: 'awa@example.test',
          name: 'Awa',
          org: organization,
          role: 'member',
        },
      },
    })
  ).token;

const ask = (token: string, body: unknown) =>
  issueMandate(
    new Request(`${BASE}/api/apps/mandates`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof AppApiError ? `${error.status} ${error.code}` : String(error);
  }
}

beforeAll(async () => {
  const email = `op.mandate.${run}@example.test`;
  const signUp = await api.signUpEmail({
    body: { name: 'Op', email, password: `pw-${randomBytes(9).toString('hex')}` },
    returnHeaders: true,
  });
  operatorId = signUp.response.user.id;
  const cookie = new Headers({
    cookie: signUp.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
  });
  organization = (
    await api.createOrganization({
      body: { name: `Kete ops ${run}`, slug: `kete-ops-mandate-${run}` },
      headers: cookie,
    })
  ).id;
  process.env.KETE_OPERATORS_ORGANIZATION_ID = organization;
  await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, operatorId));
  const body = (name: string, scopes: string[]) => ({
    client_name: `${name} ${run}`,
    application_type: 'web',
    redirect_uris: ['https://enterprise.example.test/auth/callback'],
    token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
    response_types: ['code'],
    skip_consent: true,
    require_pkce: true,
    client_credentials_scopes: scopes,
  });
  center = await api.adminCreateOAuthClient({
    headers: cookie,
    body: body('Center', ['kete:mandate']),
  });
  other = await api.adminCreateOAuthClient({
    headers: cookie,
    body: body('Other', ['kete:center']),
  });
});

afterAll(async () => {
  await owner.query('delete from oauth_client where client_id = any($1)', [
    [center.client_id, other.client_id],
  ]);
  await owner.query('delete from kete_outbox where organization_id = $1', [organization]);
  await owner.query('delete from organization where id = $1', [organization]);
  await owner.query('delete from "user" where id = $1', [operatorId]);
  await owner.end();
  await getPool().end();
});

describe('an agent’s mandate', () => {
  it('carries the same person, never more, and names the agent and the center', async () => {
    const mandate = await ask(await tokenFor(center, 'kete:mandate'), {
      subjectToken: await personToken(),
      agent: { id: 'agt_briefing', name: 'Briefing du matin' },
    });
    expect(mandate.expiresIn).toBeGreaterThan(0);
    expect(mandate.expiresIn).toBeLessThanOrEqual(600);
    const { payload } = await jwtVerify(mandate.token, createLocalJWKSet(await api.getJwks()), {
      audience: 'urn:kete:apps',
    });
    expect(payload).toMatchObject({
      sub: 'usr_awa',
      org: organization,
      role: 'member',
      act: { sub: 'agt_briefing', name: 'Briefing du matin', client_id: center.client_id },
    });
  });

  it('is refused to anyone but the center, for a mandate, and for a token that is not hers', async () => {
    expect(
      await refusal(
        ask(await tokenFor(other, 'kete:center'), {
          subjectToken: await personToken(),
          agent: { id: 'agt_x', name: 'X' },
        }),
      ),
    ).toBe('403 not_allowed');
    const centerToken = await tokenFor(center, 'kete:mandate');
    const first = await ask(centerToken, {
      subjectToken: await personToken(),
      agent: { id: 'agt_a', name: 'A' },
    });
    expect(decodeJwt(first.token).act).toBeTruthy();
    expect(
      await refusal(
        ask(centerToken, { subjectToken: first.token, agent: { id: 'agt_b', name: 'B' } }),
      ),
    ).toBe('422 invalid_subject');
    expect(
      await refusal(
        ask(centerToken, { subjectToken: 'x'.repeat(40), agent: { id: 'agt_a', name: 'A' } }),
      ),
    ).toBe('422 invalid_subject');
  });
});
