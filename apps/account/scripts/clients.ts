/**
 * Kete apps allowed to sign people in with the Compte Kete (spec 007), for operators.
 *
 *   pnpm clients create --operator me@kete.africa --name "Kete Cockpit"
 *     --redirect https://cockpit…/auth/callback
 *   pnpm clients create … --people    (the app may provision people by phone — spec 013)
 *   pnpm clients list
 *
 * Only a Kete operator (owner or admin of Kete's organization, signing in strongly: two-factor on
 * or a passkey-only account) may register an app: the script acts as the named operator
 * (./operator-session.ts), without asking a password or a code.
 * A created app is trusted (no consent screen) and needs PKCE; its secret is printed ONCE — store
 * it with the app's other secrets, never in a repository. Needs the service's own environment
 * (ACCOUNT_DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, KETE_OPERATORS_ORGANIZATION_ID).
 */
import { parseArgs } from 'node:util';
import { auth } from '../src/platform/auth';
import { getPool } from '../src/platform/db';
import { openOperatorSession } from './operator-session';

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
};

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    name: { type: 'string' },
    redirect: { type: 'string', multiple: true },
    operator: { type: 'string' },
    // The app may provision people by phone and ask their sign-in links (spec 013).
    people: { type: 'boolean', default: false },
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
    const session = await openOperatorSession(values.operator);
    const client = await api
      .adminCreateOAuthClient({
        headers: session.headers,
        body: {
          client_name: values.name,
          application_type: local ? 'native' : 'web',
          redirect_uris: redirects,
          token_endpoint_auth_method: 'client_secret_post',
          grant_types: values.people
            ? ['authorization_code', 'refresh_token', 'client_credentials']
            : ['authorization_code', 'refresh_token'],
          response_types: ['code'],
          skip_consent: true,
          require_pkce: true,
          client_credentials_scopes: values.people ? ['kete:people'] : [],
        },
      })
      .finally(() => session.close());
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
