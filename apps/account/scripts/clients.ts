/**
 * Kete apps allowed to sign people in with the Compte Kete (spec 007), for operators.
 *
 *   OPERATOR_PASSWORD=… pnpm clients create --operator me@kete.africa [--code 123456]
 *     --name "Kete Cockpit" --redirect https://cockpit…/auth/callback
 *   pnpm clients list
 *
 * Only a Kete operator (owner or admin of Kete's organization, two-factor on) may register an app:
 * the script signs in as one — the password comes from the environment, never from arguments.
 * A created app is trusted (no consent screen) and needs PKCE; its secret is printed ONCE — store
 * it with the app's other secrets, never in a repository. Needs the service's own environment
 * (ACCOUNT_DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, KETE_OPERATORS_ORGANIZATION_ID).
 */
import { parseArgs } from 'node:util';
import { auth } from '../src/platform/auth';
import { getPool } from '../src/platform/db';

interface CreatedClient {
  client_id: string;
  client_secret?: string;
  client_name?: string;
  redirect_uris: string[];
}

// The OAuth plugin's endpoints are not in the inferred API type (see src/platform/oauth.ts).
const api = auth.api as unknown as {
  adminCreateOAuthClient(input: {
    body: Record<string, unknown>;
    headers: Headers;
  }): Promise<CreatedClient>;
  signInEmail(input: {
    body: { email: string; password: string };
    returnHeaders: true;
  }): Promise<{ headers: Headers; response: { twoFactorRedirect?: boolean } }>;
  verifyTOTP(input: {
    body: { code: string };
    headers: Headers;
    returnHeaders: true;
  }): Promise<{ headers: Headers }>;
};

/** The cookies a response sets, as a request's Cookie header. */
function cookieHeader(headers: Headers): Headers {
  const pairs = headers.getSetCookie().map((cookie) => cookie.split(';')[0]);
  return new Headers({ cookie: pairs.join('; ') });
}

/** Signs in as the operator; the second factor when the account has one. */
async function operatorSession(email: string, code: string | undefined): Promise<Headers> {
  const password = process.env.OPERATOR_PASSWORD;
  if (!password) throw new Error('OPERATOR_PASSWORD is not set.');
  const signIn = await api.signInEmail({ body: { email, password }, returnHeaders: true });
  if (!signIn.response.twoFactorRedirect) return cookieHeader(signIn.headers);
  if (!code) throw new Error('This operator uses two-factor authentication: pass --code.');
  const verified = await api.verifyTOTP({
    body: { code },
    headers: cookieHeader(signIn.headers),
    returnHeaders: true,
  });
  return cookieHeader(verified.headers);
}

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    redirect: { type: 'string', multiple: true },
    operator: { type: 'string' },
    code: { type: 'string' },
  },
});

try {
  if (positionals[0] === 'create') {
    const redirects = values.redirect ?? [];
    if (!values.name || redirects.length === 0)
      throw new Error('--name and --redirect are required');
    // Real apps: https addresses ("web"). A developer's machine: http on 127.0.0.1 only
    // ("native", the only kind the provider allows on a loopback address).
    const local = redirects.every((uri) => new URL(uri).hostname === '127.0.0.1');
    for (const uri of redirects) {
      if (!local && new URL(uri).protocol !== 'https:') throw new Error(`${uri}: https only`);
    }
    if (!values.operator) throw new Error('--operator is required');
    const headers = await operatorSession(values.operator, values.code);
    const client = await api.adminCreateOAuthClient({
      headers,
      body: {
        client_name: values.name,
        application_type: local ? 'native' : 'web',
        redirect_uris: redirects,
        token_endpoint_auth_method: 'client_secret_post',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        skip_consent: true,
        require_pkce: true,
      },
    });
    console.log(JSON.stringify(client, null, 2));
  } else if (positionals[0] === 'list') {
    const { rows } = await getPool().query(
      'select client_id, name, redirect_uris, skip_consent, disabled from oauth_client order by created_at',
    );
    console.table(rows);
  } else {
    throw new Error('Usage: clients create --name --redirect [--redirect …] | list');
  }
} finally {
  await getPool().end();
}
