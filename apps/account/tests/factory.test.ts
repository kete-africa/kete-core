import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { registerAppForFactory } from '@/features/apps/factory';
import { AppApiError } from '@/features/apps/people';
import { auth } from '@/platform/auth';
import { db, getPool } from '@/platform/db';
import { user } from '@/platform/schema';

// Spec 048 — the app factory registers the apps it creates; nothing else can, and only on the
// hosts allowed.

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
};

let operatorId = '';
let organization = '';
let factory = { client_id: '', client_secret: '' };
let people = { client_id: '', client_secret: '' };
const created: string[] = [];

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

const ask = (token: string, body: unknown) =>
  registerAppForFactory(
    new Request(`${BASE}/api/apps/clients`, {
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
  const email = `op.factory.${run}@example.test`;
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
      body: { name: `Kete ops ${run}`, slug: `kete-ops-factory-${run}` },
      headers: cookie,
    })
  ).id;
  process.env.KETE_OPERATORS_ORGANIZATION_ID = organization;
  await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, operatorId));
  const body = (name: string, scopes: string[]) => ({
    client_name: `${name} ${run}`,
    application_type: 'web',
    redirect_uris: ['https://factory.example.test/auth/callback'],
    token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
    response_types: ['code'],
    skip_consent: true,
    require_pkce: true,
    client_credentials_scopes: scopes,
  });
  factory = await api.adminCreateOAuthClient({
    headers: cookie,
    body: body('Factory', ['kete:factory']),
  });
  people = await api.adminCreateOAuthClient({
    headers: cookie,
    body: body('People', ['kete:people']),
  });
  process.env.KETE_FACTORY_OPERATOR = email;
  process.env.KETE_FACTORY_HOSTS = '.apps.example.test';
});

afterAll(async () => {
  await owner.query('delete from oauth_client where client_id = any($1)', [
    [factory.client_id, people.client_id, ...created],
  ]);
  await owner.query('delete from kete_outbox where organization_id = $1', [organization]);
  await owner.query('delete from organization where id = $1', [organization]);
  await owner.query('delete from "user" where id = $1', [operatorId]);
  await owner.end();
  await getPool().end();
});

describe('the app factory registers the apps it creates', () => {
  it('registers a trusted app on an allowed host, its secret given once', async () => {
    const token = await tokenFor(factory, 'kete:factory');
    const client = await ask(token, {
      name: `Fieldwork ${run}`,
      redirectUri: 'https://fieldwork.apps.example.test/auth/callback',
    });
    created.push(client.clientId);
    expect(client.clientId).toBeTruthy();
    expect(client.clientSecret).toBeTruthy();
  });

  it('refuses another host, a plain http callback, and a malformed request', async () => {
    const token = await tokenFor(factory, 'kete:factory');
    expect(
      await refusal(ask(token, { name: 'x', redirectUri: 'https://evil.example.test/cb' })),
    ).toBe('403 host_not_allowed');
    expect(
      await refusal(ask(token, { name: 'x', redirectUri: 'http://a.apps.example.test/cb' })),
    ).toBe('422 invalid_input');
    expect(await refusal(ask(token, { name: '' }))).toBe('422 invalid_input');
  });

  it('refuses any app but the factory, and a factory without its configuration', async () => {
    const other = await tokenFor(people, 'kete:people');
    expect(
      await refusal(ask(other, { name: 'x', redirectUri: 'https://a.apps.example.test/cb' })),
    ).toBe('403 not_allowed');
    process.env.KETE_FACTORY_HOSTS = '';
    const token = await tokenFor(factory, 'kete:factory');
    expect(
      await refusal(ask(token, { name: 'x', redirectUri: 'https://a.apps.example.test/cb' })),
    ).toBe('403 not_configured');
    process.env.KETE_FACTORY_HOSTS = '.apps.example.test';
  });
});
