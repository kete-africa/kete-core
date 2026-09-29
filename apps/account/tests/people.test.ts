import { randomBytes } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AppApiError,
  continueSignIn,
  createSignInLink,
  isPlaceholderEmail,
  provisionPerson,
  requireApp,
} from '@/features/apps/people';
import { auth } from '@/platform/auth';
import { db, getPool } from '@/platform/db';
import { member, user } from '@/platform/schema';

// Spec 013 — the Compte Kete by phone number: a trusted app provisions people and asks for their
// one-time sign-in links; nothing else can.

const run = randomBytes(4).toString('hex');
const BASE = process.env.BETTER_AUTH_URL ?? 'http://localhost:3100';
const APP = 'https://firmo.example.test';
const phone = `+2289${String(Date.now()).slice(-7)}`;
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
const cookieOf = (headers: Headers) =>
  new Headers({
    cookie: headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
  });

let operatorId = '';
let operatorsOrg = '';
let trusted = { client_id: '', client_secret: '' };
let plain = { client_id: '', client_secret: '' };
const people: string[] = [];

async function register(name: string) {
  const signUp = await api.signUpEmail({
    body: {
      name: 'Op',
      email: `op.${name}.${run}@example.test`,
      password: `pw-${randomBytes(9).toString('hex')}`,
    },
    returnHeaders: true,
  });
  operatorId ||= signUp.response.user.id;
  return signUp;
}

/** A client_credentials token from the token endpoint, as an app gets it. */
async function tokenFor(
  client: { client_id: string; client_secret: string },
  scope = 'kete:people',
) {
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
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const withToken = (token: string) =>
  new Request(`${BASE}/api/apps/people`, { headers: { authorization: `Bearer ${token}` } });

async function status(promise: Promise<unknown>): Promise<number | string> {
  try {
    await promise;
    return 'ok';
  } catch (error) {
    return error instanceof AppApiError ? error.status : String(error);
  }
}

beforeAll(async () => {
  // An operator (Kete's organization, owner, two-factor) registers two apps.
  const signUp = await register('main');
  const cookie = cookieOf(signUp.headers);
  const org = await api.createOrganization({
    body: { name: `Kete ops ${run}`, slug: `kete-ops-${run}` },
    headers: cookie,
  });
  operatorsOrg = org.id;
  process.env.KETE_OPERATORS_ORGANIZATION_ID = operatorsOrg;
  await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, operatorId));
  const body = (name: string, scopes: string[]) => ({
    client_name: `${name} ${run}`,
    application_type: 'web',
    redirect_uris: [`${APP}/auth/callback`],
    token_endpoint_auth_method: 'client_secret_post',
    grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
    response_types: ['code'],
    skip_consent: true,
    require_pkce: true,
    client_credentials_scopes: scopes,
  });
  trusted = await api.adminCreateOAuthClient({
    headers: cookie,
    body: body('Firmo', ['kete:people']),
  });
  plain = await api.adminCreateOAuthClient({ headers: cookie, body: body('Plain', []) });
});

afterAll(async () => {
  const ids = [...people, operatorId].filter(Boolean);
  const orgs = await db
    .select({ id: member.organizationId })
    .from(member)
    .where(inArray(member.userId, ids));
  await owner.query('delete from kete_outbox where organization_id = any($1)', [
    orgs.map((o) => o.id),
  ]);
  await owner.query('delete from organization where id = any($1)', [orgs.map((o) => o.id)]);
  await owner.query('delete from oauth_client where client_id = any($1)', [
    [trusted.client_id, plain.client_id],
  ]);
  await owner.query('delete from "user" where id = any($1)', [ids]);
  await owner.end();
  await getPool().end();
});

describe('an app provisions people by phone', () => {
  it('gets a client_credentials token only with the scope it was granted', async () => {
    const granted = await tokenFor(trusted);
    expect(granted.status, JSON.stringify(granted.body)).toBe(200);
    expect(await requireApp(withToken(String(granted.body.access_token)))).toMatchObject({
      clientId: trusted.client_id,
      redirectOrigins: [APP],
    });
    expect((await tokenFor(plain)).status).not.toBe(200);
  });

  it("refuses without a token, and with a person's token", async () => {
    expect(await status(requireApp(new Request(`${BASE}/api/apps/people`)))).toBe(401);
    const personal = await (
      auth.api as unknown as {
        signJWT(i: { body: { payload: Record<string, unknown> } }): Promise<{ token: string }>;
      }
    ).signJWT({
      body: { payload: { sub: operatorId, scope: 'kete:people', azp: trusted.client_id } },
    });
    expect(await status(requireApp(withToken(personal.token)))).toBe(403);
  });

  it('creates the person and her organization once; the same number returns them', async () => {
    const first = await provisionPerson({
      phoneNumber: phone,
      name: 'Kodjo',
      organizationName: 'Atelier Kodjo',
    });
    people.push(first.personId);
    expect(first.created).toBe(true);
    const [stored] = await db.select().from(user).where(eq(user.id, first.personId));
    expect(stored?.phoneNumber).toBe(phone);
    expect(isPlaceholderEmail(stored?.email ?? '')).toBe(true);
    const again = await provisionPerson({ phoneNumber: phone });
    expect(again).toEqual({ ...first, created: false });
    expect(await status(provisionPerson({ phoneNumber: '90000000' }))).toBe(422);
  });
});

describe('a one-time sign-in link', () => {
  const app = () => ({ clientId: trusted.client_id, redirectOrigins: [APP] });

  it('refuses a return address outside the app, and a person with a second factor', async () => {
    const [personId] = people;
    expect(
      await status(
        createSignInLink(app(), { personId: personId ?? '', returnTo: 'https://evil.test/x' }),
      ),
    ).toBe(422);
    expect(
      await status(createSignInLink(app(), { personId: operatorId, returnTo: `${APP}/x` })),
    ).toBe(404);
  });

  it('signs her in once, replacing any session, and lands on the app', async () => {
    const [personId] = people;
    const { url } = await createSignInLink(app(), {
      personId: personId ?? '',
      returnTo: `${APP}/auth/connexion`,
    });
    const target = new URL(url);
    expect(target.origin).toBe(new URL(BASE).origin);

    // Opening the link: Better Auth signs her in and sends her to /api/apps/continue.
    const verified = await auth.handler(
      new Request(url, { headers: { cookie: 'better-auth.session_token=someone-else' } }),
    );
    expect(verified.status).toBe(302);
    const next = new URL(verified.headers.get('location') ?? '', BASE);
    expect(next.pathname).toBe('/api/apps/continue');
    const landed = await continueSignIn(new Request(next, { headers: cookieOf(verified.headers) }));
    expect(landed.headers.get('location')).toBe(`${APP}/auth/connexion`);

    // Used: neither the magic link nor the continuation works twice.
    const replay = await auth.handler(new Request(url));
    expect(replay.headers.get('location') ?? '').not.toContain('/api/apps/continue');
    const second = await continueSignIn(new Request(next, { headers: cookieOf(verified.headers) }));
    expect(second.headers.get('location')).toBe('/connexion?lien=expire');
  });
});
