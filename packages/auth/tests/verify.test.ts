import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createTokenVerifier, InvalidTokenError } from '../src/index.js';

const issuer = 'https://compte.kete.test';

interface Key {
  privateKey: CryptoKey;
  jwk: JWK;
}

async function key(kid: string): Promise<Key> {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  return { privateKey, jwk: { ...(await exportJWK(publicKey)), kid, alg: 'EdDSA' } };
}

const claims = {
  email: 'awa@example.test',
  name: 'Awa',
  org: 'org_a1',
  role: 'owner',
};

function token(
  signer: Key,
  overrides: {
    payload?: Record<string, unknown>;
    issuer?: string;
    audience?: string;
    expiresAt?: number | string;
  } = {},
) {
  return new SignJWT({ ...claims, ...overrides.payload })
    .setProtectedHeader({ alg: 'EdDSA', kid: String(signer.jwk.kid) })
    .setSubject('usr_a1')
    .setIssuer(overrides.issuer ?? issuer)
    .setAudience(overrides.audience ?? 'kete-apps')
    .setIssuedAt()
    .setExpirationTime(overrides.expiresAt ?? '15m')
    .sign(signer.privateKey);
}

let published: Key;
let foreign: Key;

beforeAll(async () => {
  published = await key('kete-1');
  foreign = await key('kete-1');
});

function verifier() {
  return createTokenVerifier({ issuer, jwks: { keys: [published.jwk] } });
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(InvalidTokenError);
  return (error as InvalidTokenError).code;
}

describe('createTokenVerifier', () => {
  it('reads the person, the active organization and the role from a valid token', async () => {
    const identity = await verifier()(await token(published));
    expect(identity).toMatchObject({
      userId: 'usr_a1',
      email: 'awa@example.test',
      name: 'Awa',
      organizationId: 'org_a1',
      role: 'owner',
    });
    expect(identity.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('accepts a person without an organization yet', async () => {
    const identity = await verifier()(
      await token(published, { payload: { org: null, role: null } }),
    );
    expect(identity.organizationId).toBeNull();
    expect(identity.role).toBeNull();
  });

  it('refuses an expired token', async () => {
    const expired = await token(published, { expiresAt: Math.floor(Date.now() / 1000) - 60 });
    expect(await refusal(verifier()(expired))).toBe('expired');
  });

  it('refuses an altered token', async () => {
    const [header, payload, signature] = (await token(published)).split('.');
    const forged = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload ?? '', 'base64url').toString()),
        role: 'owner',
        org: 'org_other',
      }),
    ).toString('base64url');
    expect(await refusal(verifier()(`${header}.${forged}.${signature}`))).toBe('invalid');
  });

  it('refuses a token signed by a key that was never published, even with a known key id', async () => {
    expect(await refusal(verifier()(await token(foreign)))).toBe('invalid');
  });

  it('refuses a token from another issuer or for another audience', async () => {
    const v = verifier();
    expect(await refusal(v(await token(published, { issuer: 'https://evil.test' })))).toBe(
      'invalid',
    );
    expect(await refusal(v(await token(published, { audience: 'other-app' })))).toBe('invalid');
  });

  it('refuses an unsigned token and garbage', async () => {
    const payload = Buffer.from(
      JSON.stringify({ ...claims, sub: 'usr_a1', iss: issuer, aud: 'kete-apps', exp: 9999999999 }),
    ).toString('base64url');
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${payload}.`;
    expect(await refusal(verifier()(none))).toBe('invalid');
    expect(await refusal(verifier()('not-a-token'))).toBe('invalid');
  });

  it('refuses a token whose Kete claims are malformed', async () => {
    const v = verifier();
    expect(await refusal(v(await token(published, { payload: { role: 'superuser' } })))).toBe(
      'invalid',
    );
    expect(await refusal(v(await token(published, { payload: { role: null } })))).toBe('invalid');
    expect(await refusal(v(await token(published, { payload: { email: 42 } })))).toBe('invalid');
  });
});
