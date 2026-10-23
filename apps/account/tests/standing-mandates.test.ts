import { randomBytes } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { createLocalJWKSet, jwtVerify, type JSONWebKeySet } from 'jose';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppApiError } from '@/features/apps/people';
import {
  grantStandingMandate,
  readMyStandingMandates,
  revokeMyStandingMandate,
  revokeStandingMandate,
  useStandingMandate,
} from '@/features/apps/standing-mandates';
import { auth } from '@/platform/auth';
import { db, getPool } from '@/platform/db';
import { member, user } from '@/platform/schema';

// Spec 150 — a standing mandate: a person lets one of the center's agents act for her while she is
// away. Given once with her token; each use signs her claims as they are now; withdrawn, or she no
// longer a member, nothing more is signed; only the client it was given to may use it.

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
const awa = { id: `usr_smd_awa_${run}`, email: `awa.smd.${run}@example.test`, name: 'Awa' };
let center = { client_id: '', client_secret: '' };
let second = { client_id: '', client_secret: '' };

async function tokenFor(client: { client_id: string; client_secret: string }) {
  const response = await auth.handler(
    new Request(`${BASE}/api/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: client.client_id,
        client_secret: client.client_secret,
        scope: 'kete:mandate',
        resource: 'urn:kete:apps',
      }),
    }),
  );
  return ((await response.json()) as { access_token?: string }).access_token ?? '';
}

/** Awa's own token, as the Compte Kete signs it for her. */
const awaToken = async () =>
  (
    await api.signJWT({
      body: {
        payload: {
          sub: awa.id,
          email: awa.email,
          name: awa.name,
          org: organization,
          role: 'member',
        },
      },
    })
  ).token;

const post = (path: string, token: string, body: unknown) =>
  new Request(`${BASE}/api/apps/standing-mandates${path}`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

async function refusal(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof AppApiError ? `${error.status} ${error.code}` : String(error);
  }
}

beforeAll(async () => {
  const signUp = await api.signUpEmail({
    body: {
      name: 'Op',
      email: `op.smd.${run}@example.test`,
      password: `pw-${randomBytes(9).toString('hex')}`,
    },
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
      body: { name: `Kete ops ${run}`, slug: `kete-ops-smd-${run}` },
      headers: cookie,
    })
  ).id;
  process.env.KETE_OPERATORS_ORGANIZATION_ID = organization;
  await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, operatorId));
  const now = new Date();
  await db.insert(user).values({ ...awa, emailVerified: true, createdAt: now, updatedAt: now });
  await db.insert(member).values({
    id: `mbr_smd_${run}`,
    organizationId: organization,
    userId: awa.id,
    role: 'member',
    createdAt: now,
  });
  const body = (name: string) => ({
    client_name: `${name} ${run}`,
    application_type: 'web',
    redirect_uris: ['https://enterprise.example.test/auth/callback'],
    token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
    response_types: ['code'],
    skip_consent: true,
    require_pkce: true,
    client_credentials_scopes: ['kete:mandate'],
  });
  center = await api.adminCreateOAuthClient({ headers: cookie, body: body('Center') });
  second = await api.adminCreateOAuthClient({ headers: cookie, body: body('Second center') });
});

afterAll(async () => {
  await owner.query('delete from oauth_client where client_id = any($1)', [
    [center.client_id, second.client_id],
  ]);
  await owner.query('delete from kete_outbox where organization_id = $1', [organization]);
  await owner.query('delete from organization where id = $1', [organization]);
  await owner.query('delete from "user" where id = any($1)', [[operatorId, awa.id]]);
  await owner.end();
  await getPool().end();
});

describe('a standing mandate', () => {
  it('is given once with her token, then signs her claims as they are now, for the agent', async () => {
    const centerToken = await tokenFor(center);
    const agent = { id: 'agt_parc', name: 'Agent Parc' };
    const { grant } = await grantStandingMandate(
      post('', centerToken, { subjectToken: await awaToken(), agent }),
    );
    // Given again, the same grant is renewed.
    const again = await grantStandingMandate(
      post('', centerToken, { subjectToken: await awaToken(), agent }),
    );
    expect(again.grant).toBe(grant);
    // Her role changed since: the mandate says so, never what her old token said.
    await db
      .update(member)
      .set({ role: 'admin' })
      .where(and(eq(member.userId, awa.id), eq(member.organizationId, organization)));
    const mandate = await useStandingMandate(post('/token', centerToken, { organization, grant }));
    expect(mandate.expiresIn).toBeLessThanOrEqual(600);
    const { payload } = await jwtVerify(mandate.token, createLocalJWKSet(await api.getJwks()), {
      audience: 'urn:kete:apps',
    });
    expect(payload).toMatchObject({
      sub: awa.id,
      email: awa.email,
      org: organization,
      role: 'admin',
      act: { sub: 'agt_parc', name: 'Agent Parc', client_id: center.client_id },
    });
    const mine = await readMyStandingMandates(organization, awa.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: grant, agentName: 'Agent Parc' });
    expect(mine[0]?.lastUsedAt).not.toBeNull();
  });

  it('is used only by the client it was given to, and stops once she withdraws it', async () => {
    const centerToken = await tokenFor(center);
    const { grant } = await grantStandingMandate(
      post('', centerToken, {
        subjectToken: await awaToken(),
        agent: { id: 'agt_indicateurs', name: 'Agent Indicateurs' },
      }),
    );
    expect(
      await refusal(
        useStandingMandate(post('/token', await tokenFor(second), { organization, grant })),
      ),
    ).toBe('404 no_mandate');
    // Someone else cannot withdraw it for her.
    expect(await revokeMyStandingMandate(organization, operatorId, grant)).toBe(false);
    expect(await revokeMyStandingMandate(organization, awa.id, grant)).toBe(true);
    expect(
      await refusal(useStandingMandate(post('/token', centerToken, { organization, grant }))),
    ).toBe('404 no_mandate');
    expect((await readMyStandingMandates(organization, awa.id)).map((g) => g.id)).not.toContain(
      grant,
    );
  });

  it('is withdrawn by the center, and goes with her when she leaves', async () => {
    const centerToken = await tokenFor(center);
    const first = await grantStandingMandate(
      post('', centerToken, {
        subjectToken: await awaToken(),
        agent: { id: 'agt_relances', name: 'Relances' },
      }),
    );
    await revokeStandingMandate(post('/revoke', centerToken, { organization, grant: first.grant }));
    expect(
      await refusal(
        useStandingMandate(post('/token', centerToken, { organization, grant: first.grant })),
      ),
    ).toBe('404 no_mandate');
    const { grant } = await grantStandingMandate(
      post('', centerToken, {
        subjectToken: await awaToken(),
        agent: { id: 'agt_veille', name: 'Veille' },
      }),
    );
    await db.delete(member).where(eq(member.userId, awa.id));
    expect(
      await refusal(useStandingMandate(post('/token', centerToken, { organization, grant }))),
    ).toBe('403 not_a_member');
  });
});
