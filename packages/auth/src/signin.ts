import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, SignJWT, type JSONWebKeySet } from 'jose';
import {
  createTokenVerifier,
  type KeteIdentity,
  type KeteRole,
  type TokenVerifier,
} from './verify.js';

export interface SignInOptions {
  /** The Compte Kete's public origin, e.g. https://compte.kete.africa */
  accountUrl: string;
  /** This app's registration at the Compte Kete (an operator creates it). */
  clientId: string;
  clientSecret: string;
  /** This app's callback address, exactly as registered. */
  redirectUri: string;
  /** Signs this app's own cookies; at least 32 characters, never shared with another app. */
  sessionSecret: string;
  /** Defaults to 8 hours; after that the person is signed in again (silently when still signed in at the Compte Kete). */
  sessionTtlSeconds?: number;
  /** Defaults to `kete_session`. */
  cookieName?: string;
  /** Defaults to `urn:kete:apps`. */
  audience?: string;
  /** Tests only: the published keys, instead of fetching them. */
  jwks?: JSONWebKeySet;
  fetch?: typeof fetch;
}

export interface KeteSignIn {
  /** Sends the browser to the Compte Kete to sign in, then back to `returnTo` (a path of this app). */
  start(request: Request, options?: { returnTo?: string }): Promise<Response>;
  /** The redirect address handler: checks the answer, opens this app's session. */
  callback(request: Request): Promise<Response>;
  /** The person signed in to this app, or null. */
  session(request: Request): Promise<KeteIdentity | null>;
  /** Closes this app's session (the Compte Kete session stays). */
  signOut(returnTo?: string): Response;
}

export class SignInError extends Error {
  constructor(
    readonly code: 'invalid_state' | 'denied' | 'token_exchange' | 'invalid_token',
    options?: { cause?: unknown },
  ) {
    super(code, options);
    this.name = 'SignInError';
  }
}

interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

const FLOW_TTL_SECONDS = 10 * 60;

function base64url(bytes: Buffer): string {
  return bytes.toString('base64url');
}

function cookies(request: Request): Map<string, string> {
  const jar = new Map<string, string>();
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0)
      jar.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return jar;
}

/** Only paths of this app are followed after sign-in. */
function safePath(value: string | null | undefined): string {
  return value && /^\/(?![/\\])/.test(value) ? value : '/';
}

/**
 * Sign-in with the Compte Kete for any Kete app (spec 007): OAuth 2.1 authorization code with
 * PKCE, the access token verified against the Compte Kete's published keys, then a short session
 * in this app's own signed cookie. Framework-free: standard Request and Response.
 */
export function createKeteSignIn(options: SignInOptions): KeteSignIn {
  if (options.sessionSecret.length < 32) throw new Error('sessionSecret: at least 32 characters');
  const accountUrl = options.accountUrl.replace(/\/$/, '');
  const http = options.fetch ?? fetch;
  const audience = options.audience ?? 'urn:kete:apps';
  const ttl = options.sessionTtlSeconds ?? 8 * 60 * 60;
  const cookieName = options.cookieName ?? 'kete_session';
  const flowCookie = `${cookieName}_flow`;
  const secure = options.redirectUri.startsWith('https://');
  const key = new TextEncoder().encode(options.sessionSecret);

  let discovery: Promise<Discovery> | undefined;
  let verifier: Promise<TokenVerifier> | undefined;

  function discover(): Promise<Discovery> {
    discovery ??= http(`${accountUrl}/.well-known/openid-configuration`).then(async (r) => {
      if (!r.ok) throw new SignInError('token_exchange');
      return (await r.json()) as Discovery;
    });
    return discovery;
  }

  function tokens(): Promise<TokenVerifier> {
    verifier ??= discover().then((d) =>
      createTokenVerifier({
        issuer: d.issuer,
        audience,
        jwks: options.jwks ?? new URL(d.jwks_uri),
      }),
    );
    return verifier;
  }

  function cookie(name: string, value: string, maxAge: number): string {
    return [
      `${name}=${encodeURIComponent(value)}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      `Max-Age=${maxAge}`,
      ...(secure ? ['Secure'] : []),
    ].join('; ');
  }

  function redirect(location: string, setCookies: string[]): Response {
    const headers = new Headers({ location, 'cache-control': 'no-store' });
    for (const value of setCookies) headers.append('set-cookie', value);
    return new Response(null, { status: 302, headers });
  }

  return {
    async start(request, startOptions = {}) {
      const d = await discover();
      const state = base64url(randomBytes(24));
      const codeVerifier = base64url(randomBytes(32));
      const challenge = base64url(createHash('sha256').update(codeVerifier).digest());
      const returnTo = safePath(
        startOptions.returnTo ?? new URL(request.url).searchParams.get('returnTo'),
      );
      const flow = await new SignJWT({ state, codeVerifier, returnTo })
        .setProtectedHeader({ alg: 'HS256' })
        .setExpirationTime(`${FLOW_TTL_SECONDS}s`)
        .sign(key);
      const url = new URL(d.authorization_endpoint);
      url.search = new URLSearchParams({
        response_type: 'code',
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        scope: 'openid profile email',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        resource: audience,
      }).toString();
      return redirect(url.toString(), [cookie(flowCookie, flow, FLOW_TTL_SECONDS)]);
    },

    async callback(request) {
      const params = new URL(request.url).searchParams;
      if (params.get('error')) throw new SignInError('denied');
      const raw = cookies(request).get(flowCookie);
      let flow: { state: string; codeVerifier: string; returnTo: string };
      try {
        flow = (await jwtVerify(raw ?? '', key, { algorithms: ['HS256'] })).payload as typeof flow;
      } catch (error) {
        throw new SignInError('invalid_state', { cause: error });
      }
      const code = params.get('code');
      if (!code || params.get('state') !== flow.state) throw new SignInError('invalid_state');

      const d = await discover();
      const response = await http(d.token_endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: options.redirectUri,
          client_id: options.clientId,
          client_secret: options.clientSecret,
          code_verifier: flow.codeVerifier,
          resource: audience,
        }),
      });
      if (!response.ok) throw new SignInError('token_exchange');
      const { access_token: accessToken } = (await response.json()) as { access_token?: string };
      let identity: KeteIdentity;
      try {
        identity = await (await tokens())(accessToken ?? '');
      } catch (error) {
        throw new SignInError('invalid_token', { cause: error });
      }
      const session = await new SignJWT({
        email: identity.email,
        name: identity.name,
        org: identity.organizationId,
        role: identity.role,
        apps: Object.fromEntries(
          Object.entries(identity.apps).map(([app, until]) => [app, until.toISOString()]),
        ),
        two_factor: identity.twoFactor,
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(identity.userId)
        .setIssuedAt()
        .setExpirationTime(`${ttl}s`)
        .sign(key);
      return redirect(flow.returnTo, [cookie(cookieName, session, ttl), cookie(flowCookie, '', 0)]);
    },

    async session(request) {
      const raw = cookies(request).get(cookieName);
      if (!raw) return null;
      try {
        const { payload } = await jwtVerify(raw, key, { algorithms: ['HS256'] });
        const apps = (payload.apps ?? {}) as Record<string, string>;
        return {
          userId: String(payload.sub),
          email: String(payload.email),
          name: String(payload.name),
          organizationId: (payload.org as string | null) ?? null,
          role: (payload.role as KeteRole | null) ?? null,
          apps: Object.fromEntries(
            Object.entries(apps).map(([app, until]) => [app, new Date(until)]),
          ),
          twoFactor: payload.two_factor === true,
          expiresAt: new Date(Number(payload.exp) * 1000),
        };
      } catch {
        // Expired, altered or foreign: not signed in.
        return null;
      }
    },

    signOut(returnTo) {
      return redirect(safePath(returnTo), [cookie(cookieName, '', 0)]);
    },
  };
}
