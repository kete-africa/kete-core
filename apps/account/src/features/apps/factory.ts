import { z } from 'zod';
import { auth, CENTER_SCOPE, FACTORY_SCOPE } from '@/platform/auth';
import { env } from '@/platform/env';
import { openOperatorSession } from '@/platform/operator-session';
import { AppApiError, requireApp } from './people';

/**
 * Spec 048 — the app factory registers the apps it creates, so that they sign people in with the
 * Compte Kete like every Kete app. Only the factory's own client may (scope `kete:factory`); each
 * registration is made as the operator named for it, and only for an https callback on the hosts
 * allowed. A registered app is trusted (no consent screen) and needs PKCE, as with the operator
 * script; it may speak to its center as itself (`kete:center`, kete-core spec 049).
 */
const registration = z.object({
  name: z.string().trim().min(1).max(80),
  redirectUri: z.string().url().startsWith('https://'),
});

const api = auth.api as unknown as {
  adminCreateOAuthClient(input: {
    body: Record<string, unknown>;
    headers: Headers;
  }): Promise<{ client_id: string; client_secret?: string }>;
};

export async function registerAppForFactory(
  request: Request,
): Promise<{ clientId: string; clientSecret: string }> {
  await requireApp(request, FACTORY_SCOPE);
  const { operator, hosts } = env.factory;
  if (!operator || hosts.length === 0) throw new AppApiError(403, 'not_configured');
  const parsed = registration.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new AppApiError(422, 'invalid_input');
  const host = new URL(parsed.data.redirectUri).hostname.toLowerCase();
  if (!hosts.some((suffix) => host.endsWith(suffix))) {
    throw new AppApiError(403, 'host_not_allowed');
  }
  const session = await openOperatorSession(operator);
  try {
    const client = await api.adminCreateOAuthClient({
      headers: session.headers,
      body: {
        client_name: parsed.data.name,
        application_type: 'web',
        redirect_uris: [parsed.data.redirectUri],
        token_endpoint_auth_method: 'client_secret_post',
        grant_types: ['authorization_code', 'refresh_token', 'client_credentials'],
        response_types: ['code'],
        skip_consent: true,
        require_pkce: true,
        client_credentials_scopes: [CENTER_SCOPE],
      },
    });
    if (!client.client_secret) throw new AppApiError(400, 'no_secret');
    return { clientId: client.client_id, clientSecret: client.client_secret };
  } finally {
    await session.close();
  }
}
