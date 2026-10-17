import { inOrganization } from '@kete/tenancy';
import { assertOrganizationIsolation, createTestSchema, type TestSchema } from '@kete/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  connect,
  connectionHistory,
  connectionsMigrationSql,
  createSealer,
  credentialOf,
  finishOAuth,
  listConnections,
  recordCheck,
  refreshOAuth,
  revokeConnection,
  startOAuth,
  type OAuthProvider,
} from '../src/index.js';

// Spec 119: the tools an organization connects — the pressing's accounting by a key, its mailbox
// by OAuth — their credentials sealed and never shown, their health, refresh and revocation
// journaled.

const key = Buffer.alloc(32, 7).toString('base64');
const sealer = createSealer(key);

describe('sealing', () => {
  it('seals and opens under the same key only, and refuses without one', () => {
    const sealed = sealer.seal('sk-live-123');
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain('sk-live-123');
    expect(sealer.open(sealed)).toBe('sk-live-123');
    expect(createSealer(Buffer.alloc(32, 8).toString('base64')).open(sealed)).toBeNull();
    expect(sealer.open(`${sealed.slice(0, -2)}xx`)).toBeNull();
    const none = createSealer(undefined);
    expect(none.on).toBe(false);
    expect(() => none.seal('x')).toThrow(/KETE_SECRETS_KEY/);
  });
});

// The authorization server of a connected tool, as the test plays it.
const server = { refreshed: 0, refuse: false, codes: new Map<string, string>() };
const provider: OAuthProvider = {
  issuer: 'https://auth.tool.test',
  authorizationEndpoint: 'https://auth.tool.test/authorize',
  tokenEndpoint: 'https://auth.tool.test/token',
  clientId: 'kete-app',
  clientSecret: 'shh',
  scopes: ['mail.read', 'offline_access'],
  fetch: (async (_url: string, init?: RequestInit) => {
    const form = new URLSearchParams(String(init?.body ?? ''));
    if (server.refuse) {
      return Response.json(
        { error: 'invalid_grant', error_description: 'revoked' },
        { status: 400 },
      );
    }
    if (form.get('grant_type') === 'authorization_code') {
      expect(form.get('code_verifier')).toBe(server.codes.get(form.get('code') ?? ''));
      return Response.json({
        access_token: 'at-1',
        token_type: 'Bearer',
        expires_in: 3600,
        refresh_token: 'rt-1',
        scope: 'mail.read offline_access',
      });
    }
    server.refreshed += 1;
    return Response.json({
      access_token: `at-${server.refreshed + 1}`,
      token_type: 'Bearer',
      expires_in: 3600,
    });
  }) as unknown as typeof fetch,
};

describe('OAuth with a connected tool', () => {
  it('sends her to grant, checks her return, and exchanges the code with its PKCE verifier', async () => {
    const started = await startOAuth(provider, 'https://app.test/connexions/retour');
    const url = new URL(started.url);
    expect(url.origin + url.pathname).toBe('https://auth.tool.test/authorize');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe(started.state);
    expect(started.url).not.toContain(started.codeVerifier);
    server.codes.set('code-1', started.codeVerifier);
    const tokens = await finishOAuth(
      provider,
      {
        callbackUrl: `https://app.test/connexions/retour?code=code-1&state=${started.state}`,
        redirectUri: 'https://app.test/connexions/retour',
        state: started.state,
        codeVerifier: started.codeVerifier,
      },
      1_000,
    );
    expect(tokens).toEqual({
      accessToken: 'at-1',
      refreshToken: 'rt-1',
      expiresAt: 1_000 + 3_600_000,
      scopes: ['mail.read', 'offline_access'],
    });
    // A return with another state is not hers.
    await expect(
      finishOAuth(provider, {
        callbackUrl: 'https://app.test/connexions/retour?code=code-1&state=forged',
        redirectUri: 'https://app.test/connexions/retour',
        state: started.state,
        codeVerifier: started.codeVerifier,
      }),
    ).rejects.toMatchObject({ name: 'OAuthError' });
  });

  it('refreshes, keeping the refresh token the tool did not renew; a refusal says so', async () => {
    expect(await refreshOAuth(provider, 'rt-1', 0)).toMatchObject({
      accessToken: 'at-2',
      refreshToken: 'rt-1',
    });
    server.refuse = true;
    await expect(refreshOAuth(provider, 'rt-1')).rejects.toMatchObject({ code: 'refused' });
    server.refuse = false;
  });
});

let db: TestSchema;

beforeAll(async () => {
  db = await createTestSchema({
    migrate: async (owner, { schema, appRole }) => {
      await owner.query(connectionsMigrationSql({ schema, appRole }));
    },
  });
});

afterAll(async () => {
  await db?.drop();
});

describe('the connections an organization keeps', () => {
  const org = 'org_pressing_demo';

  it('keep a key sealed: listed without it, opened only for the call it serves', async () => {
    await inOrganization(db.app, org, async (tx) => {
      const books = await connect(tx, org, sealer, {
        tool: 'accounting',
        label: 'La comptabilité',
        key: 'sk-live-123',
        by: 'usr_ama',
      });
      expect(books).toMatchObject({ kind: 'key', status: 'connected' });
      const listed = await listConnections(tx);
      expect(JSON.stringify(listed)).not.toContain('sk-live-123');
      expect(await credentialOf(tx, org, sealer, books.connectionId)).toEqual({
        kind: 'key',
        key: 'sk-live-123',
      });
      const { rows } = await tx.query<{ credential: string }>(
        `select credential from kete_connections where connection_id = $1`,
        [books.connectionId],
      );
      expect(rows[0]?.credential).not.toContain('sk-live-123');
      // Another product's key cannot open it.
      await expect(
        credentialOf(
          tx,
          org,
          createSealer(Buffer.alloc(32, 9).toString('base64')),
          books.connectionId,
        ),
      ).rejects.toMatchObject({ code: 'unreadable' });
    });
  });

  it('refresh an OAuth token close to its end, say its health, and revoke it for good', async () => {
    await inOrganization(db.app, org, async (tx) => {
      const mail = await connect(tx, org, sealer, {
        tool: 'mailbox',
        label: 'La boîte de l’accueil',
        tokens: {
          accessToken: 'at-old',
          refreshToken: 'rt-1',
          expiresAt: Date.parse('2026-10-17T10:00:00Z'),
        },
        by: 'usr_ama',
      });
      // Still valid: no refresh.
      expect(
        await credentialOf(tx, org, sealer, mail.connectionId, {
          now: new Date('2026-10-17T09:00:00Z'),
        }),
      ).toEqual({ kind: 'oauth', accessToken: 'at-old' });
      // A minute before its end: refreshed, sealed again, journaled.
      const refreshed = await credentialOf(tx, org, sealer, mail.connectionId, {
        now: new Date('2026-10-17T09:59:30Z'),
        refresh: (token) => refreshOAuth(provider, token, Date.parse('2026-10-17T09:59:30Z')),
      });
      expect(refreshed.kind === 'oauth' && refreshed.accessToken).toMatch(/^at-/);
      // Without a way to refresh, it must be connected again.
      await expect(
        credentialOf(tx, org, sealer, mail.connectionId, { now: new Date('2026-10-18T12:00:00Z') }),
      ).rejects.toMatchObject({ code: 'expired' });

      expect(
        await recordCheck(tx, org, {
          connectionId: mail.connectionId,
          ok: false,
          failure: 'IMAP: authentication failed',
          by: 'kete',
        }),
      ).toMatchObject({ status: 'failing', failure: 'IMAP: authentication failed' });
      expect(
        await recordCheck(tx, org, { connectionId: mail.connectionId, ok: true, by: 'kete' }),
      ).toMatchObject({ status: 'connected', failure: null });

      expect(
        await revokeConnection(tx, org, { connectionId: mail.connectionId, by: 'usr_ama' }),
      ).toBe(true);
      expect(
        await revokeConnection(tx, org, { connectionId: mail.connectionId, by: 'usr_ama' }),
      ).toBe(false);
      await expect(credentialOf(tx, org, sealer, mail.connectionId)).rejects.toMatchObject({
        code: 'revoked',
      });
      // Every step is journaled (the refresh at its own, earlier, simulated hour).
      expect((await connectionHistory(tx, mail.connectionId)).map((e) => e.what).sort()).toEqual([
        'checked',
        'connected',
        'failed',
        'refreshed',
        'revoked',
      ]);
    });
  });

  it('keep each organization to its own connections', async () => {
    await assertOrganizationIsolation({
      app: db.app,
      table: 'kete_connections',
      organizations: ['org_iso_a', 'org_iso_b'],
      insert: async (tx, organizationId) => {
        await connect(tx, organizationId, sealer, {
          tool: 'accounting',
          label: 'Books',
          key: 'k',
          by: 'usr_ama',
        });
      },
    });
  });
});
