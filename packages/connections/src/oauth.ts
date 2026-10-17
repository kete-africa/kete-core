import * as oauth from 'oauth4webapi';

// OAuth 2.0 with a connected tool (spec 119), on `oauth4webapi`: the authorization code with PKCE,
// then the refresh. The provider's addresses come from the product's infrastructure layer — the
// only place a vendor is named.

export interface OAuthProvider {
  /** The authorization server's identifier, as it says itself (its issuer). */
  issuer: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  scopes: readonly string[];
  /** Tests and private networks only: plain http. */
  allowHttp?: boolean;
  fetch?: typeof fetch;
}

/** What a tool grants: kept sealed, never shown. */
export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  /** Milliseconds since the epoch. */
  expiresAt?: number;
  scopes?: string[];
}

export class OAuthError extends Error {
  constructor(
    readonly code: 'refused' | 'invalid_response' | 'unreachable',
    message: string,
  ) {
    super(message);
    this.name = 'OAuthError';
  }
}

function serverOf(provider: OAuthProvider): oauth.AuthorizationServer {
  return {
    issuer: provider.issuer,
    authorization_endpoint: provider.authorizationEndpoint,
    token_endpoint: provider.tokenEndpoint,
  };
}

function optionsOf(provider: OAuthProvider) {
  return {
    ...(provider.fetch ? { [oauth.customFetch]: provider.fetch } : {}),
    ...(provider.allowHttp ? { [oauth.allowInsecureRequests]: true } : {}),
  };
}

function tokensOf(result: oauth.TokenEndpointResponse, now: number): OAuthTokens {
  return {
    accessToken: result.access_token,
    ...(result.refresh_token ? { refreshToken: result.refresh_token } : {}),
    ...(typeof result.expires_in === 'number' ? { expiresAt: now + result.expires_in * 1000 } : {}),
    ...(typeof result.scope === 'string'
      ? { scopes: result.scope.split(' ').filter(Boolean) }
      : {}),
  };
}

async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof oauth.ResponseBodyError) {
      throw new OAuthError('refused', `${error.error}: ${error.error_description ?? ''}`.trim());
    }
    if (error instanceof oauth.AuthorizationResponseError) {
      throw new OAuthError('refused', error.error);
    }
    if (error instanceof TypeError) throw new OAuthError('unreachable', error.message);
    throw new OAuthError(
      'invalid_response',
      error instanceof Error ? error.message : String(error),
    );
  }
}

/**
 * Where to send the person to grant the tool, and what to keep until she comes back: the state and
 * the PKCE verifier (in her session, never in the address).
 */
export async function startOAuth(
  provider: OAuthProvider,
  redirectUri: string,
): Promise<{ url: string; state: string; codeVerifier: string }> {
  const codeVerifier = oauth.generateRandomCodeVerifier();
  const state = oauth.generateRandomState();
  const url = new URL(provider.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', provider.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('scope', provider.scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', await oauth.calculatePKCECodeChallenge(codeVerifier));
  url.searchParams.set('code_challenge_method', 'S256');
  return { url: url.href, state, codeVerifier };
}

/** Her return from the tool: the code checked against the state, exchanged for tokens. */
export function finishOAuth(
  provider: OAuthProvider,
  input: { callbackUrl: string; redirectUri: string; state: string; codeVerifier: string },
  now = Date.now(),
): Promise<OAuthTokens> {
  return guarded(async () => {
    const as = serverOf(provider);
    const client: oauth.Client = { client_id: provider.clientId };
    const params = oauth.validateAuthResponse(as, client, new URL(input.callbackUrl), input.state);
    const response = await oauth.authorizationCodeGrantRequest(
      as,
      client,
      oauth.ClientSecretPost(provider.clientSecret),
      params,
      input.redirectUri,
      input.codeVerifier,
      optionsOf(provider),
    );
    return tokensOf(await oauth.processAuthorizationCodeResponse(as, client, response), now);
  });
}

/** New tokens for a refresh token; the tool may hand a new refresh token too. */
export function refreshOAuth(
  provider: OAuthProvider,
  refreshToken: string,
  now = Date.now(),
): Promise<OAuthTokens> {
  return guarded(async () => {
    const as = serverOf(provider);
    const client: oauth.Client = { client_id: provider.clientId };
    const response = await oauth.refreshTokenGrantRequest(
      as,
      client,
      oauth.ClientSecretPost(provider.clientSecret),
      refreshToken,
      optionsOf(provider),
    );
    const tokens = tokensOf(await oauth.processRefreshTokenResponse(as, client, response), now);
    return tokens.refreshToken ? tokens : { ...tokens, refreshToken };
  });
}
