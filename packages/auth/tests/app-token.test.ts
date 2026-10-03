import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import { createAppToken, createAppTokenVerifier, InvalidTokenError } from '../src/index.js';

// Spec 049: an app speaks to its center as itself, with a client_credentials token carrying
// `kete:center`; a person's token never passes for an app's.

const issuer = 'https://compte.kete.test';
let privateKey: CryptoKey;
let jwk: JWK;

beforeAll(async () => {
  const pair = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  privateKey = pair.privateKey;
  jwk = { ...(await exportJWK(pair.publicKey)), kid: 'k1', alg: 'EdDSA' };
});

const sign = (payload: Record<string, unknown>, subject?: string) => {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'EdDSA', kid: 'k1' })
    .setIssuer(issuer)
    .setAudience('urn:kete:apps')
    .setIssuedAt()
    .setExpirationTime('5m');
  return (subject ? jwt.setSubject(subject) : jwt).sign(privateKey);
};

describe('an app’s own token', () => {
  it('is accepted with its scope, and says which app it is', async () => {
    const verify = createAppTokenVerifier({ issuer, scope: 'kete:center', jwks: { keys: [jwk] } });
    const app = await verify(await sign({ azp: 'cli_helpdesk', scope: 'kete:center' }));
    expect(app).toMatchObject({ clientId: 'cli_helpdesk', scopes: ['kete:center'] });
  });

  it('is refused without its scope, or with a person behind it', async () => {
    const verify = createAppTokenVerifier({ issuer, scope: 'kete:center', jwks: { keys: [jwk] } });
    await expect(verify(await sign({ azp: 'cli_x', scope: 'kete:people' }))).rejects.toThrow(
      InvalidTokenError,
    );
    await expect(
      verify(await sign({ azp: 'cli_x', scope: 'kete:center' }, 'usr_awa')),
    ).rejects.toThrow(InvalidTokenError);
  });

  it('is asked once, then kept until a minute before it expires', async () => {
    let asked = 0;
    let time = 0;
    const token = createAppToken({
      accountUrl: 'https://compte.kete.test/',
      clientId: 'cli_x',
      clientSecret: 'secret',
      scope: 'kete:center',
      now: () => time,
      fetch: (async (url: string, init?: RequestInit) => {
        asked += 1;
        expect(url).toBe('https://compte.kete.test/api/auth/oauth2/token');
        expect(String(init?.body)).toContain('grant_type=client_credentials');
        return Response.json({ access_token: `t${asked}`, expires_in: 300 });
      }) as unknown as typeof fetch,
    });
    expect(await token()).toBe('t1');
    time = 239_000;
    expect(await token()).toBe('t1');
    time = 241_000;
    expect(await token()).toBe('t2');
  });

  it('is null when the Compte Kete refuses', async () => {
    const token = createAppToken({
      accountUrl: 'https://compte.kete.test',
      clientId: 'cli_x',
      clientSecret: 'wrong',
      scope: 'kete:center',
      fetch: (async () => new Response('no', { status: 401 })) as unknown as typeof fetch,
    });
    expect(await token()).toBeNull();
  });
});
