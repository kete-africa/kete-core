import { createHash, randomBytes } from 'node:crypto';
import { createIdentity } from '@kete/identity';
import pg from 'pg';
import { afterAll, describe, expect, it } from 'vitest';
import { accountIdentityOptions } from '@/platform/auth';

// Spec 060 — an MCP client (Claude, ChatGPT, Codex) identifies by the address of its metadata
// document (Client ID Metadata Documents, MCP 2026-07-28): nobody registers it by hand, the person
// still signs in and consents, and it never takes over a client an operator registered.

const run = randomBytes(4).toString('hex');
const BASE = process.env.BETTER_AUTH_URL ?? 'http://localhost:3100';
const owner = new pg.Pool({ connectionString: process.env.ACCOUNT_TEST_OWNER_URL, max: 1 });
const clientId = `https://claude-${run}.example.test/oauth/client.json`;
const redirect = `https://claude-${run}.example.test/oauth/callback`;

/** The network, as the client's host answers it: its metadata document only. */
const network = (document: Record<string, unknown>) => async (input: RequestInfo | URL) =>
  String(input instanceof Request ? input.url : input) === clientId
    ? Response.json(document, { headers: { 'cache-control': 'max-age=60' } })
    : new Response('not found', { status: 404 });

const identityWith = (document: Record<string, unknown>, allow?: (url: string) => boolean) =>
  createIdentity({
    ...accountIdentityOptions(),
    clientMetadataDocuments: { fetch: network(document), ...(allow ? { allow } : {}) },
  });

const authorize = (handler: (request: Request) => Promise<Response>) => {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirect,
    scope: 'openid profile',
    state: `s-${run}`,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });
  return handler(new Request(`${BASE}/api/auth/oauth2/authorize?${query}`, { redirect: 'manual' }));
};

afterAll(async () => {
  await owner.query('delete from oauth_client where client_id = $1', [clientId]);
  await owner.end();
});

describe('MCP clients identified by their metadata document', () => {
  it('says so in its discovery metadata', async () => {
    const { auth } = identityWith({});
    const response = await auth.handler(
      new Request(`${BASE}/.well-known/oauth-authorization-server`),
    );
    const metadata = (await response.json()) as Record<string, unknown>;
    expect(metadata.client_id_metadata_document_supported).toBe(true);
  });

  it('knows the client from its document, then sends the person to sign in', async () => {
    const { auth } = identityWith({
      client_id: clientId,
      client_name: 'Claude',
      redirect_uris: [redirect],
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    });
    const response = await authorize((request) => auth.handler(request));
    expect([302, 303]).toContain(response.status);
    expect(response.headers.get('location')).toContain('/connexion');
    const { rows } = await owner.query<{ client_discovery_id: string; name: string }>(
      'select client_discovery_id, name from oauth_client where client_id = $1',
      [clientId],
    );
    expect(rows[0]).toMatchObject({ client_discovery_id: 'cimd', name: 'Claude' });
  });

  it('refuses a document the policy does not allow, or that claims another address', async () => {
    const refusedHost = identityWith({}, () => false);
    const refused = await authorize((request) => refusedHost.auth.handler(request));
    expect(refused.headers.get('location') ?? '').not.toContain('/connexion');
    const impostor = identityWith({
      client_id: 'https://elsewhere.example.test/client.json',
      client_name: 'Claude',
      redirect_uris: [redirect],
      token_endpoint_auth_method: 'none',
    });
    await owner.query('delete from oauth_client where client_id = $1', [clientId]);
    const forged = await authorize((request) => impostor.auth.handler(request));
    expect(forged.headers.get('location') ?? '').not.toContain('/connexion');
  });
});
