/**
 * Kete apps allowed to sign people in with the Compte Kete (spec 007), for operators.
 *
 *   pnpm clients create --operator me@kete.africa --name "Kete Cockpit"
 *     --redirect https://cockpit…/auth/callback
 *   pnpm clients create … --people    (the app may provision people by phone — spec 013)
 *   pnpm clients list
 *
 * Only a Kete operator (owner or admin of Kete's organization, two-factor on) may register an app:
 * the script signs in as one, asking the password and the code on the terminal.
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

/** Asks a question on the terminal; `hidden` does not echo what is typed (a password). */
function ask(question: string, hidden = false): Promise<string> {
  const ENTER = [10, 13];
  const CTRL_C = 3;
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
        if (code === CTRL_C) process.exit(130);
        answer = BACKSPACE.includes(code) ? answer.slice(0, -1) : answer + char;
      }
    };
    input.resume();
    input.on('data', onData);
  });
}

/**
 * Signs in as the operator — password, then the code of their authenticator app — asked on the
 * terminal: nothing secret goes through arguments, files or the shell history (spec 008, FR-005).
 */
async function operatorSession(email: string): Promise<Headers> {
  const password = await ask(`Password for ${email}: `, true);
  const signIn = await api.signInEmail({ body: { email, password }, returnHeaders: true });
  if (!signIn.response.twoFactorRedirect) return cookieHeader(signIn.headers);
  const code = await ask('Code from your authenticator app: ');
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
    const headers = await operatorSession(values.operator);
    const client = await api.adminCreateOAuthClient({
      headers,
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
