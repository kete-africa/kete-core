import { exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  createTokenVerifier,
  InvalidTokenError,
  limitOf,
  mayRead,
  PlanRefusedError,
  refusalOf,
  requireWithinPlan,
  type KeteIdentity,
} from '../src/index.js';

// Spec 092: an app reads the organization's offer from the token, refuses a costly gesture beyond
// a limit or after the end, and stays readable.

const issuer = 'https://compte.kete.test';
const DAY = 86_400_000;
let signer: { privateKey: CryptoKey; jwk: JWK };

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  signer = { privateKey, jwk: { ...(await exportJWK(publicKey)), kid: 'kete-1', alg: 'EdDSA' } };
});

const sign = (payload: Record<string, unknown>) =>
  new SignJWT({ email: 'awa@example.test', name: 'Awa', org: 'org_a1', role: 'owner', ...payload })
    .setProtectedHeader({ alg: 'EdDSA', kid: 'kete-1' })
    .setSubject('usr_a1')
    .setIssuer(issuer)
    .setAudience('urn:kete:apps')
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(signer.privateKey);
const verify = (token: string) =>
  createTokenVerifier({ issuer, jwks: { keys: [signer.jwk] } })(token);

const iso = (offset: number) => new Date(Date.now() + offset).toISOString();

describe('the plans claim', () => {
  it('gives the app its offer: limits, trial, end of use, end of reading', async () => {
    const identity = await verify(
      await sign({
        apps: { nettio: iso(10 * DAY) },
        plans: {
          nettio: {
            offer: 'Nettio — essai',
            trial: true,
            until: iso(10 * DAY),
            readable_until: iso(100 * DAY),
            limits: { people: 3, agents: 1 },
          },
        },
      }),
    );
    expect(identity.plans?.nettio).toMatchObject({
      offer: 'Nettio — essai',
      trial: true,
      limits: { people: 3, agents: 1 },
    });
    expect(limitOf(identity, 'nettio', 'people')).toBe(3);
    expect(limitOf(identity, 'nettio', 'storage_mb')).toBeNull();
  });

  it('refuses a token whose plans are malformed', async () => {
    for (const plans of [
      { nettio: { offer: 'x', until: 'not a date', readable_until: iso(DAY), limits: {} } },
      { nettio: { offer: 'x', until: iso(DAY), readable_until: iso(DAY), limits: { seats: 3 } } },
      { nettio: { offer: 'x', until: iso(DAY), readable_until: iso(DAY), limits: { people: -1 } } },
      ['nettio'],
    ]) {
      await expect(verify(await sign({ plans }))).rejects.toBeInstanceOf(InvalidTokenError);
    }
  });

  it('is still read from a Compte Kete that does not give it: the apps claim decides', async () => {
    const identity = await verify(await sign({ apps: { nettio: iso(DAY) } }));
    expect(identity.plans).toBeUndefined();
    expect(refusalOf(identity, 'nettio', { limit: 'people', used: 1000 })).toBeNull();
    expect(mayRead(identity, 'nettio')).toBe(true);
  });
});

describe('a gesture against the offer', () => {
  const identity = (until: number, readable: number): Pick<KeteIdentity, 'apps' | 'plans'> => ({
    apps: until > 0 ? { nettio: new Date(Date.now() + until) } : {},
    plans: {
      nettio: {
        offer: 'Nettio Essentiel',
        trial: false,
        until: new Date(Date.now() + until),
        readableUntil: new Date(Date.now() + readable),
        limits: { people: 3, agents: 1 },
      },
    },
  });

  it('passes within the limits, and is refused beyond one, saying which', () => {
    const now = identity(10 * DAY, 100 * DAY);
    expect(refusalOf(now, 'nettio', { limit: 'people', used: 2 })).toBeNull();
    expect(refusalOf(now, 'nettio', { limit: 'people', used: 3 })).toEqual({
      reason: 'limit',
      limit: 'people',
      allowed: 3,
      used: 3,
    });
    expect(() => requireWithinPlan(now, 'nettio', { limit: 'agents', used: 1 })).toThrow(
      PlanRefusedError,
    );
    // A limit the offer does not set is no limit.
    expect(refusalOf(now, 'nettio', { limit: 'storage_mb', used: 10_000 })).toBeNull();
  });

  it('refuses everything new once the offer ended, and stays readable until its reading ends', () => {
    const ended = identity(-DAY, 89 * DAY);
    expect(refusalOf(ended, 'nettio')).toMatchObject({ reason: 'ended' });
    expect(mayRead(ended, 'nettio')).toBe(true);
    const gone = identity(-100 * DAY, -DAY);
    expect(mayRead(gone, 'nettio')).toBe(false);
  });

  it('refuses an app the organization has no offer for', () => {
    expect(refusalOf({ apps: {} }, 'firmo')).toEqual({ reason: 'no_plan' });
    expect(mayRead({ apps: {} }, 'firmo')).toBe(false);
  });
});
