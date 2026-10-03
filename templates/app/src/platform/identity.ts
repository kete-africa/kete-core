import { createTokenVerifier, type KeteIdentity } from '@kete/auth';
import { env } from './env';

let verify: ((token: string) => Promise<KeteIdentity>) | undefined;

/**
 * The person behind a Compte Kete access token: from an MCP client she signed in with (Claude,
 * ChatGPT…), or from another Kete app acting for her through this app's API.
 */
export async function identityFromBearer(request: Request): Promise<KeteIdentity | null> {
  const header = request.headers.get('authorization') ?? '';
  if (!header.startsWith('Bearer ')) return null;
  // A token for Kete apps, or one an MCP client asked for this endpoint itself (RFC 8707).
  verify ??= createTokenVerifier({
    issuer: env.accountUrl,
    audience: ['urn:kete:apps', `${env.publicUrl}/mcp`],
  });
  try {
    return await verify(header.slice('Bearer '.length));
  } catch {
    return null;
  }
}
