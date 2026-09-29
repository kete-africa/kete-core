import {
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JWTVerifyGetKey,
  type JSONWebKeySet,
  createLocalJWKSet,
} from 'jose';

export type KeteRole = 'owner' | 'admin' | 'member';

/** Who a Compte Kete token speaks for. */
export interface KeteIdentity {
  userId: string;
  email: string;
  name: string;
  /** The active organization, or null when the person has none yet. */
  organizationId: string | null;
  role: KeteRole | null;
  /** Apps the organization may use, each with the end of its access (grace period included). */
  apps: Record<string, Date>;
  expiresAt: Date;
}

/** Whether the token's organization may use `app` at `now`. */
export function canUse(identity: KeteIdentity, app: string, now: Date = new Date()): boolean {
  const until = identity.apps[app];
  return until !== undefined && until > now;
}

function appsClaim(value: unknown): Record<string, Date> {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new InvalidTokenError('invalid');
  const apps: Record<string, Date> = {};
  for (const [app, until] of Object.entries(value)) {
    const date = typeof until === 'string' ? new Date(until) : new Date(Number.NaN);
    if (!/^[a-z][a-z0-9_-]{0,39}$/.test(app) || Number.isNaN(date.getTime())) {
      throw new InvalidTokenError('invalid');
    }
    apps[app] = date;
  }
  return apps;
}

export interface TokenVerifierOptions {
  /** The Compte Kete's public origin, e.g. https://compte.kete.africa — the token's issuer. */
  issuer: string;
  /** Defaults to `kete-apps`. */
  audience?: string;
  /**
   * The published keys. Defaults to `${issuer}/api/auth/jwks`, fetched once and cached; a token
   * signed by an unknown key triggers one refetch, which is how key rotation reaches apps.
   */
  jwks?: URL | JSONWebKeySet;
  /** Seconds of clock drift tolerated between servers. Defaults to 5. */
  clockToleranceSeconds?: number;
}

export class InvalidTokenError extends Error {
  constructor(
    readonly code: 'expired' | 'invalid',
    options?: { cause?: unknown },
  ) {
    super(code === 'expired' ? 'Token expired' : 'Invalid token', options);
    this.name = 'InvalidTokenError';
  }
}

export type TokenVerifier = (token: string) => Promise<KeteIdentity>;

const roles: readonly string[] = ['owner', 'admin', 'member'];

function claim(payload: Record<string, unknown>, name: string): string {
  const value = payload[name];
  if (typeof value !== 'string' || value === '') throw new InvalidTokenError('invalid');
  return value;
}

/**
 * Builds a verifier for Compte Kete tokens (spec 003, FR-005). It accepts only tokens signed by a
 * published key, for this issuer and audience, not expired, and carrying the Kete claims; anything
 * else is refused with `InvalidTokenError`.
 */
export function createTokenVerifier(options: TokenVerifierOptions): TokenVerifier {
  const issuer = options.issuer.replace(/\/$/, '');
  const source = options.jwks ?? new URL(`${issuer}/api/auth/jwks`);
  const keys: JWTVerifyGetKey =
    source instanceof URL ? createRemoteJWKSet(source) : createLocalJWKSet(source);
  const audience = options.audience ?? 'kete-apps';
  const clockTolerance = options.clockToleranceSeconds ?? 5;

  return async (token) => {
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, keys, {
        issuer,
        audience,
        clockTolerance,
        algorithms: ['EdDSA', 'ES256', 'RS256'],
        requiredClaims: ['exp', 'sub'],
      }));
    } catch (error) {
      throw new InvalidTokenError(error instanceof errors.JWTExpired ? 'expired' : 'invalid', {
        cause: error,
      });
    }
    const org = payload.org ?? null;
    const role = payload.role ?? null;
    if (org !== null && typeof org !== 'string') throw new InvalidTokenError('invalid');
    if (role !== null && (typeof role !== 'string' || !roles.includes(role))) {
      throw new InvalidTokenError('invalid');
    }
    // A role without an organization, or the reverse, is not a Compte Kete token.
    if ((org === null) !== (role === null)) throw new InvalidTokenError('invalid');
    return {
      userId: claim(payload, 'sub'),
      email: claim(payload, 'email'),
      name: claim(payload, 'name'),
      organizationId: org,
      role: role as KeteRole | null,
      // No organization, no app.
      apps: org === null ? {} : appsClaim(payload.apps),
      expiresAt: new Date((payload.exp as number) * 1000),
    };
  };
}
