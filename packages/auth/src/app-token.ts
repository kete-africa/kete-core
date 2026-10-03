import {
  createLocalJWKSet,
  createRemoteJWKSet,
  errors,
  jwtVerify,
  type JSONWebKeySet,
  type JWTVerifyGetKey,
} from 'jose';
import { InvalidTokenError } from './verify.js';

// An app's own token (kete-core spec 049): a `client_credentials` token the Compte Kete issued to
// the app itself, with no person behind it. A center (Kete Enterprise) accepts it for what the app
// says as itself — its events, the outcome of a decision it asked — never as a person.

/** Who an app token speaks for: the app's client, and the scopes it was granted. */
export interface KeteApp {
  clientId: string;
  scopes: string[];
  expiresAt: Date;
}

export interface AppTokenVerifierOptions {
  /** The Compte Kete's public origin: the token's issuer. */
  issuer: string;
  /** The scope the token must carry: `kete:center`. */
  scope: string;
  audience?: string | string[];
  jwks?: URL | JSONWebKeySet;
  clockToleranceSeconds?: number;
}

export type AppTokenVerifier = (token: string) => Promise<KeteApp>;

/** Builds a verifier for apps' own tokens; a person's token, or one without the scope, is refused. */
export function createAppTokenVerifier(options: AppTokenVerifierOptions): AppTokenVerifier {
  const issuer = options.issuer.replace(/\/$/, '');
  const source = options.jwks ?? new URL(`${issuer}/api/auth/jwks`);
  const keys: JWTVerifyGetKey =
    source instanceof URL ? createRemoteJWKSet(source) : createLocalJWKSet(source);
  return async (token) => {
    let payload: Record<string, unknown>;
    try {
      ({ payload } = await jwtVerify(token, keys, {
        issuer,
        audience: options.audience ?? 'urn:kete:apps',
        clockTolerance: options.clockToleranceSeconds ?? 5,
        algorithms: ['EdDSA', 'ES256', 'RS256'],
        requiredClaims: ['exp'],
      }));
    } catch (error) {
      throw new InvalidTokenError(error instanceof errors.JWTExpired ? 'expired' : 'invalid', {
        cause: error,
      });
    }
    const text = (value: unknown) => (typeof value === 'string' ? value : '');
    const clientId = text(payload.azp) || text(payload.client_id);
    const scopes = text(payload.scope).split(' ').filter(Boolean);
    // A person's token never speaks as an app: its subject is a person, not the client.
    const personBehind = typeof payload.sub === 'string' && payload.sub !== clientId;
    if (!clientId || personBehind || !scopes.includes(options.scope)) {
      throw new InvalidTokenError('invalid');
    }
    return { clientId, scopes, expiresAt: new Date((payload.exp as number) * 1000) };
  };
}

export interface MandatesOptions {
  accountUrl: string;
  /** The center's own token, carrying `kete:mandate` (see `createAppToken`). */
  appToken: () => Promise<string | null>;
  fetch?: typeof fetch;
}

/**
 * The center's side of the mandate (kete-core spec 049): exchanges a person's token for one its
 * agent carries to an app. Null when the Compte Kete refuses or does not answer: the agent then
 * does not call the app.
 */
export function createMandates(options: MandatesOptions) {
  const call = options.fetch ?? fetch;
  return async (
    subjectToken: string,
    agent: { id: string; name: string },
  ): Promise<string | null> => {
    const token = await options.appToken();
    if (!token) return null;
    const response = await call(`${options.accountUrl.replace(/\/$/, '')}/api/apps/mandates`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ subjectToken, agent }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!response || response.status !== 201) return null;
    const answer = (await response.json().catch(() => null)) as { token?: unknown } | null;
    return typeof answer?.token === 'string' ? answer.token : null;
  };
}

export interface AppTokenOptions {
  accountUrl: string;
  clientId: string;
  clientSecret: string;
  /** The scope to ask: `kete:center`. */
  scope: string;
  fetch?: typeof fetch;
  now?: () => number;
}

/**
 * The app's own token, asked of the Compte Kete (`client_credentials`) and kept until a minute
 * before it expires. Null when the Compte Kete refuses or does not answer.
 */
export function createAppToken(options: AppTokenOptions): () => Promise<string | null> {
  const call = options.fetch ?? fetch;
  const now = options.now ?? Date.now;
  let kept: { token: string; until: number } | null = null;
  return async () => {
    if (kept && now() < kept.until) return kept.token;
    const response = await call(`${options.accountUrl.replace(/\/$/, '')}/api/auth/oauth2/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: options.clientId,
        client_secret: options.clientSecret,
        scope: options.scope,
        resource: 'urn:kete:apps',
      }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!response?.ok) return null;
    const answer = (await response.json().catch(() => null)) as {
      access_token?: unknown;
      expires_in?: unknown;
    } | null;
    if (typeof answer?.access_token !== 'string') return null;
    const seconds = typeof answer.expires_in === 'number' ? answer.expires_in : 300;
    kept = { token: answer.access_token, until: now() + Math.max(0, seconds - 60) * 1000 };
    return kept.token;
  };
}
