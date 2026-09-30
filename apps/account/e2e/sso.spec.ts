import { createHmac, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { expect, test } from '@playwright/test';
import pg from 'pg';
import { createKeteSignIn, type KeteSignIn } from '@kete/auth';

// Spec 007: a Kete app signs people in with the Compte Kete. A witness app (a few lines on
// @kete/auth) is registered by an operator with two-factor on, then used in a real browser.

const ACCOUNT = 'http://localhost:3200';
/** Set as KETE_OPERATORS_ORGANIZATION_ID on the Compte Kete started for the tests. */
const OPERATORS = 'org_e2e_operators';
const APP_PORT = 3399;
const APP = `http://127.0.0.1:${APP_PORT}`;
const run = randomBytes(4).toString('hex');
const password = `e2e-${randomBytes(9).toString('base64url')}`;

test.describe.configure({ mode: 'serial' });
test.skip(Boolean(process.env.ACCOUNT_E2E_BASE_URL), 'registers a local witness app');

/** RFC 6238 time-based code from a base32 secret, as an authenticator app computes it. */
function totp(secret: string, at = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0');
  }
  const key = Buffer.from(bits.match(/.{8}/g)?.map((byte) => parseInt(byte, 2)) ?? []);
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 1000 / 30)));
  const hmac = createHmac('sha1', key).update(counter).digest();
  const offset = (hmac[hmac.length - 1] ?? 0) & 0xf;
  const value = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(value).padStart(6, '0');
}

/** Calls the Compte Kete's own API as a browser would, keeping cookies. */
function client() {
  const jar = new Map<string, string>();
  const call = async (path: string, body?: unknown) => {
    const response = await fetch(`${ACCOUNT}/api/auth${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ACCOUNT,
        cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; '),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';');
      const index = pair?.indexOf('=') ?? -1;
      if (pair && index > 0) jar.set(pair.slice(0, index), pair.slice(index + 1));
    }
    return {
      status: response.status,
      json: (await response.json().catch(() => null)) as Record<string, unknown>,
    };
  };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  return Object.assign(call, { cookie });
}

let signIn: KeteSignIn;
let server: Server;
let clientId = '';

test.beforeAll(async () => {
  // An operator: owner of the test operators organization, two-factor on.
  const operator = client();
  const email = `operator.${run}@example.test`;
  const signUp = await operator('/sign-up/email', { name: 'Operator', email, password });
  expect(signUp.status).toBe(200);
  const userId = String((signUp.json.user as { id: string }).id);
  const enabled = await operator('/two-factor/enable', { password });
  const secret = new URL(String(enabled.json.totpURI)).searchParams.get('secret') ?? '';
  expect((await operator('/two-factor/verify-totp', { code: totp(secret) })).status).toBe(200);
  const db = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_APP_URL, max: 1 });
  try {
    await db.query(
      `insert into organization (id, name, slug, created_at) values ($1, 'Kete (e2e)', $1, now())
       on conflict (id) do nothing`,
      [OPERATORS],
    );
    await db.query(
      `insert into member (id, organization_id, user_id, role, created_at)
       values ($1, $2, $3, 'owner', now())`,
      [`mbr_e2e_${run}`, OPERATORS, userId],
    );
  } finally {
    await db.end();
  }

  // Registering an app is server-only (never exposed over HTTP): done in-process, as the
  // operators' script does, with the operator's session.
  Object.assign(process.env, {
    ACCOUNT_DATABASE_URL: process.env.ACCOUNT_TEST_APP_URL,
    BETTER_AUTH_SECRET: process.env.ACCOUNT_TEST_AUTH_SECRET,
    BETTER_AUTH_URL: ACCOUNT,
    KETE_OPERATORS_ORGANIZATION_ID: OPERATORS,
  });
  const { auth } = await import('../src/platform/auth');
  const api = auth.api as unknown as {
    adminCreateOAuthClient(input: {
      body: Record<string, unknown>;
      headers: Headers;
    }): Promise<Record<string, unknown>>;
  };
  const registered = await api
    .adminCreateOAuthClient({
      headers: new Headers({ cookie: operator.cookie() }),
      body: {
        client_name: `Witness ${run}`,
        // A local http address is only allowed for "native" clients; real apps are https "web".
        application_type: 'native',
        redirect_uris: [`${APP}/auth/callback`],
        token_endpoint_auth_method: 'client_secret_post',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        skip_consent: true,
        require_pkce: true,
      },
    })
    .catch((error: { status?: unknown; body?: unknown; statusCode?: unknown }) => {
      throw new Error(
        `registration refused: ${String(error.statusCode)} ${JSON.stringify(error.body)} cookies=${operator.cookie().replace(/=[^;]+/g, '=…')}`,
      );
    });
  const created = { status: 201, json: registered };
  expect(created.status, JSON.stringify(created.json)).toBe(201);
  clientId = String(created.json.client_id);

  signIn = createKeteSignIn({
    accountUrl: ACCOUNT,
    clientId,
    clientSecret: String(created.json.client_secret),
    redirectUri: `${APP}/auth/callback`,
    sessionSecret: randomBytes(32).toString('hex'),
  });
  server = createServer(async (req, res) => {
    const request = new Request(`${APP}${req.url}`, {
      headers: Object.entries(req.headers).flatMap(([k, v]) =>
        typeof v === 'string' ? [[k, v] as [string, string]] : [],
      ),
    });
    const path = new URL(request.url).pathname;
    let response: Response;
    if (path === '/auth/callback') {
      response = await signIn
        .callback(request)
        .catch((error: Error) => new Response(`sign-in failed: ${error.message}`, { status: 400 }));
    } else {
      const identity = await signIn.session(request);
      response = identity
        ? Response.json(identity)
        : await signIn.start(request, { returnTo: path });
    }
    const headers: Record<string, string | string[]> = Object.fromEntries(
      [...response.headers].filter(([k]) => k !== 'set-cookie'),
    );
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) headers['set-cookie'] = cookies;
    res.writeHead(response.status, headers);
    res.end(await response.text());
  });
  await new Promise<void>((resolve) => server.listen(APP_PORT, resolve));
});

test.afterAll(async () => {
  await new Promise((resolve) => server?.close(resolve));
});

test('a person not signed in signs in on the Compte Kete and comes back to the app', async ({
  page,
}) => {
  const email = `sso.${run}@example.test`;
  await page.goto(`${APP}/tableau`);
  await page.waitForURL(`${ACCOUNT}/connexion**`);
  await page.getByRole('link', { name: 'Créer un compte' }).click();
  await page.getByLabel('Votre nom').fill('Sso Person');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();

  await page.waitForURL(`${APP}/tableau`);
  const identity = JSON.parse((await page.locator('body').textContent()) ?? '{}') as Record<
    string,
    unknown
  >;
  expect(identity).toMatchObject({
    email,
    name: 'Sso Person',
    organizationId: null,
    twoFactor: false,
  });
  expect(String(identity.userId)).toMatch(/^usr_/);
});

test('a person already signed in enters the app without a password, with organization and role', async ({
  page,
}) => {
  const email = `owner.sso.${run}@example.test`;
  await page.goto(`${ACCOUNT}/inscription`);
  await page.getByLabel('Votre nom').fill('Sso Owner');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await page.waitForURL('**/espace/nouvelle-organisation');
  await page.getByLabel("Nom de l'organisation").fill(`Atelier ${run}`);
  await page.getByRole('button', { name: "Créer l'organisation" }).click();
  await page.waitForURL('**/espace');

  await page.goto(`${APP}/`);
  await page.waitForURL(`${APP}/`);
  const identity = JSON.parse((await page.locator('body').textContent()) ?? '{}') as Record<
    string,
    unknown
  >;
  expect(identity).toMatchObject({ email, role: 'owner' });
  expect(String(identity.organizationId)).toMatch(/^org_/);
});

test('the Compte Kete refuses to send a sign-in to an address that is not registered', async ({
  page,
}) => {
  const url = new URL(`${ACCOUNT}/api/auth/oauth2/authorize`);
  url.search = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: `${APP}/somewhere-else`,
    scope: 'openid',
    state: 'x',
    code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    code_challenge_method: 'S256',
  }).toString();
  await page.goto(url.toString());
  expect(page.url().startsWith(`${APP}/somewhere-else`)).toBe(false);
});

test("the admin API answers only operators: no token 401, a client's token 403", async ({
  page,
  request,
}) => {
  expect((await request.get(`${ACCOUNT}/api/admin/offers`)).status()).toBe(401);
  await page.goto(`${ACCOUNT}/connexion`);
  await page.getByLabel('Adresse e-mail').fill(`owner.sso.${run}@example.test`);
  await page.getByLabel('Mot de passe').fill(password);
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await page.waitForURL('**/espace');
  const { token } = (await (await page.request.get(`${ACCOUNT}/api/auth/token`)).json()) as {
    token: string;
  };
  const refused = await request.post(`${ACCOUNT}/api/admin/offers`, {
    headers: { authorization: `Bearer ${token}` },
    data: { action: 'disable', productId: 'prd_anything' },
  });
  expect(refused.status()).toBe(403);
});
