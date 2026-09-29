/**
 * Makes the author the first Kete operator of the staging Compte Kete and connects Kete Cockpit
 * and Firmo to it — in one command, after they have, in a browser: signed up on the staging Compte Kete,
 * created the organization « Kete », and turned on two-factor authentication.
 *
 *   pnpm --filter @kete/account staging:operator
 *
 * Asks the operator's e-mail, password and code on the terminal (never stored, never printed).
 * Reads the staging configuration from kete-core/.env and the hosting token from the author's
 * secrets file; the client secrets of the Cockpit and Firmo go straight to the hosting
 * environment.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const rootEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
const hostingEnv = fileURLToPath(
  new URL('../../../../../.secrets/atelier-admin.env', import.meta.url),
);
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
if (existsSync(hostingEnv)) process.loadEnvFile(hostingEnv);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

// The staging Compte Kete, in this process.
Object.assign(process.env, {
  ACCOUNT_DATABASE_URL: required('ACCOUNT_DEV_APP_URL'),
  BETTER_AUTH_SECRET: required('ACCOUNT_STAGING_AUTH_SECRET'),
  BETTER_AUTH_URL: required('ACCOUNT_STAGING_URL'),
});
const cockpitUrl = required('COCKPIT_STAGING_URL');
const accountApp = 'lhu4zeod5dbf19tcjfqmhd00';
const cockpitApp = required('COCKPIT_STAGING_COOLIFY_APP');
// Firmo staging (kete-africa/firmo, docs/OPERATIONS.md there).
const firmoUrl = 'https://firmo-staging.13.140.178.49.sslip.io';
const firmoApp = 'tzhsp5ehomtd4bpmgjkvcgr7';

function ask(question: string, hidden = false): Promise<string> {
  const ENTER = [10, 13];
  const BACKSPACE = [8, 127];
  return new Promise((resolve) => {
    const input = process.stdin;
    process.stdout.write(question);
    if (!hidden || !input.isTTY) {
      input.once('data', (chunk) => resolve(String(chunk).trim()));
      return;
    }
    input.setRawMode(true);
    let answer = '';
    const onData = (chunk: Buffer) => {
      for (const char of chunk.toString('utf8')) {
        const code = char.charCodeAt(0);
        if (ENTER.includes(code)) {
          input.setRawMode(false);
          input.off('data', onData);
          input.pause();
          process.stdout.write(String.fromCharCode(10));
          resolve(answer);
          return;
        }
        if (code === 3) process.exit(130);
        answer = BACKSPACE.includes(code) ? answer.slice(0, -1) : answer + char;
      }
    };
    input.resume();
    input.on('data', onData);
  });
}

async function hosting(method: string, path: string, body?: unknown): Promise<unknown> {
  const base = required('COOLIFY_URL').replace(/\/$/, '');
  const response = await fetch(`${base}/api/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${required('COOLIFY_API_TOKEN')}`,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) throw new Error(`hosting ${method} ${path}: ${response.status}`);
  return response.json().catch(() => null);
}

/** Sets runtime-only variables on a hosted application (never available at build time). */
async function setEnv(app: string, values: Record<string, string>): Promise<void> {
  const existing = (await hosting('GET', `/applications/${app}/envs`)) as {
    uuid: string;
    key: string;
  }[];
  for (const [key, value] of Object.entries(values)) {
    for (const old of existing.filter((e) => e.key === key)) {
      await hosting('DELETE', `/applications/${app}/envs/${old.uuid}`);
    }
    await hosting('POST', `/applications/${app}/envs`, {
      key,
      value,
      is_literal: true,
      is_preview: false,
    });
  }
  const created = (await hosting('GET', `/applications/${app}/envs`)) as {
    uuid: string;
    key: string;
    value: string;
    is_preview: boolean;
  }[];
  for (const env of created.filter((e) => e.key in values)) {
    if (env.is_preview) await hosting('DELETE', `/applications/${app}/envs/${env.uuid}`);
    else {
      await hosting('PATCH', `/applications/${app}/envs`, {
        key: env.key,
        value: env.value,
        is_literal: true,
        is_buildtime: false,
      });
    }
  }
}

const { auth } = await import('../src/platform/auth');
const { getPool } = await import('../src/platform/db');
const api = auth.api as unknown as {
  signInEmail(input: { body: { email: string; password: string }; returnHeaders: true }): Promise<{
    headers: Headers;
    response: { twoFactorRedirect?: boolean; user?: { id: string } };
  }>;
  verifyTOTP(input: {
    body: { code: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { user?: { id: string } } }>;
  adminCreateOAuthClient(input: {
    body: Record<string, unknown>;
    headers: Headers;
  }): Promise<{ client_id: string; client_secret: string }>;
};
const cookies = (headers: Headers) =>
  new Headers({
    cookie: headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; '),
  });

try {
  const email = await ask('E-mail of your staging Compte Kete: ');
  const password = await ask('Password: ', true);
  const signIn = await api.signInEmail({ body: { email, password }, returnHeaders: true });
  if (!signIn.response.twoFactorRedirect) {
    throw new Error('Turn on two-factor authentication first (Mon espace Kete → Sécurité).');
  }
  const code = await ask('Code from your authenticator app: ');
  const verified = await api.verifyTOTP({
    body: { code },
    headers: cookies(signIn.headers),
    returnHeaders: true,
  });
  const session = cookies(verified.headers);

  const { rows } = await getPool().query<{ id: string }>(
    `select o.id from organization o join member m on m.organization_id = o.id
       join "user" u on u.id = m.user_id
      where u.email = $1 and o.name = 'Kete' and m.role = 'owner'`,
    [email],
  );
  if (rows.length !== 1) throw new Error('Create the organization « Kete » first, as its owner.');
  const operators = rows[0]?.id ?? '';
  process.env.KETE_OPERATORS_ORGANIZATION_ID = operators;

  const client = await api.adminCreateOAuthClient({
    headers: session,
    body: {
      client_name: 'Kete Cockpit (staging)',
      application_type: 'web',
      redirect_uris: [`${cockpitUrl}/auth/callback`],
      token_endpoint_auth_method: 'client_secret_post',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      skip_consent: true,
      require_pkce: true,
    },
  });

  // Firmo provisions people by the phone number its channel proved (spec 013).
  const firmo = await api.adminCreateOAuthClient({
    headers: session,
    body: {
      client_name: 'Firmo (staging)',
      application_type: 'web',
      redirect_uris: [`${firmoUrl}/auth/callback`],
      token_endpoint_auth_method: 'client_secret_post',
      grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
      response_types: ['code'],
      skip_consent: true,
      require_pkce: true,
      client_credentials_scopes: ['kete:people'],
    },
  });

  await setEnv(accountApp, { KETE_OPERATORS_ORGANIZATION_ID: operators });
  await setEnv(cockpitApp, {
    KETE_OPERATORS_ORGANIZATION_ID: operators,
    COCKPIT_CLIENT_ID: client.client_id,
    COCKPIT_CLIENT_SECRET: client.client_secret,
  });
  await setEnv(firmoApp, {
    KETE_OPERATORS_ORGANIZATION_ID: operators,
    FIRMO_CLIENT_ID: firmo.client_id,
    FIRMO_CLIENT_SECRET: firmo.client_secret,
  });
  for (const uuid of [accountApp, cockpitApp, firmoApp]) {
    await hosting('POST', '/deploy', { uuid });
  }
  console.log(
    `Done. You are a Kete operator; the Cockpit and Firmo are registered, the three apps are\n` +
      `redeploying. In a few minutes: ${cockpitUrl} and ${firmoUrl}/operations`,
  );
} finally {
  await getPool().end();
}
